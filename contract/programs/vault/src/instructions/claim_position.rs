use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};
use crate::state::{PositionState, PositionStatus, VaultState, TradingPool, RewardPool};
use crate::error::ErrorCode;

#[derive(Accounts)]
#[instruction(order_id: u64)]
pub struct ClaimPosition<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"position".as_ref(),
            user.key().as_ref(),
            &order_id.to_le_bytes()
        ],
        bump = position.bump,
        constraint = position.user == user.key(),
        constraint = position.order_id == order_id,
    )]
    pub position: Account<'info, PositionState>,

    #[account(
        mut,
        seeds = [b"vault", user_vault_state.key().as_ref()],
        bump = user_vault_state.vault_bump
    )]
    pub user_vault: SystemAccount<'info>,

    #[account(
        seeds = [b"vault_state", user.key().as_ref()],
        bump = user_vault_state.state_bump
    )]
    pub user_vault_state: Account<'info, VaultState>,
    
    #[account(
        mut,
        seeds = [b"trading_pool"],
        bump = trading_pool.bump,
    )]
    pub trading_pool: Account<'info, TradingPool>,
    
    #[account(
        mut,
        seeds = [b"trading_pool_vault", trading_pool.key().as_ref()],
        bump = trading_pool.vault_bump
    )]
    pub trading_pool_vault: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [b"reward_pool"],
        bump = reward_pool.bump,
    )]
    pub reward_pool: Account<'info, RewardPool>,

    #[account(
        mut,
        seeds = [b"reward_pool_vault", reward_pool.key().as_ref()],
        bump = reward_pool.vault_bump
    )]
    pub reward_pool_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> ClaimPosition<'info> {
    pub fn claim(&mut self, _bumps: &ClaimPositionBumps) -> Result<()> {
        let position = &mut self.position;
        let clock = Clock::get()?;
        
        msg!("=== REWARD CLAIM PROCESS ===");
        msg!("Position order_id: {}", position.order_id);
        msg!("Position status: {:?}", position.status);
        msg!("Current time: {}", clock.unix_timestamp);

        // Validate position ownership (already done by constraints, but explicit check)
        require!(
            position.user == self.user.key(),
            ErrorCode::UnauthorizedAccess
        );

        // Handle different claim scenarios based on position status
        match position.status {
            PositionStatus::Settled => {
                self.claim_settled_position(position, clock.unix_timestamp)?;
            },
            PositionStatus::Healthy | PositionStatus::Warning | PositionStatus::LiquidationRisk => {
                self.claim_rewards(position, clock.unix_timestamp)?;
            },
            PositionStatus::Liquidated => {
                return Err(ErrorCode::PositionLiquidated.into());
            },
            _ => {
                return Err(ErrorCode::InvalidPositionStatus.into());
            }
        }

        Ok(())
    }

    fn claim_settled_position(&mut self, position: &mut PositionState, current_time: i64) -> Result<()> {
        // Check if position is already claimed
        require!(
            !position.is_claimed,
            ErrorCode::PositionAlreadyClaimed
        );

        let settlement_data = position.settlement_data
            .ok_or(ErrorCode::PositionNotSettled)?;

        msg!("Settlement payout percentage: {}", settlement_data.payout_percentage);

        // Calculate base payout from settlement
        let base_payout = (position.collateral_amount as u128 * settlement_data.payout_percentage as u128 / 100) as u64;
        
        // Calculate time-based rewards
        let time_rewards = self.calculate_time_based_rewards(position, current_time)?;
        
        // Calculate performance rewards
        let performance_rewards = self.calculate_performance_rewards(position)?;
        
        let total_payout = base_payout + time_rewards + performance_rewards;

        msg!("Base payout: {}", base_payout);
        msg!("Time rewards: {}", time_rewards);
        msg!("Performance rewards: {}", performance_rewards);
        msg!("Total payout: {}", total_payout);

        // Check if rewards are available
        let total_rewards = time_rewards + performance_rewards;
        if total_rewards > 0 {
            self.validate_and_transfer_rewards(position, total_rewards, current_time)?;
        }

        // Transfer base payout from trading pool
        if base_payout > 0 {
            self.transfer_base_payout(position, base_payout)?;
        }

        // Mark position as claimed
        position.claim(current_time)?;

        emit!(PositionClaimedEvent {
            position: position.key(),
            user: position.user,
            base_payout,
            time_rewards,
            performance_rewards,
            total_payout,
        });

        Ok(())
    }

    fn claim_rewards(&mut self, position: &mut PositionState, current_time: i64) -> Result<()> {
        // Calculate time-based rewards for active positions
        let time_rewards = self.calculate_time_based_rewards(position, current_time)?;
        
        // Calculate performance rewards based on current position performance
        let performance_rewards = self.calculate_performance_rewards(position)?;
        
        let total_rewards = time_rewards + performance_rewards;

        msg!("Time-based rewards: {}", time_rewards);
        msg!("Performance rewards: {}", performance_rewards);
        msg!("Total rewards: {}", total_rewards);

        // Check if rewards are available
        if total_rewards == 0 {
            msg!("No rewards to claim");
            return Ok(());
        }

        // Validate and transfer rewards
        self.validate_and_transfer_rewards(position, total_rewards, current_time)?;

        // Update last claim timestamp
        position.last_reward_claim = current_time;
        
        // Reset claimable counter
        position.claimable_rewards = 0;

        emit!(RewardsClaimedEvent {
            position: position.key(),
            user: position.user,
            time_rewards,
            performance_rewards,
            total_rewards,
            claim_timestamp: current_time,
        });

        Ok(())
    }

    fn calculate_time_based_rewards(&self, position: &PositionState, current_time: i64) -> Result<u64> {
        // Time-based rewards: Position Size × Rate × Time
        let time_elapsed = current_time.saturating_sub(position.last_reward_claim);
        
        // Convert to hours for calculation (assuming rate is per hour)
        let hours_elapsed = time_elapsed / 3600;
        
        if hours_elapsed <= 0 {
            return Ok(0);
        }

        // Base reward rate (e.g., 0.1% per hour)
        let base_rate = self.reward_pool.base_reward_rate; // basis points per hour
        
        let time_rewards = (position.size as u128)
            .checked_mul(base_rate as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_mul(hours_elapsed as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10000) // Convert from basis points
            .ok_or(ErrorCode::DivisionByZero)? as u64;

        Ok(time_rewards)
    }

    fn calculate_performance_rewards(&self, position: &PositionState) -> Result<u64> {
        // Performance rewards: Pool Share × Performance
        let pool_share = if self.trading_pool.total_active_amount > 0 {
            (position.size as u128 * 10000) / self.trading_pool.total_active_amount as u128
        } else {
            0
        };

        // Calculate performance multiplier based on position health and P&L
        let performance_multiplier = match position.status {
            PositionStatus::Healthy => 150, // 1.5x multiplier
            PositionStatus::Warning => 100,  // 1.0x multiplier
            PositionStatus::LiquidationRisk => 50, // 0.5x multiplier
            PositionStatus::Settled => {
                // For settled positions, use payout percentage as performance indicator
                if let Some(settlement_data) = &position.settlement_data {
                    if settlement_data.payout_percentage > 100 {
                        200 // 2.0x for winning positions
                    } else {
                        0   // No performance rewards for losing positions
                    }
                } else {
                    100
                }
            },
            _ => 100
        };

        let base_performance_reward = self.reward_pool.performance_pool_amount
            .checked_mul(pool_share as u64)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::DivisionByZero)?;

        let performance_rewards = base_performance_reward
            .checked_mul(performance_multiplier)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(100)
            .ok_or(ErrorCode::DivisionByZero)?;

        Ok(performance_rewards)
    }

    fn validate_and_transfer_rewards(&mut self, position: &PositionState, reward_amount: u64, current_time: i64) -> Result<()> {
        // Validate pool reward reserves
        let reward_vault_balance = self.reward_pool_vault.lamports();
        require!(
            reward_vault_balance >= reward_amount,
            ErrorCode::InsufficientRewardReserves
        );

        // Transfer rewards from reward pool to user vault
        let reward_pool_seeds = &[
            b"reward_pool_vault",
            self.reward_pool.to_account_info().key.as_ref(),
            &[self.reward_pool.vault_bump],
        ];
        let signer_seeds = &[&reward_pool_seeds[..]];
        
        let cpi_ctx = CpiContext::new_with_signer(
            self.system_program.to_account_info(),
            Transfer {
                from: self.reward_pool_vault.to_account_info(),
                to: self.user_vault.to_account_info(),
            },
            signer_seeds,
        );

        transfer(cpi_ctx, reward_amount)?;

        // Update reward pool distribution
        self.reward_pool.total_distributed = self.reward_pool.total_distributed
            .checked_add(reward_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        self.reward_pool.last_distribution_time = current_time;

        msg!("Rewards transferred successfully: {} lamports", reward_amount);
        
        Ok(())
    }

    fn transfer_base_payout(&mut self, position: &PositionState, payout_amount: u64) -> Result<()> {
        // Validate trading pool balance
        let pool_vault_balance = self.trading_pool_vault.lamports();
        require!(
            pool_vault_balance >= payout_amount,
            ErrorCode::InsufficientPoolBalance
        );

        // Update trading pool accounting
        self.trading_pool.total_active_amount = self.trading_pool.total_active_amount
            .checked_sub(position.size)
            .ok_or(ErrorCode::MathOverflow)?;
        
        self.trading_pool.total_pool_amount = self.trading_pool.total_pool_amount
            .checked_sub(payout_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        // Transfer from trading pool vault to user vault
        let pool_vault_seeds = &[
            b"trading_pool_vault",
            self.trading_pool.to_account_info().key.as_ref(),
            &[self.trading_pool.vault_bump],
        ];
        let signer_seeds = &[&pool_vault_seeds[..]];
        
        let cpi_ctx = CpiContext::new_with_signer(
            self.system_program.to_account_info(),
            Transfer {
                from: self.trading_pool_vault.to_account_info(),
                to: self.user_vault.to_account_info(),
            },
            signer_seeds,
        );

        transfer(cpi_ctx, payout_amount)?;

        msg!("Base payout transferred: {} lamports", payout_amount);
        
        Ok(())
    }
}

#[event]
pub struct PositionClaimedEvent {
    pub position: Pubkey,
    pub user: Pubkey,
    pub base_payout: u64,
    pub time_rewards: u64,
    pub performance_rewards: u64,
    pub total_payout: u64,
}

#[event]
pub struct RewardsClaimedEvent {
    pub position: Pubkey,
    pub user: Pubkey,
    pub time_rewards: u64,
    pub performance_rewards: u64,
    pub total_rewards: u64,
    pub claim_timestamp: i64,
}