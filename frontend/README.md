# Bound Market Core - Frontend

A modern, responsive web application for trading binary options on the Solana blockchain.

## Overview

This Next.js-based frontend provides a complete trading interface for the Bound Market platform. It enables users to predict Bitcoin price movements by placing orders for STAY_IN or BREAKOUT positions with specified price boundaries.

## Features

- **Real-time BTC price charts** with technical indicators and bound visualization
- **Order book** displaying active buy and sell orders
- **Position management** for tracking active and settled positions
- **Wallet integration** with Phantom and other Solana wallets
- **Responsive design** optimized for both desktop and mobile
- **Interactive UI** with real-time updates and notifications
- **Payout visualization** to help users understand position outcomes

## Main Components

- **Dashboard**: Central trading interface with charts, order book, and trading controls
- **Positions Page**: View and manage active and historical positions
- **Order Panel**: Interface for creating new orders with custom parameters
- **BTC Chart**: Real-time price chart with technical analysis tools
- **User Orders**: Displays a user's open and filled orders
- **User Positions**: Shows a user's active and settled positions

## Technology Stack

- **Next.js 15** with App Router and React 19
- **TailwindCSS 4** for styling
- **Solana Wallet Adapter** for wallet connections
- **Chart.js and Recharts** for data visualization
- **Supabase** for database integration
- **Framer Motion** for animations

## Setup

### Prerequisites

- Node.js 20 or higher
- Yarn or npm
- Solana wallet (Phantom recommended)

### Environment Variables

Create a `.env.local` file in the root directory with these variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SOLANA_RPC_URL=your_solana_rpc_url
NEXT_PUBLIC_BACKEND_URL=your_backend_url
```

### Installation

```bash
# Install dependencies
npm install
# or
yarn install

# Run the development server
npm run dev
# or
yarn dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Build and Deployment

```bash
# Build for production
npm run build
# or
yarn build

# Start the production server
npm run start
# or
yarn start
```

### Deployment on Vercel

The frontend is optimized for deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Set up the environment variables
3. Deploy with automatic builds and previews

## Integration

The frontend integrates with:

- **Bound Market Core Contract**: For on-chain position creation and management
- **Backend Service**: For order matching and position monitoring
- **Pyth Network**: For BTC price data

## Development Guidelines

- Follow the existing component structure
- Use TypeScript for all new components
- Maintain responsive design for all UI elements
- Test on both desktop and mobile viewports
