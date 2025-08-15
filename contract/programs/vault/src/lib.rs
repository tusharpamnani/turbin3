#![allow(unexpected_cfgs)]

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("9bqQoWC9ovH3FFGzEAV2MJJkF1uNuS4EVGZ2SmRw17w8");

#[program]
pub mod vault {
    use super::*;

    // === Vault Management Instructions ===
    pub fn initialize(ctx: Context<Initialize>, initial_deposit: Option<u64>) -> Result<()> {
        ctx.accounts.initialize_vault(&ctx.bumps, initial_deposit)?;
        Ok(())
    }

    pub fn update_vault_status(ctx: Context<Initialize>, is_active: bool) -> Result<()> {
        ctx.accounts.update_vault_status(is_active)?;
        Ok(())
    }

    pub fn extend_lock_period(ctx: Context<Initialize>, additional_days: u32) -> Result<()> {
        ctx.accounts.extend_lock_period(additional_days)?;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64, pool_id: u64) -> Result<()> {
        ctx.accounts.deposit(amount, pool_id, &ctx.bumps)?;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64, is_full_withdrawal: bool) -> Result<()> {
        ctx.accounts.withdraw(amount, is_full_withdrawal)?;
        Ok(())
    }

    pub fn close(ctx: Context<Close>) -> Result<()> {
        ctx.accounts.close_vault()?;
        Ok(())
    }

    // === Trading Pool Instructions ===
    pub fn init_trading_pool(ctx: Context<InitTradingPool>, initial_deposit: Option<u64>) -> Result<()> {
        ctx.accounts.initialize(&ctx.bumps, initial_deposit)?;
        Ok(())
    }

    pub fn update_trading_pool_status(ctx: Context<InitTradingPool>, is_active: bool) -> Result<()> {
        ctx.accounts.update_pool_status(is_active)?;
        Ok(())
    }

    // === Position Management Instructions ===
    pub fn create_position(
        ctx: Context<CreatePosition>,
        position_type: PositionType,
        lower_bound: u64,
        upper_bound: u64,
        order_id: u64,
        amount: u64
    ) -> Result<()> {
        ctx.accounts.create_position(
            position_type, 
            lower_bound, 
            upper_bound, 
            order_id, 
            amount, 
            &ctx.bumps
        )?;
        Ok(())
    }
    
    pub fn check_position(ctx: Context<CheckPosition>) -> Result<()> {
        ctx.accounts.check_position(&ctx.bumps)?;
        Ok(())
    }
    
    pub fn claim_position(ctx: Context<ClaimPosition>) -> Result<()> {
        ctx.accounts.claim(&ctx.bumps)?;
        Ok(())
    }

    // === Liquidity Management Instructions ===
    pub fn add_liquidity(
        ctx: Context<Deposit>, 
        amount: u64, 
        pool_id: u64,
        lock_period_days: Option<u32>
    ) -> Result<()> {
        ctx.accounts.deposit(amount, pool_id, &ctx.bumps)?;
        Ok(())
    }

    pub fn remove_liquidity(
        ctx: Context<Withdraw>, 
        amount: u64, 
        is_full_withdrawal: bool
    ) -> Result<()> {
        ctx.accounts.withdraw(amount, is_full_withdrawal)?;
        Ok(())
    }

    // === Staking & Rewards Instructions ===
    pub fn stake_rewards(ctx: Context<StakeRewards>, amount: u64) -> Result<()> {
        ctx.accounts.stake(amount)?;
        Ok(())
    }

    pub fn unstake_rewards(ctx: Context<StakeRewards>, amount: u64) -> Result<()> {
        ctx.accounts.unstake(amount)?;
        Ok(())
    }

    pub fn claim_rewards(ctx: Context<StakeRewards>) -> Result<()> {
        ctx.accounts.claim_rewards()?;
        Ok(())
    }

    // === Pool Liquidity Management ===
    pub fn update_pool_liquidity(ctx: Context<UpdatePoolLiquidity>) -> Result<()> {
        ctx.accounts.update_liquidity_state()?;
        Ok(())
    }

    pub fn rebalance_pool(ctx: Context<RebalancePool>, target_ratio: u64) -> Result<()> {
        ctx.accounts.rebalance(target_ratio)?;
        Ok(())
    }

    // === Fee Management Instructions ===
    pub fn update_fee_structure(
        ctx: Context<UpdateFeeStructure>, 
        deposit_fee_bps: u64, 
        withdrawal_fee_bps: u64
    ) -> Result<()> {
        ctx.accounts.update_fees(deposit_fee_bps, withdrawal_fee_bps)?;
        Ok(())
    }

    pub fn collect_protocol_fees(ctx: Context<CollectFees>) -> Result<()> {
        ctx.accounts.collect_fees()?;
        Ok(())
    }

    // === Admin Instructions ===
    pub fn pause_protocol(ctx: Context<AdminControl>) -> Result<()> {
        ctx.accounts.pause_protocol()?;
        Ok(())
    }

    pub fn resume_protocol(ctx: Context<AdminControl>) -> Result<()> {
        ctx.accounts.resume_protocol()?;
        Ok(())
    }

    pub fn update_admin(ctx: Context<AdminControl>, new_admin: Pubkey) -> Result<()> {
        ctx.accounts.update_admin(new_admin)?;
        Ok(())
    }

    // === Emergency Instructions ===
    pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>) -> Result<()> {
        ctx.accounts.emergency_withdraw()?;
        Ok(())
    }

    pub fn freeze_account(ctx: Context<AdminControl>, account_to_freeze: Pubkey) -> Result<()> {
        ctx.accounts.freeze_account(account_to_freeze)?;
        Ok(())
    }

    pub fn unfreeze_account(ctx: Context<AdminControl>, account_to_unfreeze: Pubkey) -> Result<()> {
        ctx.accounts.unfreeze_account(account_to_unfreeze)?;
        Ok(())
    }

    // === View/Query Instructions (Read-only) ===
    pub fn get_position_info(ctx: Context<GetPositionInfo>) -> Result<PositionInfo> {
        ctx.accounts.get_position_info()
    }

    pub fn get_pool_stats(ctx: Context<GetPoolStats>) -> Result<PoolStats> {
        ctx.accounts.get_pool_stats()
    }

    pub fn get_user_rewards(ctx: Context<GetUserRewards>) -> Result<RewardsInfo> {
        ctx.accounts.get_user_rewards()
    }

    // === Migration Instructions ===
    pub fn migrate_position(
        ctx: Context<MigratePosition>, 
        old_position: Pubkey, 
        new_pool_id: u64
    ) -> Result<()> {
        ctx.accounts.migrate_position(old_position, new_pool_id)?;
        Ok(())
    }

    pub fn upgrade_account(ctx: Context<UpgradeAccount>) -> Result<()> {
        ctx.accounts.upgrade_account(&ctx.bumps)?;
        Ok(())
    }
}

// === Return Types for View Functions ===
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PositionInfo {
    pub owner: Pubkey,
    pub amount: u64,
    pub shares: u64,
    pub lock_end_time: i64,
    pub is_active: bool,
    pub pending_rewards: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PoolStats {
    pub total_liquidity: u64,
    pub available_liquidity: u64,
    pub total_shares: u64,
    pub apy: u64, // Annual Percentage Yield in basis points
    pub fee_rate: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RewardsInfo {
    pub total_earned: u64,
    pub pending_rewards: u64,
    pub staked_amount: u64,
    pub last_claim_time: i64,
}