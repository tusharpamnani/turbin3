# Bound Market Core - Backend Service

A production-ready microservice for creating and managing binary options trading positions on the Solana blockchain.

## Features

- Order matching service for trading binary options
- Position monitoring service for tracking and settling positions
- BTC price feed integration with Pyth Network
- Automatic bound calculation based on percentage and current BTC price
- Order book management with matchmaking algorithm
- Position settlement based on price breakout conditions
- Database integration with Supabase
- Health check endpoint with service status

## Setup

### Prerequisites

- Node.js 18 or higher
- Docker (for containerized deployment)
- Solana private key (for signing transactions)
- Supabase account (for database)

### Environment Variables

Create a `.env` file in the root directory with these variables:

```
SOLANA_PRIVATE_KEY=["your","private","key","array"]
SOLANA_RPC_URL=your_solana_rpc_url
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
PORT=8080
```

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run locally
npm start

# Run with hot reload for development
npm run dev
```

### Services

The backend consists of two main services:

1. **Position Monitor** - Monitors positions for price breakouts and settlement conditions
   ```bash
   npm run position-monitor
   ```

2. **Order Matching Service** - Matches buy and sell orders and creates positions
   ```bash
   npm run order-matching
   ```

## API Endpoints

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "OK",
  "services": {
    "orderMatching": true,
    "positionMonitor": true
  }
}
```

## Technical Details

### Position Monitor

The position monitor service:
- Checks positions for settlement conditions
- Monitors BTC price for bound violations (price breakouts)
- Updates position status on-chain
- Syncs position data between the blockchain and database
- Handles payout calculations based on settlement data

### Order Matching Service

The order matching service:
- Processes open orders from the database
- Matches long (BREAKOUT) and short (STAY_IN) orders
- Creates on-chain positions for matched orders
- Updates order fill status in the database
- Interfaces with Pyth Network for price data

### Integrations

- **Pyth Network**: BTC price feed for position bounds and settlement
- **Solana Blockchain**: On-chain position creation and settlement
- **Supabase**: Database for order book and position tracking

## Deployment

### Docker

```bash
# Build Docker image
docker build -t bound-market-backend .

# Run container
docker run -p 8080:8080 --env-file .env bound-market-backend
```
