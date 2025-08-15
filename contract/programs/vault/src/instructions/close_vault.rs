use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2, VerificationLevel};
use crate::state::{PositionState, PositionStatus, VaultState, TradingPool, SettlementData};
use crate::error::ErrorCode;
use crate::constants::{BTC_FEED_ID, MAXIMUM_AGE, TRADING_FEE_BPS, CLOSING_FEE_BPS};

#[derive(Accounts)]
#[instruction(order_id: u64)]
pub struct ClosePosition<'info> {
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
        constraint = position.status != PositionStatus::Settled @ ErrorCode::PositionAlreadySettled,
        constraint = position.status != PositionStatus::Liquidated @ ErrorCode::PositionLiquidated,
    )]
    pub position: Account<'info, PositionState>,
    
    #[account(
        mut,
        seeds = [b"vault_state", user.key().as_ref()],
        bump = vault_state.state_bump,
    )]
    pub vault_state: Account<'info, VaultState>,
    
    #[account(
        mut,
        seeds = [b"vault", vault_state.key().as_ref()],
        bump = vault_state.vault_bump
    )]
    pub vault: SystemAccount<'info>,
    
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
        owner = pyth_solana_receiver_sdk::ID,
        constraint = price_update.verification_level == VerificationLevel::Full,
    )]
    pub price_update: Account<'info, PriceUpdateV2>,
    
    pub system_program: Program<'info, System>
}

impl<'info> ClosePosition<'info> {
    pub fn close_position(&mut self, _bumps: &ClosePositionBumps) -> Result<()> {
        let position = &mut self.position;
        let clock = Clock::get()?;
        
        msg!("=== POSITION SETTLEMENT PROCESS ===");
        msg!("Position order_id: {}", position.order_id);
        msg!("Position size: {}", position.size);
        msg!("Entry price: {}", position.entry_price);
        msg!("Collateral amount: {}", position.collateral_amount);
        msg!("Is long: {}", position.is_long);

        // Verify price update
        require!(
            self.price_update.verification_level == VerificationLevel::Full,
            ErrorCode::UnverifiedPriceUpdate
        );

        // Get current market price
        let price_data = self.price_update.get_price_no_older_than(
            &clock,
            MAXIMUM_AGE,
            &get_feed_id_from_hex(BTC_FEED_ID)?,
        ).map_err(|_| error!(ErrorCode::StalePriceFeed))?;

        let current_price = price_data.price as u64;
        let current_time = clock.unix_timestamp;
        
        msg!("Current market price: {}", current_price);

        // Calculate current position value
        let position_value = self.calculate_current_position_value(position, current_price)?;
        msg!("Current position value: {}", position_value);

        // Account for all fees & costs
        let total_fees = self.calculate_total_fees(position, position_value)?;
        msg!("Total fees: {}", total_fees);

        // Calculate final P&L
        let final_pnl = self.calculate_final_pnl(position, current_price, total_fees)?;
        msg!("Final P&L: {}", final_pnl);

        // Determine settlement amount
        let settlement_result = self.determine_settlement_amount(position, final_pnl)?;
        msg!("Settlement amount: {}", settlement_result.settlement_amount);
        msg!("Settlement type: {:?}", settlement_result.settlement_type);

        // Execute settlement based on P&L
        match settlement_result.settlement_type {
            SettlementType::Positive => {
                self.handle_positive_settlement(position, settlement_result.settlement_amount, current_time, current_price)?;
            },
            SettlementType::Negative => {
                self.handle_negative_settlement(position, settlement_result.settlement_amount, current_time, current_price)?;
            }
        }

        // Close position account (mark as settled)
        self.close_position_account(position, current_time, current_price, settlement_result.payout_percentage)?;

        // Return rent to user (if position account is being closed)
        self.return_rent_to_user()?;

        // Update pool active positions
        self.update_pool_active_positions(position)?;

        // Log final performance
        self.log_final_performance(position, current_price, final_pnl, settlement_result.settlement_amount)?;

        emit!(PositionClosedEvent {
            position: position.key(),
            user: position.user,
            order_id: position.order_id,
            entry_price: position.entry_price,
            exit_price: current_price,
            final_pnl,
            settlement_amount: settlement_result.settlement_amount,
            total_fees,
            is_profitable: final_pnl > 0,
            timestamp: current_time,
        });

        msg!("=== POSITION SUCCESSFULLY CLOSED ===");
        Ok(())
    }

    fn calculate_current_position_value(&self, position: &PositionState, current_price: u64) -> Result<u64> {
        // Position value = size * current_price
        let position_value = position.size
            .checked_mul(current_price)
            .ok_or(ErrorCode::MathOverflow)?;
        
        Ok(position_value)
    }

    fn calculate_total_fees(&self, position: &PositionState, position_value: u64) -> Result<u64> {
        // Trading fee (applied to position value)
        let trading_fee = position_value
            .checked_mul(TRADING_FEE_BPS as u64)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::DivisionByZero)?;

        // Closing fee (applied to position size)
        let closing_fee = position.size
            .checked_mul(CLOSING_FEE_BPS as u64)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::DivisionByZero)?;

        let total_fees = trading_fee
            .checked_add(closing_fee)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(total_fees)
    }

    fn calculate_final_pnl(&self, position: &PositionState, current_price: u64, total_fees: u64) -> Result<i64> {
        let entry_price = position.entry_price;
        let position_size = position.size;

        // Calculate raw P&L based on price movement
        let price_diff = if position.is_long {
            current_price as i64 - entry_price as i64
        } else {
            entry_price as i64 - current_price as i64
        };

        let raw_pnl = price_diff
            .checked_mul(position_size as i64)
            .ok_or(ErrorCode::MathOverflow)?;

        // Subtract fees from P&L
        let final_pnl = raw_pnl
            .checked_sub(total_fees as i64)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(final_pnl)
    }

    fn determine_settlement_amount(&self, position: &PositionState, final_pnl: i64) -> Result<SettlementResult> {
        let collateral = position.collateral_amount as i64;
        
        if final_pnl >= 0 {
            // Positive P&L: User gets collateral + profits
            let settlement_amount = collateral
                .checked_add(final_pnl)
                .ok_or(ErrorCode::MathOverflow)? as u64;
            
            let payout_percentage = if collateral > 0 {
                ((settlement_amount as u128 * 100) / position.collateral_amount as u128) as u8
            } else {
                100
            };

            Ok(SettlementResult {
                settlement_amount,
                settlement_type: SettlementType::Positive,
                payout_percentage,
            })
        } else {
            // Negative P&L: Partial or no recovery
            let loss_amount = final_pnl.abs() as u64;
            
            if loss_amount >= position.collateral_amount {
                // Total loss
                Ok(SettlementResult {
                    settlement_amount: 0,
                    settlement_type: SettlementType::Negative,
                    payout_percentage: 0,
                })
            } else {
                // Partial recovery
                let settlement_amount = position.collateral_amount
                    .checked_sub(loss_amount)
                    .ok_or(ErrorCode::MathOverflow)?;
                
                let payout_percentage = ((settlement_amount as u128 * 100) / position.collateral_amount as u128) as u8;

                Ok(SettlementResult {
                    settlement_amount,
                    settlement_type: SettlementType::Negative,
                    payout_percentage,
                })
            }
        }
    }

    fn handle_positive_settlement(&mut self, position: &PositionState, settlement_amount: u64, current_time: i64, current_price: u64) -> Result<()> {
        msg!("Handling positive settlement");
        
        // Transfer profits + collateral from trading pool to user vault
        if settlement_amount > 0 {
            let pool_vault_balance = self.trading_pool_vault.lamports();
            require!(
                pool_vault_balance >= settlement_amount,
                ErrorCode::InsufficientPoolBalance
            );

            let pool_seeds = &[
                b"trading_pool_vault",
                self.trading_pool.to_account_info().key.as_ref(),
                &[self.trading_pool.vault_bump],
            ];
            let signer_seeds = &[&pool_seeds[..]];

            let cpi_ctx = CpiContext::new_with_signer(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.trading_pool_vault.to_account_info(),
                    to: self.vault.to_account_info(),
                },
                signer_seeds,
            );

            transfer(cpi_ctx, settlement_amount)?;
            
            // Update trading pool amounts
            self.trading_pool.total_pool_amount = self.trading_pool.total_pool_amount
                .checked_sub(settlement_amount)
                .ok_or(ErrorCode::MathOverflow)?;
        }

        Ok(())
    }

    fn handle_negative_settlement(&mut self, position: &PositionState, settlement_amount: u64, current_time: i64, current_price: u64) -> Result<()> {
        msg!("Handling negative settlement - partial/no recovery");
        
        // Only transfer remaining collateral if any
        if settlement_amount > 0 {
            let pool_vault_balance = self.trading_pool_vault.lamports();
            require!(
                pool_vault_balance >= settlement_amount,
                ErrorCode::InsufficientPoolBalance
            );

            let pool_seeds = &[
                b"trading_pool_vault",
                self.trading_pool.to_account_info().key.as_ref(),
                &[self.trading_pool.vault_bump],
            ];
            let signer_seeds = &[&pool_seeds[..]];

            let cpi_ctx = CpiContext::new_with_signer(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.trading_pool_vault.to_account_info(),
                    to: self.vault.to_account_info(),
                },
                signer_seeds,
            );

            transfer(cpi_ctx, settlement_amount)?;
        }

        // Update pool accounting - losses remain in pool
        let collateral_loss = position.collateral_amount
            .checked_sub(settlement_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        // Pool keeps the losses, only reduce by what was actually paid out
        self.trading_pool.total_pool_amount = self.trading_pool.total_pool_amount
            .checked_sub(settlement_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(())
    }

    fn close_position_account(&mut self, position: &mut PositionState, current_time: i64, current_price: u64, payout_percentage: u8) -> Result<()> {
        msg!("Closing position account");
        
        // Mark position as settled
        position.settle(current_time, current_price, payout_percentage)?;
        
        Ok(())
    }

    fn return_rent_to_user(&mut self) -> Result<()> {
        // The rent will be automatically returned when the account is closed
        // This is handled by the `close = user` constraint in the account definition
        msg!("Rent will be returned to user automatically");
        Ok(())
    }

    fn update_pool_active_positions(&mut self, position: &PositionState) -> Result<()> {
        msg!("Updating pool active positions");
        
        // Reduce active amount by position size
        self.trading_pool.total_active_amount = self.trading_pool.total_active_amount
            .checked_sub(position.size)
            .ok_or(ErrorCode::MathOverflow)?;

        // Update vault state
        self.vault_state.active_positions = self.vault_state.active_positions
            .checked_sub(1)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(())
    }

    fn log_final_performance(&self, position: &PositionState, exit_price: u64, final_pnl: i64, settlement_amount: u64) -> Result<()> {
        msg!("=== FINAL PERFORMANCE LOG ===");
        msg!("Entry Price: {}", position.entry_price);
        msg!("Exit Price: {}", exit_price);
        msg!("Position Size: {}", position.size);
        msg!("Collateral: {}", position.collateral_amount);
        msg!("Final P&L: {}", final_pnl);
        msg!("Settlement Amount: {}", settlement_amount);
        msg!("ROI: {}%", if position.collateral_amount > 0 {
            (final_pnl * 100) / position.collateral_amount as i64
        } else {
            0
        });
        
        Ok(())
    }
}

#[derive(Debug)]
struct SettlementResult {
    settlement_amount: u64,
    settlement_type: SettlementType,
    payout_percentage: u8,
}

#[derive(Debug)]
enum SettlementType {
    Positive,
    Negative,
}

#[event]
pub struct PositionClosedEvent {
    pub position: Pubkey,
    pub user: Pubkey,
    pub order_id: u64,
    pub entry_price: u64,
    pub exit_price: u64,
    pub final_pnl: i64,
    pub settlement_amount: u64,
    pub total_fees: u64,
    pub is_profitable: bool,
    pub timestamp: i64,
}