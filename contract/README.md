# Bound Market Core - Smart Contract

A Solana-based smart contract for binary options trading with price bound validation.

## Overview

This Anchor-based Solana program enables binary options trading with two position types:
- **STAY_IN**: Win if the BTC price stays within specified bounds for 24 hours
- **BREAKOUT**: Win if the BTC price breaks out of the specified bounds

The contract integrates with Pyth Network for reliable BTC price data and provides a complete lifecycle for trading positions from creation through settlement and claiming.

## Contract Components

### Main Features

- User deposit/withdrawal vault management
- Position creation with price bounds
- Price monitoring with Pyth Network oracle
- Automatic settlement based on price breakout conditions
- Time-weighted payout calculations
- Trading pool for position matching

### Accounts Structure

- **VaultState**: User-specific vault for managing funds
- **PositionState**: Represents an active trading position
- **TradingPool**: Central pool for matching positions

## Instructions

### Vault Management
- `initialize`: Create a new user vault
- `deposit`: Deposit funds into a vault
- `withdraw`: Withdraw funds from a vault
- `close`: Close a vault and recover rent

### Trading Pool
- `init_trading_pool`: Initialize the central trading pool for position matching

### Position Management
- `create_position`: Create a new trading position with price bounds
- `check_position`: Check if a position should be settled based on current price
- `claim_position`: Claim payout after position settlement

## Position Types

### StayIn Position
- Wins if BTC price remains within bounds for 24 hours
- Partial payout based on time held if price breaks out

### Breakout Position
- Wins if BTC price breaks out of the bounds at any time
- Payout decreases the longer it takes for breakout to occur

## Development Setup

### Prerequisites

- Rust toolchain
- Solana CLI tools
- Anchor framework

### Installation

```bash
# Install dependencies
yarn install

# Build the program
anchor build

# Deploy to localnet
anchor deploy
```

### Testing

The contract includes comprehensive tests for all functionality:

```bash
# Run all tests
yarn test

# Run position-specific tests
yarn test2
```

## Deployment

The contract is deployed to Solana DevNet at the following address:
```
vault: 8vk8aKGAr36nGEeruMsqqWfGnrmuWcHyAJh8izVWpWTY
```

## Technical Details

### Settlement Logic

Positions are settled based on:
1. Price bounds (upper and lower limits)
2. Time elapsed since position creation
3. Position type (StayIn vs Breakout)

The payout calculation is time-weighted, meaning:
- For StayIn positions, payout increases the longer the price stays in range
- For Breakout positions, payout decreases the longer it takes for breakout

### Integration with Backend

The contract is designed to work with the Bound Market Core backend service, which:
- Matches orders
- Creates on-chain positions
- Monitors positions for settlement
- Updates the database with position status

## Security Notes

- All operations with funds require signature verification
- Positions can only be claimed by their original creator
- Settlement data is verified using Pyth Network's price feed
- Time-based calculations use Solana's on-chain clock for accuracy 