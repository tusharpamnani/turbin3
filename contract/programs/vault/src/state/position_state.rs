use anchor_lang::prelude::*;

#[account]
pub struct PositionState {
    pub user: Pubkey,
    pub order_id: u64,
    pub status: PositionStatus,
    pub is_long: bool,
    pub size: u64,
    pub entry_price: u64,
    pub collateral_amount: u64,
    pub leverage: u8,
    pub created_at: i64,
    pub expires_at: i64,
    pub settlement_data: Option<SettlementData>,
    pub unrealized_pnl: i64,
    pub liquidation_price: Option<u64>,
    pub last_health_check: i64,
    pub last_reward_claim: i64,
    pub claimable_rewards: u64,
    pub is_claimed: bool,
    pub total_rewards_earned: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SettlementData {
    pub settlement_time: i64,
    pub settlement_price: u64,
    pub payout_percentage: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PositionStatus {
    Active,
    Healthy,
    Warning,
    LiquidationRisk,
    Settled,
    Liquidated,
}

#[account]
pub struct VaultState {
    pub owner: Pubkey,
    pub vault_bump: u8,
    pub state_bump: u8,
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    pub active_positions: u32,
    pub total_rewards_claimed: u64,
}

#[account]
pub struct TradingPool {
    pub authority: Pubkey,
    pub total_pool_amount: u64,
    pub total_active_amount: u64,
    pub total_fees_collected: u64,
    pub vault_bump: u8,
    pub bump: u8,
}

#[account]
pub struct RewardPool {
    pub authority: Pubkey,
    pub total_reward_amount: u64,
    pub total_distributed: u64,
    pub base_reward_rate: u16, // basis points per hour
    pub performance_pool_amount: u64,
    pub last_distribution_time: i64,
    pub vault_bump: u8,
    pub bump: u8,
}

impl PositionState {
    pub const LEN: usize = 8 + // discriminator
        32 + // user
        8 + // order_id
        1 + // status
        1 + // is_long
        8 + // size
        8 + // entry_price
        8 + // collateral_amount
        1 + // leverage
        8 + // created_at
        8 + // expires_at
        25 + // settlement_data (1 + 8 + 8 + 1 + 7 padding)
        8 + // unrealized_pnl
        9 + // liquidation_price (1 + 8)
        8 + // last_health_check
        8 + // last_reward_claim
        8 + // claimable_rewards
        1 + // is_claimed
        8 + // total_rewards_earned
        1; // bump

    pub fn new(
        user: Pubkey,
        order_id: u64,
        is_long: bool,
        size: u64,
        entry_price: u64,
        collateral_amount: u64,
        leverage: u8,
        expires_at: i64,
        bump: u8,
    ) -> Self {
        let current_time = Clock::get().unwrap().unix_timestamp;
        Self {
            user,
            order_id,
            status: PositionStatus::Active,
            is_long,
            size,
            entry_price,
            collateral_amount,
            leverage,
            created_at: current_time,
            expires_at,
            settlement_data: None,
            unrealized_pnl: 0,
            liquidation_price: None,
            last_health_check: current_time,
            last_reward_claim: current_time,
            claimable_rewards: 0,
            is_claimed: false,
            total_rewards_earned: 0,
            bump,
        }
    }

    pub fn settle(
        &mut self,
        settlement_time: i64,
        settlement_price: u64,
        payout_percentage: u8,
    ) -> Result<()> {
        self.status = PositionStatus::Settled;
        self.settlement_data = Some(SettlementData {
            settlement_time,
            settlement_price,
            payout_percentage,
        });
        Ok(())
    }

    pub fn liquidate(
        &mut self,
        liquidation_time: i64,
        liquidation_price: u64,
    ) -> Result<()> {
        self.status = PositionStatus::Liquidated;
        self.settlement_data = Some(SettlementData {
            settlement_time: liquidation_time,
            settlement_price: liquidation_price,
            payout_percentage: 0, // Full loss on liquidation
        });
        Ok(())
    }

    pub fn claim(&mut self, claim_time: i64) -> Result<()> {
        self.is_claimed = true;
        self.last_reward_claim = claim_time;
        Ok(())
    }

    pub fn is_expired(&self, current_time: i64) -> bool {
        current_time >= self.expires_at
    }

    pub fn add_claimable_rewards(&mut self, amount: u64) -> Result<()> {
        self.claimable_rewards = self.claimable_rewards
            .checked_add(amount)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;
        Ok(())
    }
}

impl VaultState {
    pub const LEN: usize = 8 + // discriminator
        32 + // owner
        1 + // vault_bump
        1 + // state_bump
        8 + // total_deposited
        8 + // total_withdrawn
        4 + // active_positions
        8; // total_rewards_claimed
}

impl TradingPool {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        8 + // total_pool_amount
        8 + // total_active_amount
        8 + // total_fees_collected
        1 + // vault_bump
        1; // bump
}

impl RewardPool {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        8 + // total_reward_amount
        8 + // total_distributed
        2 + // base_reward_rate
        8 + // performance_pool_amount
        8 + // last_distribution_time
        1 + // vault_bump
        1; // bump
}