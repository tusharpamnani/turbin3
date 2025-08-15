use anchor_lang::prelude::*;


#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct SettlementData {
    pub settlement_time: i64,       
    pub settlement_price: u64,      
    pub payout_percentage: u8,      
}