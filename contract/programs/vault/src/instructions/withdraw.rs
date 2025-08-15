use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::state::{VaultState, PositionAccount, PoolLiquidity};
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct Withdraw<'info> {
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
        mut,
        seeds = [b"position", user.key().as_ref()],
        bump = position_account.bump,
        constraint = position_account.owner == user.key() @ ErrorCode::InvalidPositionOwnership
    )]
    pub position_account: Account<'info, PositionAccount>,

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

    pub system_program: Program<'info, System>,
}

impl<'info> Withdraw<'info> {
    pub fn withdraw(&mut self, amount: u64, is_full_withdrawal: bool) -> Result<()> {
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;
        
        // Validate Position Ownership (already done via constraint)
        
        // Check if lock period has elapsed
        let lock_period_elapsed = current_time >= self.position_account.lock_end_time;
        
        let (final_amount, fee_amount) = if lock_period_elapsed {
            // Calculate Full Withdrawal Amount
            let withdrawal_amount = if is_full_withdrawal {
                self.position_account.amount
            } else {
                amount
            };
            (withdrawal_amount, 0u64)
        } else {
            // Calculate Early Withdrawal Fee (2-5% penalty)
            let withdrawal_amount = if is_full_withdrawal {
                self.position_account.amount
            } else {
                amount
            };
            
            let penalty_rate = self.calculate_early_withdrawal_penalty()?;
            let fee = (withdrawal_amount * penalty_rate) / 10000; // basis points
            let remaining_amount = withdrawal_amount - fee;
            
            (remaining_amount, fee)
        };

        // Validate sufficient balance
        require!(
            self.position_account.amount >= amount,
            ErrorCode::InsufficientBalance
        );

        // Validate vault has sufficient funds
        require!(
            self.vault.lamports() >= final_amount + fee_amount,
            ErrorCode::InsufficientVaultFunds
        );

        if fee_amount > 0 {
            // Send Fee to Protocol Treasury
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

        // Transfer remaining amount to user
        let vault_seeds = &[
            b"vault",
            self.vault_state.key().as_ref(),
            &[self.vault_state.vault_bump]
        ];
        let vault_signer_seeds = &[&vault_seeds[..]];

        let user_transfer_cpi = CpiContext::new_with_signer(
            self.system_program.to_account_info(),
            Transfer {
                from: self.vault.to_account_info(),
                to: self.user.to_account_info(),
            },
            vault_signer_seeds
        );

        transfer(user_transfer_cpi, final_amount)?;

        if is_full_withdrawal {
            // Close Position - Return Rent to User
            let position_lamports = self.position_account.to_account_info().lamports();
            
            **self.position_account.to_account_info().try_borrow_mut_lamports()? -= position_lamports;
            **self.user.to_account_info().try_borrow_mut_lamports()? += position_lamports;
            
            // Mark position as closed
            self.position_account.amount = 0;
            self.position_account.is_active = false;
        } else {
            // Update Position Account
            self.position_account.amount -= amount;
        }

        // Update Pool Liquidity State
        self.pool_liquidity.total_liquidity -= amount;
        self.pool_liquidity.last_updated = current_time;

        emit!(WithdrawalEvent {
            user: self.user.key(),
            amount: final_amount,
            fee_amount,
            is_full_withdrawal,
            timestamp: current_time,
        });

        Ok(())
    }

    fn calculate_early_withdrawal_penalty(&self) -> Result<u64> {
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;
        
        let time_remaining = self.position_account.lock_end_time - current_time;
        let total_lock_duration = self.position_account.lock_end_time - self.position_account.lock_start_time;
        
        // Calculate penalty based on remaining time (2-5% range)
        // More time remaining = higher penalty
        let penalty_basis_points = if time_remaining >= total_lock_duration / 2 {
            500 // 5% if more than half the lock period remains
        } else if time_remaining >= total_lock_duration / 4 {
            350 // 3.5% if more than quarter remains
        } else {
            200 // 2% if less than quarter remains
        };
        
        Ok(penalty_basis_points)
    }
}

// Event emitted when a withdrawal is made
#[event]
pub struct WithdrawalEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub fee_amount: u64,
    pub is_full_withdrawal: bool,
    pub timestamp: i64,
}

// Additional state structs that would be needed
#[account]
pub struct PositionAccount {
    pub owner: Pubkey,
    pub amount: u64,
    pub lock_start_time: i64,
    pub lock_end_time: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
pub struct PoolLiquidity {
    pub total_liquidity: u64,
    pub last_updated: i64,
    pub bump: u8,
}

// Error codes specific to withdrawal
impl ErrorCode {
    pub const InvalidPositionOwnership: ErrorCode = ErrorCode::InvalidPositionOwnership;
    pub const InsufficientBalance: ErrorCode = ErrorCode::InsufficientBalance;
    pub const InsufficientVaultFunds: ErrorCode = ErrorCode::InsufficientVaultFunds;
}