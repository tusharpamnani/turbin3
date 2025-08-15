use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2, VerificationLevel};
use crate::state::{PositionState, PositionStatus, TradingPool, VaultState, PositionVault};
use crate::error::ErrorCode;
use crate::constants::{BTC_FEED_ID, MAXIMUM_AGE, MIN_LEVERAGE, MAX_LEVERAGE, MIN_POSITION_SIZE};

#[derive(Accounts)]
#[instruction(
    is_long: bool,
    size: u64,
    leverage: u8,
    collateral_amount: u64,
    order_id: u64,
)]
pub struct CreatePosition<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        init,
        payer = user,
        space = 8 + PositionState::LEN,
        seeds = [
            b"position".as_ref(),
            user.key().as_ref(),
            &order_id.to_le_bytes()
        ],
        bump
    )]
    pub position: Account<'info, PositionState>,

    #[account(
        init,
        payer = user,
        space = 8 + PositionVault::LEN,
        seeds = [
            b"position_vault".as_ref(),
            position.key().as_ref()
        ],
        bump
    )]
    pub position_vault: Account<'info, PositionVault>,
    
    // User's personal vault
    #[account(
        mut,
        seeds = [b"vault", user_vault_state.key().as_ref()],
        bump = user_vault_state.vault_bump,
    )]
    pub user_vault: SystemAccount<'info>,
    
    #[account(
        mut,
        seeds = [b"vault_state", user.key().as_ref()],
        bump = user_vault_state.state_bump
    )]
    pub user_vault_state: Account<'info, VaultState>,
    
    // Trading pool 
    #[account(
        mut,
        seeds = [b"trading_pool"],
        bump = trading_pool.bump,
    )]
    pub trading_pool: Account<'info, TradingPool>,
    
    // Trading pool vault
    #[account(
        mut,
        seeds = [b"trading_pool_vault", trading_pool.key().as_ref()],
        bump = trading_pool.vault_bump
    )]
    pub trading_pool_vault: SystemAccount<'info>,
    
    // Pyth price update
    #[account(
        owner = pyth_solana_receiver_sdk::ID,
        constraint = price_update.verification_level == VerificationLevel::Full,
    )]
    pub price_update: Account<'info, PriceUpdateV2>,
    
    pub system_program: Program<'info, System>,
}

impl<'info> CreatePosition<'info> {
    pub fn create_position(
        &mut self, 
        is_long: bool,
        size: u64,
        leverage: u8,
        collateral_amount: u64,
        order_id: u64,
        expires_at: i64,
        bumps: &CreatePositionBumps
    ) -> Result<()> {
        let clock = Clock::get()?;
        
        msg!("=== LEVERAGED POSITION CREATION ===");
        msg!("User: {}", self.user.key());
        msg!("Order ID: {}", order_id);
        msg!("Is Long: {}", is_long);
        msg!("Size: {}", size);
        msg!("Leverage: {}x", leverage);
        msg!("Collateral: {}", collateral_amount);

        // Validate leverage ratio (1-10x maximum)
        self.validate_leverage_ratio(leverage)?;

        // Verify price update is valid
        require!(
            self.price_update.verification_level == VerificationLevel::Full,
            ErrorCode::UnverifiedPriceUpdate
        );
        
        // Get current BTC price for entry
        let price_data = self.price_update.get_price_no_older_than(
            &clock,
            MAXIMUM_AGE,
            &get_feed_id_from_hex(BTC_FEED_ID)?,
        ).map_err(|_| error!(ErrorCode::StalePriceFeed))?;
        
        let entry_price = price_data.price as u64;
        msg!("Entry price: {}", entry_price);

        // Create Position Account using derived PDA
        self.create_position_account(is_long, size, leverage, collateral_amount, entry_price, order_id, expires_at, bumps)?;

        // Create Position Vault Account
        self.create_position_vault_account(bumps)?;

        // Transfer collateral to position vault
        self.transfer_collateral_to_vault(collateral_amount)?;

        // Calculate margin requirements
        let margin_requirements = self.calculate_margin_requirements(size, leverage, entry_price)?;
        msg!("Required margin: {}", margin_requirements.required_margin);
        msg!("Maintenance margin: {}", margin_requirements.maintenance_margin);

        // Set liquidation thresholds
        let liquidation_thresholds = self.set_liquidation_thresholds(&margin_requirements, entry_price, is_long)?;
        msg!("Liquidation price: {}", liquidation_thresholds.liquidation_price);

        // Check if user has sufficient collateral
        require!(
            self.sufficient_collateral_check(collateral_amount, &margin_requirements)?,
            ErrorCode::InsufficientFunds
        );

        // Initialize health monitoring
        self.initialize_health_monitoring()?;

        // Update pool active positions
        self.update_pool_active_positions(size)?;

        // Update position with calculated values
        let position = &mut self.position;
        position.liquidation_price = Some(liquidation_thresholds.liquidation_price);
        position.required_margin = margin_requirements.required_margin;
        position.maintenance_margin = margin_requirements.maintenance_margin;

        emit!(LeveragedPositionCreatedEvent {
            position: position.key(),
            user: position.user,
            order_id: position.order_id,
            is_long: position.is_long,
            size: position.size,
            leverage: position.leverage,
            entry_price: position.entry_price,
            collateral_amount: position.collateral_amount,
            required_margin: margin_requirements.required_margin,
            liquidation_price: liquidation_thresholds.liquidation_price,
            expires_at: position.expires_at,
            trading_pool: self.trading_pool.key(),
        });

        msg!("=== POSITION SUCCESSFULLY CREATED ===");
        Ok(())
    }

    fn validate_leverage_ratio(&self, leverage: u8) -> Result<()> {
        msg!("Validating leverage ratio: {}x", leverage);
        
        require!(
            leverage >= MIN_LEVERAGE && leverage <= MAX_LEVERAGE,
            ErrorCode::InvalidLeverage
        );
        
        Ok(())
    }

    fn create_position_account(
        &mut self,
        is_long: bool,
        size: u64,
        leverage: u8,
        collateral_amount: u64,
        entry_price: u64,
        order_id: u64,
        expires_at: i64,
        bumps: &CreatePositionBumps
    ) -> Result<()> {
        msg!("Creating position account with derived PDA");
        
        require!(size >= MIN_POSITION_SIZE, ErrorCode::PositionTooSmall);
        require!(collateral_amount > 0, ErrorCode::InvalidCollateralAmount);
        require!(expires_at > Clock::get()?.unix_timestamp, ErrorCode::InvalidExpirationTime);

        // Initialize position state
        let position = &mut self.position;
        *position = PositionState::new(
            self.user.key(),
            order_id,
            is_long,
            size,
            entry_price,
            collateral_amount,
            leverage,
            expires_at,
            bumps.position,
        );

        // Set additional leveraged position fields
        position.status = PositionStatus::Active;
        
        Ok(())
    }

    fn create_position_vault_account(&mut self, bumps: &CreatePositionBumps) -> Result<()> {
        msg!("Creating position vault account");
        
        let position_vault = &mut self.position_vault;
        position_vault.position = self.position.key();
        position_vault.balance = 0;
        position_vault.bump = bumps.position_vault;
        
        Ok(())
    }

    fn transfer_collateral_to_vault(&mut self, collateral_amount: u64) -> Result<()> {
        msg!("Transferring collateral to position vault");
        
        // Check user vault balance
        let user_vault_balance = self.user_vault.lamports();
        require!(
            user_vault_balance >= collateral_amount,
            ErrorCode::InsufficientVaultBalance
        );

        // Transfer from user vault to position vault (via trading pool for now)
        let user_vault_seeds = &[
            b"vault".as_ref(),
            self.user_vault_state.to_account_info().key.as_ref(),
            &[self.user_vault_state.vault_bump],
        ];
        let signer_seeds = &[&user_vault_seeds[..]];
        
        let cpi_ctx = CpiContext::new_with_signer(
            self.system_program.to_account_info(),
            Transfer {
                from: self.user_vault.to_account_info(),
                to: self.trading_pool_vault.to_account_info(),
            },
            signer_seeds,
        );
        
        transfer(cpi_ctx, collateral_amount)?;
        
        // Update position vault balance tracking
        self.position_vault.balance = collateral_amount;
        
        Ok(())
    }

    fn calculate_margin_requirements(&self, size: u64, leverage: u8, entry_price: u64) -> Result<MarginRequirements> {
        msg!("Calculating margin requirements");
        
        // Position value = size * entry_price
        let position_value = size.checked_mul(entry_price)
            .ok_or(ErrorCode::MathOverflow)?;
        
        // Required margin = position_value / leverage
        let required_margin = position_value.checked_div(leverage as u64)
            .ok_or(ErrorCode::DivisionByZero)?;
        
        // Maintenance margin = required_margin * 0.5 (50% of initial margin)
        let maintenance_margin = required_margin.checked_div(2)
            .ok_or(ErrorCode::DivisionByZero)?;
        
        Ok(MarginRequirements {
            required_margin,
            maintenance_margin,
            position_value,
        })
    }

    fn set_liquidation_thresholds(&self, margin_req: &MarginRequirements, entry_price: u64, is_long: bool) -> Result<LiquidationThresholds> {
        msg!("Setting liquidation thresholds");
        
        // Calculate liquidation price based on maintenance margin
        // For long: liquidation_price = entry_price - (maintenance_margin / size)
        // For short: liquidation_price = entry_price + (maintenance_margin / size)
        
        let size = self.position.size;
        let price_impact = margin_req.maintenance_margin.checked_div(size)
            .ok_or(ErrorCode::DivisionByZero)?;
        
        let liquidation_price = if is_long {
            entry_price.checked_sub(price_impact)
                .ok_or(ErrorCode::MathOverflow)?
        } else {
            entry_price.checked_add(price_impact)
                .ok_or(ErrorCode::MathOverflow)?
        };
        
        Ok(LiquidationThresholds {
            liquidation_price,
            maintenance_margin_ratio: 50, // 50% of initial margin
        })
    }

    fn sufficient_collateral_check(&self, collateral_amount: u64, margin_req: &MarginRequirements) -> Result<bool> {
        msg!("Checking sufficient collateral");
        
        // Collateral must be at least equal to required margin
        let is_sufficient = collateral_amount >= margin_req.required_margin;
        
        if !is_sufficient {
            msg!("Insufficient collateral: {} < {}", collateral_amount, margin_req.required_margin);
        }
        
        Ok(is_sufficient)
    }

    fn initialize_health_monitoring(&mut self) -> Result<()> {
        msg!("Initializing health monitoring");
        
        let current_time = Clock::get()?.unix_timestamp;
        let position = &mut self.position;
        
        // Set initial health check timestamp
        position.last_health_check = current_time;
        position.last_reward_claim = current_time;
        
        // Initial status is Active, will be updated by health monitoring
        position.status = PositionStatus::Active;
        
        Ok(())
    }

    fn update_pool_active_positions(&mut self, size: u64) -> Result<()> {
        msg!("Updating pool active positions");
        
        // Update trading pool
        self.trading_pool.total_active_amount = self.trading_pool.total_active_amount
            .checked_add(size)
            .ok_or(ErrorCode::MathOverflow)?;
        
        self.trading_pool.total_pool_amount = self.trading_pool.total_pool_amount
            .checked_add(self.position.collateral_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        
        // Update user vault state
        self.user_vault_state.active_positions = self.user_vault_state.active_positions
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;
        
        Ok(())
    }
}

#[derive(Debug)]
struct MarginRequirements {
    required_margin: u64,
    maintenance_margin: u64,
    position_value: u64,
}

#[derive(Debug)]
struct LiquidationThresholds {
    liquidation_price: u64,
    maintenance_margin_ratio: u8,
}

// Position Vault to hold collateral for individual positions
#[account]
pub struct PositionVault {
    pub position: Pubkey,
    pub balance: u64,
    pub bump: u8,
}

impl PositionVault {
    pub const LEN: usize = 8 + // discriminator
        32 + // position
        8 + // balance
        1; // bump
}

#[event]
pub struct LeveragedPositionCreatedEvent {
    pub position: Pubkey,
    pub user: Pubkey,
    pub order_id: u64,
    pub is_long: bool,
    pub size: u64,
    pub leverage: u8,
    pub entry_price: u64,
    pub collateral_amount: u64,
    pub required_margin: u64,
    pub liquidation_price: u64,
    pub expires_at: i64,
    pub trading_pool: Pubkey,
}