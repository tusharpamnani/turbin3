use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VaultState {
    pub authority: Pubkey,
    pub vault_bump: u8,
    pub state_bump: u8,
}

impl VaultState {
    pub const MIN_ORDER_AMOUNT: u64 = 100_000_000; 
}
