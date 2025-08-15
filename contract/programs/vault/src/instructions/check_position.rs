use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2, VerificationLevel};
use crate::state::{PositionState, PositionStatus};
use crate::error::ErrorCode;
use crate::constants::{BTC_FEED_ID, MAXIMUM_AGE};

#[derive(Accounts)]
#[instruction(order_id: u64)]
pub struct CheckPosition<'info> {
    /// CHECK: Only used for seed and validation
    pub user: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [
            b"position".as_ref(),
            user.key().as_ref(),
            &order_id.to_le_bytes()
        ],
        bump = position.bump,
        constraint = position.user == user.key() && position.order_id == order_id
    )]
    pub position: Account<'info, PositionState>,

    #[account(
        owner = pyth_solana_receiver_sdk::ID,
        constraint = price_update.verification_level == VerificationLevel::Full,
    )]
    pub price_update: Account<'info, PriceUpdateV2>
}

impl<'info> CheckPosition<'info> {
    pub fn check_position(&mut self, _bumps: &CheckPositionBumps) -> Result<()> {
        let position = &mut self.position;

        // Only check active positions
        if position.status != PositionStatus::Active {
            return Ok(());
        }

        let clock = Clock::get()?;

        // Verify price update is valid
        require!(
            self.price_update.verification_level == VerificationLevel::Full,
            ErrorCode::UnverifiedPriceUpdate
        );

        // Fetch current market price
        let price_data = self.price_update.get_price_no_older_than(
            &clock,
            MAXIMUM_AGE,
            &get_feed_id_from_hex(BTC_FEED_ID)?,
        ).map_err(|_| error!(ErrorCode::StalePriceFeed))?;

        let current_price = price_data.price as u64;
        let current_time = clock.unix_timestamp;

        // Calculate health score (Collateral / Required Margin)
        let health_score = self.calculate_health_score(position, current_price)?;

        // Perform health score analysis and update status
        let new_status = if health_score > 150 { // > 1.5
            PositionStatus::Healthy
        } else if health_score >= 120 { // 1.2-1.5
            PositionStatus::Warning
        } else { // < 1.2
            PositionStatus::LiquidationRisk
        };

        // Update position status if changed
        if position.status != new_status {
            position.status = new_status;
            
            emit!(PositionHealthUpdateEvent {
                position: position.key(),
                user: position.user,
                old_status: position.status,
                new_status,
                health_score,
                current_price,
                timestamp: current_time,
            });
        }

        // Calculate unrealized P&L for all statuses
        let unrealized_pnl = self.calculate_unrealized_pnl(position, current_price)?;
        position.unrealized_pnl = unrealized_pnl;

        // Handle liquidation risk
        if new_status == PositionStatus::LiquidationRisk {
            self.handle_liquidation_risk(position, current_time, current_price)?;
        }

        // Return position metrics
        emit!(PositionMetricsEvent {
            position: position.to_account_info().key(),
            user: position.user,
            health_score,
            unrealized_pnl,
            current_price,
            status: new_status,
            timestamp: current_time,
        });

        Ok(())
    }

    fn calculate_health_score(&self, position: &PositionState, current_price: u64) -> Result<u16> {
        // Get current collateral value
        let collateral_value = position.collateral_amount;
        
        // Calculate required margin based on position size and current market conditions
        let position_value = position.size.checked_mul(current_price)
            .ok_or(ErrorCode::MathOverflow)?;
        
        // Required margin is typically a percentage of position value (e.g., 10% for 10x leverage)
        let required_margin = position_value.checked_div(position.leverage as u64)
            .ok_or(ErrorCode::MathOverflow)?;

        // Health score = (Collateral / Required Margin) * 100
        let health_score = collateral_value.checked_mul(100)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(required_margin)
            .ok_or(ErrorCode::DivisionByZero)? as u16;

        Ok(health_score)
    }

    fn calculate_unrealized_pnl(&self, position: &PositionState, current_price: u64) -> Result<i64> {
        let entry_price = position.entry_price;
        let position_size = position.size;

        let price_diff = if position.is_long {
            current_price as i64 - entry_price as i64
        } else {
            entry_price as i64 - current_price as i64
        };

        let unrealized_pnl = price_diff.checked_mul(position_size as i64)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(unrealized_pnl)
    }

    fn handle_liquidation_risk(&self, position: &mut PositionState, current_time: i64, current_price: u64) -> Result<()> {
        // Mark position for potential liquidation
        position.liquidation_price = Some(current_price);
        position.last_health_check = current_time;

        emit!(LiquidationRiskEvent {
            position: position.key(),
            user: position.user,
            current_price,
            collateral_amount: position.collateral_amount,
            required_margin: position.size * current_price / position.leverage as u64,
            timestamp: current_time,
        });

        Ok(())
    }
}

#[event]
pub struct PositionHealthUpdateEvent {
    pub position: Pubkey,
    pub user: Pubkey,
    pub old_status: PositionStatus,
    pub new_status: PositionStatus,
    pub health_score: u16,
    pub current_price: u64,
    pub timestamp: i64,
}

#[event]
pub struct PositionMetricsEvent {
    pub position: Pubkey,
    pub user: Pubkey,
    pub health_score: u16,
    pub unrealized_pnl: i64,
    pub current_price: u64,
    pub status: PositionStatus,
    pub timestamp: i64,
}

#[event]
pub struct LiquidationRiskEvent {
    pub position: Pubkey,
    pub user: Pubkey,
    pub current_price: u64,
    pub collateral_amount: u64,
    pub required_margin: u64,
    pub timestamp: i64,
}