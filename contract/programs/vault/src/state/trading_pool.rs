use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct TradingPool {
    pub authority: Pubkey,         
    pub total_active_amount: u64,  
    pub total_pool_amount: u64,    
    pub bump: u8,                
    pub vault_bump: u8,            
}

