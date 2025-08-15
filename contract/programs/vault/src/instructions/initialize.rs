use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::state::{VaultState, PositionAccount, PoolLiquidity};
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        seeds = [b"vault_state", user.key().as_ref()],
        bump,
        space = 8 + VaultState::INIT_SPACE
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"vault", vault_state.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(
        init,
        payer = user,
        space = 8 + PositionAccount::INIT_SPACE,
        seeds = [b"position", user.key().as_ref()],
        bump
    )]
    pub position_account: Account<'info, PositionAccount>,

    #[account(
        mut,
        seeds = [b"pool_liquidity"],
        bump = pool_liquidity.bump
    )]
    pub pool_liquidity: Account<'info, PoolLiquidity>,

    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn initialize_vault(&mut self, bumps: &InitializeBumps, initial_deposit: Option<u64>) -> Result<()> {
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;

        // Validate user is not default pubkey
        require!(
            !self.user.key().eq(&Pubkey::default()),
            ErrorCode::InvalidAuthority
        );

        // Initialize Vault State
        self.vault_state.authority = self.user.key();
        self.vault_state.owner = self.user.key();
        self.vault_state.vault_bump = bumps.vault;
        self.vault_state.state_bump = bumps.vault_state;
        self.vault_state.total_deposits = 0;
        self.vault_state.total_withdrawals = 0;
        self.vault_state.is_initialized = true;
        self.vault_state.is_active = true;
        self.vault_state.created_at = current_time;
        self.vault_state.last_updated = current_time;

        // Initialize Position Account
        self.position_account.owner = self.user.key();
        self.position_account.amount = 0;
        self.position_account.lock_start_time = 0;
        self.position_account.lock_end_time = 0;
        self.position_account.is_active = false;
        self.position_account.created_at = current_time;
        self.position_account.bump = bumps.position_account;

        // Handle initial deposit if provided
        if let Some(deposit_amount) = initial_deposit {
            require!(
                deposit_amount >= VaultState::MIN_ORDER_AMOUNT,
                ErrorCode::AmountTooSmall
            );

            // Validate user has sufficient balance
            require!(
                self.user.lamports() >= deposit_amount,
                ErrorCode::InsufficientBalance
            );

            // Transfer initial funds from user to vault
            let cpi_program = self.system_program.to_account_info();
            let cpi_accounts = Transfer {
                from: self.user.to_account_info(),
                to: self.vault.to_account_info()
            };

            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            transfer(cpi_ctx, deposit_amount)?;

            // Update vault state with initial deposit
            self.vault_state.total_deposits = deposit_amount;

            // Update position account with initial deposit
            self.position_account.amount = deposit_amount;
            self.position_account.is_active = true;
            self.position_account.lock_start_time = current_time;
            // Default lock period of 30 days
            self.position_account.lock_end_time = current_time + (30 * 24 * 60 * 60);

            // Update pool liquidity
            self.pool_liquidity.total_liquidity += deposit_amount;
            self.pool_liquidity.available_liquidity += deposit_amount;
            self.pool_liquidity.last_updated = current_time;

            emit!(InitialDepositEvent {
                user: self.user.key(),
                vault: self.vault.key(),
                amount: deposit_amount,
                lock_end_time: self.position_account.lock_end_time,
            });
        }

        emit!(VaultInitializedEvent {
            user: self.user.key(),
            vault_state: self.vault_state.key(),
            vault: self.vault.key(),
            position: self.position_account.key(),
            initial_deposit: initial_deposit.unwrap_or(0),
            timestamp: current_time,
        });
        
        Ok(())
    }

    pub fn update_vault_status(&mut self, is_active: bool) -> Result<()> {
        // Only vault authority can update status
        require!(
            self.user.key() == self.vault_state.authority,
            ErrorCode::InvalidAuthority
        );

        let clock = Clock::get()?;
        self.vault_state.is_active = is_active;
        self.vault_state.last_updated = clock.unix_timestamp;

        emit!(VaultStatusUpdatedEvent {
            user: self.user.key(),
            vault_state: self.vault_state.key(),
            is_active,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    pub fn extend_lock_period(&mut self, additional_days: u32) -> Result<()> {
        // Only position owner can extend lock period
        require!(
            self.user.key() == self.position_account.owner,
            ErrorCode::InvalidPositionOwnership
        );

        require!(
            self.position_account.is_active,
            ErrorCode::PositionNotActive
        );

        require!(
            additional_days > 0 && additional_days <= 365,
            ErrorCode::InvalidLockPeriod
        );

        let clock = Clock::get()?;
        let additional_seconds = (additional_days as i64) * 24 * 60 * 60;
        
        self.position_account.lock_end_time += additional_seconds;
        self.vault_state.last_updated = clock.unix_timestamp;

        emit!(LockPeriodExtendedEvent {
            user: self.user.key(),
            position: self.position_account.key(),
            additional_days,
            new_lock_end_time: self.position_account.lock_end_time,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}

// Events
#[event]
pub struct VaultInitializedEvent {
    pub user: Pubkey,
    pub vault_state: Pubkey,
    pub vault: Pubkey,
    pub position: Pubkey,
    pub initial_deposit: u64,
    pub timestamp: i64,
}

#[event]
pub struct InitialDepositEvent {
    pub user: Pubkey,
    pub vault: Pubkey,
    pub amount: u64,
    pub lock_end_time: i64,
}

#[event]
pub struct VaultStatusUpdatedEvent {
    pub user: Pubkey,
    pub vault_state: Pubkey,
    pub is_active: bool,
    pub timestamp: i64,
}

#[event]
pub struct LockPeriodExtendedEvent {
    pub user: Pubkey,
    pub position: Pubkey,
    pub additional_days: u32,
    pub new_lock_end_time: i64,
    pub timestamp: i64,
}

// Extended VaultState structure for consistency
#[account]
pub struct VaultState {
    pub authority: Pubkey,        // 32 bytes
    pub owner: Pubkey,           // 32 bytes
    pub vault_bump: u8,          // 1 byte
    pub state_bump: u8,          // 1 byte
    pub total_deposits: u64,     // 8 bytes
    pub total_withdrawals: u64,  // 8 bytes
    pub is_initialized: bool,    // 1 byte
    pub is_active: bool,         // 1 byte
    pub created_at: i64,         // 8 bytes
    pub last_updated: i64,       // 8 bytes
}

impl VaultState {
    pub const INIT_SPACE: usize = 32 + 32 + 1 + 1 + 8 + 8 + 1 + 1 + 8 + 8; // 100 bytes
    pub const MIN_ORDER_AMOUNT: u64 = 100_000; // 0.0001 SOL minimum
}

// Extended PositionAccount structure
#[account]
pub struct PositionAccount {
    pub owner: Pubkey,           // 32 bytes
    pub amount: u64,             // 8 bytes
    pub lock_start_time: i64,    // 8 bytes
    pub lock_end_time: i64,      // 8 bytes
    pub is_active: bool,         // 1 byte
    pub created_at: i64,         // 8 bytes
    pub bump: u8,                // 1 byte
}

impl PositionAccount {
    pub const INIT_SPACE: usize = 32 + 8 + 8 + 8 + 1 + 8 + 1; // 66 bytes
}

// Additional error codes
impl ErrorCode {
    pub const InvalidAuthority: ErrorCode = ErrorCode::InvalidAuthority;
    pub const AmountTooSmall: ErrorCode = ErrorCode::AmountTooSmall;
    pub const InsufficientBalance: ErrorCode = ErrorCode::InsufficientBalance;
    pub const InvalidPositionOwnership: ErrorCode = ErrorCode::InvalidPositionOwnership;
    pub const PositionNotActive: ErrorCode = ErrorCode::PositionNotActive;
    pub const InvalidLockPeriod: ErrorCode = ErrorCode::InvalidLockPeriod;
}