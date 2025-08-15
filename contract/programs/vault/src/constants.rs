// BTC Price Feed ID from Pyth Network
pub const BTC_FEED_ID: &str = "0xe62df6c8b4c85fe16de9a89c73c0c1e8e7b41d0a16b3b0b0e8e6e8b0e8b0e8b0";

// Maximum age for price feeds (in seconds)
pub const MAXIMUM_AGE: u64 = 60; // 1 minute

// Trading fees in basis points (1 basis point = 0.01%)
pub const TRADING_FEE_BPS: u16 = 10; // 0.1% trading fee
pub const CLOSING_FEE_BPS: u16 = 5;  // 0.05% closing fee

// Minimum position sizes
pub const MIN_POSITION_SIZE: u64 = 1000; // Minimum position size in lamports

// Leverage limits
pub const MIN_LEVERAGE: u8 = 1;
pub const MAX_LEVERAGE: u8 = 100;

// Health score thresholds (in basis points)
pub const HEALTHY_THRESHOLD: u16 = 150;      // 1.5x collateral ratio
pub const WARNING_THRESHOLD: u16 = 120;      // 1.2x collateral ratio
pub const LIQUIDATION_THRESHOLD: u16 = 110;  // 1.1x collateral ratio

// Reward rates
pub const BASE_REWARD_RATE_BPS: u16 = 10; // 0.1% per hour base reward rate