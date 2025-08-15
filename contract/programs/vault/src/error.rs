use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Program is currently paused")]
    ProgramPaused,
    
    #[msg("Deposit amount is below minimum allowed")]
    AmountTooSmall,
    
    #[msg("Only the authority can perform this action")]
    UnauthorizedAccess,
    
    #[msg("Insufficient funds in vault")]
    InsufficientFunds,
    
    #[msg("Withdrawal not authorized")]
    UnauthorizedWithdrawal,

//    <-----------------Position------------->

    #[msg("Position has already been settled")]
    PositionAlreadySettled,
    
    #[msg("Position has not been settled yet")]
    PositionNotSettled,
    
    #[msg("Invalid price range")]
    InvalidRange,
    
    #[msg("Order ID not found")]
    OrderNotFound,

    #[msg("Price data is too stale.")]
    StalePriceFeed,

    #[msg("Failed to load price feed.")]
    InvalidPriceFeed,

    #[msg("Please Verify price update!")]
    UnverifiedPriceUpdate,

    //    <-----------------Pool------------->

    #[msg("Insufficient balance in trading pool")]
    InsufficientPoolBalance,

    #[msg("Math overflow occurred")]
    MathOverflow,

      #[msg("Insufficient balance in trading vault")]
    InsufficientVaultBalance,

    #[msg("Division by zero")]
    DivisionByZero,
    
    #[msg("Invalid position status")]
    InvalidPositionStatus,
    
    #[msg("Insufficient collateral")]
    InsufficientCollateral,
    
    #[msg("Invalid leverage")]
    InvalidLeverage,
    

    


}