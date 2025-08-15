use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::state::{TradingPool, VaultState, PoolLiquidity};
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct InitTradingPool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + TradingPool::INIT_SPACE,
        seeds = [b"trading_pool"],
        bump
    )]
    pub trading_pool: Account<'info, TradingPool>,

    #[account(
        mut,
        seeds = [b"trading_pool_vault", trading_pool.key().as_ref()],
        bump
    )]
    pub trading_pool_vault: SystemAccount<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + VaultState::INIT_SPACE,
        seeds = [b"vault_state", admin.key().as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        init,
        payer = admin,
        space = 8 + PoolLiquidity::INIT_SPACE,
        seeds = [b"pool_liquidity"],
        bump
    )]
    pub pool_liquidity: Account<'info, PoolLiquidity>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitTradingPool<'info> {
    pub fn initialize(&mut self, bumps: &InitTradingPoolBumps, initial_deposit: Option<u64>) -> Result<()> {
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;
        
        // Validate admin authority
        require!(
            !self.admin.key().eq(&Pubkey::default()),
            ErrorCode::InvalidAuthority
        );

        // Initialize Trading Pool
        self.trading_pool.authority = self.admin.key();
        self.trading_pool.total_active_amount = 0;
        self.trading_pool.total_pool_amount = 0;
        self.trading_pool.is_active = true;
        self.trading_pool.created_at = current_time;
        self.trading_pool.last_updated = current_time;
        self.trading_pool.bump = bumps.trading_pool;
        self.trading_pool.vault_bump = bumps.trading_pool_vault;

        // Initialize Vault State
        self.vault_state.owner = self.admin.key();
        self.vault_state.vault_bump = bumps.trading_pool_vault;
        self.vault_state.state_bump = bumps.vault_state;
        self.vault_state.total_deposits = 0;
        self.vault_state.total_withdrawals = 0;
        self.vault_state.is_initialized = true;
        self.vault_state.created_at = current_time;

        // Initialize Pool Liquidity
        self.pool_liquidity.total_liquidity = 0;
        self.pool_liquidity.available_liquidity = 0;
        self.pool_liquidity.locked_liquidity = 0;
        self.pool_liquidity.last_updated = current_time;
        self.pool_liquidity.bump = bumps.pool_liquidity;

        // Handle initial deposit if provided
        if let Some(deposit_amount) = initial_deposit {
            require!(
                deposit_amount >= TradingPool::MIN_INITIAL_DEPOSIT,
                ErrorCode::AmountTooSmall
            );

            // Transfer initial funds from admin to vault
            let cpi_program = self.system_program.to_account_info();
            let cpi_accounts = Transfer {
                from: self.admin.to_account_info(),
                to: self.trading_pool_vault.to_account_info()
            };

            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            transfer(cpi_ctx, deposit_amount)?;

            // Update pool amounts
            self.trading_pool.total_pool_amount = deposit_amount;
            self.trading_pool.total_active_amount = deposit_amount;
            
            // Update vault state
            self.vault_state.total_deposits = deposit_amount;
            
            // Update pool liquidity
            self.pool_liquidity.total_liquidity = deposit_amount;
            self.pool_liquidity.available_liquidity = deposit_amount;

            emit!(InitialDepositEvent {
                pool: self.trading_pool.key(),
                admin: self.admin.key(),
                amount: deposit_amount,
            });
        }

        emit!(TradingPoolCreatedEvent {
            pool: self.trading_pool.key(),
            authority: self.trading_pool.authority,
            vault: self.trading_pool_vault.key(),
            initial_amount: initial_deposit.unwrap_or(0),
            timestamp: current_time,
        });
        
        Ok(())
    }

    pub fn update_pool_status(&mut self, is_active: bool) -> Result<()> {
        // Only authority can update pool status
        require!(
            self.admin.key() == self.trading_pool.authority,
            ErrorCode::InvalidAuthority
        );

        let clock = Clock::get()?;
        self.trading_pool.is_active = is_active;
        self.trading_pool.last_updated = clock.unix_timestamp;

        emit!(PoolStatusUpdatedEvent {
            pool: self.trading_pool.key(),
            is_active,
            updated_by: self.admin.key(),
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}

// Events
#[event]
pub struct TradingPoolCreatedEvent {
    pub pool: Pubkey,
    pub authority: Pubkey,
    pub vault: Pubkey,
    pub initial_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct InitialDepositEvent {
    pub pool: Pubkey,
    pub admin: Pubkey,
    pub amount: u64,
}

#[event]
pub struct PoolStatusUpdatedEvent {
    pub pool: Pubkey,
    pub is_active: bool,
    pub updated_by: Pubkey,
    pub timestamp: i64,
}

// Extended TradingPool state structure
#[account]
pub struct TradingPool {
    pub authority: Pubkey,
    pub total_active_amount: u64,
    pub total_pool_amount: u64,
    pub is_active: bool,
    pub created_at: i64,
    pub last_updated: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl TradingPool {
    pub const INIT_SPACE: usize = 32 + 8 + 8 + 1 + 8 + 8 + 1 + 1; // 67 bytes
    pub const MIN_INITIAL_DEPOSIT: u64 = 1_000_000; // 0.001 SOL minimum
}

// Extended VaultState for consistency
impl VaultState {
    pub const INIT_SPACE: usize = 32 + 1 + 1 + 8 + 8 + 1 + 8; // 59 bytes
}

// Extended PoolLiquidity for consistency  
impl PoolLiquidity {
    pub const INIT_SPACE: usize = 8 + 8 + 8 + 8 + 1; // 33 bytes
}

// Additional error codes
impl ErrorCode {
    pub const InvalidAuthority: ErrorCode = ErrorCode::InvalidAuthority;
    pub const AmountTooSmall: ErrorCode = ErrorCode::AmountTooSmall;
}