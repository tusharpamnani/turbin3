use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::state::{VaultState, PositionAccount, PoolLiquidity, TradingPool, StakeRewards};
use crate::error::ErrorCode;

#[derive(Accounts)]
#[instruction(amount: u64, pool_id: u64)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", vault_state.key().as_ref()],
        bump = vault_state.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [b"vault_state", user.key().as_ref()],
        bump = vault_state.state_bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + PositionAccount::INIT_SPACE,
        seeds = [b"position", user.key().as_ref(), &pool_id.to_le_bytes()],
        bump
    )]
    pub position_account: Account<'info, PositionAccount>,

    #[account(
        mut,
        seeds = [b"trading_pool", &pool_id.to_le_bytes()],
        bump = trading_pool.bump
    )]
    pub trading_pool: Account<'info, TradingPool>,

    #[account(
        mut,
        seeds = [b"pool_liquidity"],
        bump = pool_liquidity.bump
    )]
    pub pool_liquidity: Account<'info, PoolLiquidity>,

    #[account(
        mut,
        seeds = [b"protocol_treasury"],
        bump
    )]
    pub protocol_treasury: SystemAccount<'info>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + StakeRewards::INIT_SPACE,
        seeds = [b"stake_rewards", user.key().as_ref()],
        bump
    )]
    pub stake_rewards: Account<'info, StakeRewards>,

    pub system_program: Program<'info, System>,
}

impl<'info> Deposit<'info> {
    pub fn deposit(&mut self, amount: u64, pool_id: u64, bumps: &DepositBumps) -> Result<()> {
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;

        // OFAC Check - Basic validation (in production, this would integrate with actual OFAC service)
        self.validate_ofac_compliance()?;
        
        // Validate Deposit Amount
        require!(
            amount >= VaultState::MIN_ORDER_AMOUNT,
            ErrorCode::AmountTooSmall
        );

        require!(
            amount <= VaultState::MAX_ORDER_AMOUNT,
            ErrorCode::AmountTooLarge
        );

        // Validate user has sufficient balance
        require!(
            self.user.lamports() >= amount,
            ErrorCode::InsufficientBalance
        );

        // Check if this is first deposit
        let is_first_deposit = !self.position_account.is_active;

        if is_first_deposit {
            // Create User Position Account (already handled by init_if_needed)
            self.position_account.owner = self.user.key();
            self.position_account.pool_id = pool_id;
            self.position_account.amount = 0;
            self.position_account.shares = 0;
            self.position_account.lock_start_time = current_time;
            self.position_account.lock_end_time = current_time + (30 * 24 * 60 * 60); // 30 days default
            self.position_account.is_active = true;
            self.position_account.created_at = current_time;
            self.position_account.bump = bumps.position_account;
        }

        // Transfer Tokens to Pool Vault
        let cpi_program = self.system_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.user.to_account_info(),
            to: self.vault.to_account_info()
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        transfer(cpi_ctx, amount)?;

        // Calculate Deposit Fee (10-50 basis points)
        let fee_rate = self.calculate_deposit_fee_rate(amount)?;
        let fee_amount = (amount * fee_rate) / 10000; // basis points
        let net_deposit = amount - fee_amount;

        // Send Fee to Protocol Treasury
        if fee_amount > 0 {
            let vault_seeds = &[
                b"vault",
                self.vault_state.key().as_ref(),
                &[self.vault_state.vault_bump]
            ];
            let vault_signer_seeds = &[&vault_seeds[..]];

            let fee_transfer_cpi = CpiContext::new_with_signer(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.vault.to_account_info(),
                    to: self.protocol_treasury.to_account_info(),
                },
                vault_signer_seeds
            );

            transfer(fee_transfer_cpi, fee_amount)?;
        }

        // Calculate User Pool Shares
        let user_shares = self.calculate_pool_shares(net_deposit)?;

        // Update Position Account
        self.position_account.amount += net_deposit;
        self.position_account.shares += user_shares;
        self.position_account.last_deposit_time = current_time;

        // Auto-stake for Rewards
        self.auto_stake_for_rewards(user_shares, current_time)?;

        // Update Pool Liquidity State
        self.pool_liquidity.total_liquidity += net_deposit;
        self.pool_liquidity.available_liquidity += net_deposit;
        self.pool_liquidity.total_shares += user_shares;
        self.pool_liquidity.last_updated = current_time;

        // Update Trading Pool
        self.trading_pool.total_pool_amount += net_deposit;
        self.trading_pool.total_active_amount += net_deposit;
        self.trading_pool.last_updated = current_time;

        // Update Vault State
        self.vault_state.total_deposits += amount;
        self.vault_state.last_updated = current_time;

        emit!(DepositEvent {
            user: self.user.key(),
            pool_id,
            amount: net_deposit,
            fee_amount,
            shares: user_shares,
            is_first_deposit,
            timestamp: current_time,
        });

        if is_first_deposit {
            emit!(PositionCreatedEvent {
                user: self.user.key(),
                position: self.position_account.key(),
                pool_id,
                initial_amount: net_deposit,
                lock_end_time: self.position_account.lock_end_time,
            });
        } else {
            emit!(PositionUpdatedEvent {
                user: self.user.key(),
                position: self.position_account.key(),
                new_amount: self.position_account.amount,
                new_shares: self.position_account.shares,
            });
        }
        
        Ok(())
    }

    fn validate_ofac_compliance(&self) -> Result<()> {
        // Basic OFAC validation - in production, integrate with actual OFAC service
        // For now, just check if user is not a known blacklisted address
        
        // Example blacklist check (replace with actual OFAC integration)
        let blacklisted_addresses = [
            // Add known sanctioned addresses here
        ];

        for &blacklisted in blacklisted_addresses.iter() {
            require!(
                self.user.key() != blacklisted,
                ErrorCode::OFACViolation
            );
        }

        Ok(())
    }

    fn calculate_deposit_fee_rate(&self, amount: u64) -> Result<u64> {
        // Calculate fee rate based on deposit amount (10-50 basis points)
        let fee_rate = if amount >= 100_000_000_000 { // >= 100 SOL
            10 // 0.1% for large deposits
        } else if amount >= 10_000_000_000 { // >= 10 SOL
            20 // 0.2% for medium deposits
        } else if amount >= 1_000_000_000 { // >= 1 SOL
            30 // 0.3% for small deposits
        } else {
            50 // 0.5% for very small deposits
        };

        Ok(fee_rate)
    }

    fn calculate_pool_shares(&self, net_deposit: u64) -> Result<u64> {
        // Calculate shares based on current pool state
        let shares = if self.pool_liquidity.total_liquidity == 0 {
            // First deposit - 1:1 ratio
            net_deposit
        } else {
            // Calculate proportional shares
            (net_deposit * self.pool_liquidity.total_shares) / self.pool_liquidity.total_liquidity
        };

        Ok(shares)
    }

    fn auto_stake_for_rewards(&mut self, shares: u64, current_time: i64) -> Result<()> {
        // Initialize stake rewards if needed
        if !self.stake_rewards.is_initialized {
            self.stake_rewards.user = self.user.key();
            self.stake_rewards.total_staked = 0;
            self.stake_rewards.pending_rewards = 0;
            self.stake_rewards.last_reward_time = current_time;
            self.stake_rewards.is_initialized = true;
        }

        // Auto-stake the new shares
        self.stake_rewards.total_staked += shares;
        self.stake_rewards.last_stake_time = current_time;

        emit!(AutoStakeEvent {
            user: self.user.key(),
            shares_staked: shares,
            total_staked: self.stake_rewards.total_staked,
            timestamp: current_time,
        });

        Ok(())
    }
}

// Events
#[event]
pub struct DepositEvent {
    pub user: Pubkey,
    pub pool_id: u64,
    pub amount: u64,
    pub fee_amount: u64,
    pub shares: u64,
    pub is_first_deposit: bool,
    pub timestamp: i64,
}

#[event]
pub struct PositionCreatedEvent {
    pub user: Pubkey,
    pub position: Pubkey,
    pub pool_id: u64,
    pub initial_amount: u64,
    pub lock_end_time: i64,
}

#[event]
pub struct PositionUpdatedEvent {
    pub user: Pubkey,
    pub position: Pubkey,
    pub new_amount: u64,
    pub new_shares: u64,
}

#[event]
pub struct AutoStakeEvent {
    pub user: Pubkey,
    pub shares_staked: u64,
    pub total_staked: u64,
    pub timestamp: i64,
}

// Extended PositionAccount structure
#[account]
pub struct PositionAccount {
    pub owner: Pubkey,              // 32 bytes
    pub pool_id: u64,               // 8 bytes
    pub amount: u64,                // 8 bytes
    pub shares: u64,                // 8 bytes
    pub lock_start_time: i64,       // 8 bytes
    pub lock_end_time: i64,         // 8 bytes
    pub last_deposit_time: i64,     // 8 bytes
    pub is_active: bool,            // 1 byte
    pub created_at: i64,            // 8 bytes
    pub bump: u8,                   // 1 byte
}

impl PositionAccount {
    pub const INIT_SPACE: usize = 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 1; // 90 bytes
}

// StakeRewards structure
#[account]
pub struct StakeRewards {
    pub user: Pubkey,               // 32 bytes
    pub total_staked: u64,          // 8 bytes
    pub pending_rewards: u64,       // 8 bytes
    pub last_reward_time: i64,      // 8 bytes
    pub last_stake_time: i64,       // 8 bytes
    pub is_initialized: bool,       // 1 byte
}

impl StakeRewards {
    pub const INIT_SPACE: usize = 32 + 8 + 8 + 8 + 8 + 1; // 65 bytes
}

// Extended VaultState constants
impl VaultState {
    pub const MIN_ORDER_AMOUNT: u64 = 100_000; // 0.0001 SOL
    pub const MAX_ORDER_AMOUNT: u64 = 1_000_000_000_000; // 1000 SOL
}

// Extended PoolLiquidity structure
#[account]
pub struct PoolLiquidity {
    pub total_liquidity: u64,       // 8 bytes
    pub available_liquidity: u64,   // 8 bytes
    pub locked_liquidity: u64,      // 8 bytes
    pub total_shares: u64,          // 8 bytes
    pub last_updated: i64,          // 8 bytes
    pub bump: u8,                   // 1 byte
}

impl PoolLiquidity {
    pub const INIT_SPACE: usize = 8 + 8 + 8 + 8 + 8 + 1; // 41 bytes
}

// Additional error codes
impl ErrorCode {
    pub const AmountTooSmall: ErrorCode = ErrorCode::AmountTooSmall;
    pub const AmountTooLarge: ErrorCode = ErrorCode::AmountTooLarge;
    pub const InsufficientBalance: ErrorCode = ErrorCode::InsufficientBalance;
    pub const OFACViolation: ErrorCode = ErrorCode::OFACViolation;
}