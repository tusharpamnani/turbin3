"use client";
import Image from 'next/image';
import BTCChart from './BTCChart';
import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { supabaseAdmin } from '../lib/supabaseClient';
import PlaceOrderPanel from './PlaceOrderPanel';
import { placeOrder } from '../services/orderbook';
import UserOrders from './UserOrders';
import { useNotifications } from '../context/NotificationContext';
import logo from "../../public/icon0.svg";
import { fetchUserBalance } from '../services/balance';
import { fetchUserPositions, Position } from '../services/positions';
import OrderBook from './OrderBook';
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { connection } from "../constants/constants";

interface DashboardProps {
  onBackClick: () => void;
  onPositionsClick: () => void;
}


const Dashboard = ({ onBackClick, onPositionsClick}: DashboardProps) => {

  const [percent, setPercent] = useState(1.5);
  const [price, setPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bounds, setBounds] = useState<{ upper: number | null; lower: number | null }>({
    upper: null,
    lower: null,
  });
  const [priceChange, setPriceChange] = useState<number | null>(null);
  const [refreshOrdersCounter, setRefreshOrdersCounter] = useState(0);
  const [balance, setBalance] = useState<number>(0);
  const [predictionsMade, setPredictionsMade] = useState<number>(0);
  const [orderLoading, setOrderLoading] = useState(false);
  const [activePositions, setActivePositions] = useState<Position[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [successRate, setSuccessRate] = useState<number>(0);
  const wallet = useWallet();
  const { showNotification } = useNotifications();

  // Function to refresh orders list
  const refreshOrders = () => {
    setRefreshOrdersCounter(prev => prev + 1);
  };

  // Function to get wallet balance
  const getWalletBalance = async () => {
    if (!wallet.publicKey) return 0;
    
    try {
      const balance = await connection.getBalance(wallet.publicKey);
      return balance / LAMPORTS_PER_SOL; // Convert lamports to SOL
    } catch (err) {
      console.error('Error fetching wallet balance:', err);
      return 0;
    }
  };

  // Refresh balance when wallet changes or new order is placed
  useEffect(() => {
    if (wallet.publicKey) {
      // Fetch user's wallet balance
      getWalletBalance().then(walletBalance => {
        setBalance(walletBalance);
      });

      // Check for active positions
      fetchUserPositions(wallet).then(({ positions }) => {
        if (positions) {
          // Find all active positions
          const active = positions.filter(p => p.status === 'ACTIVE');
          setActivePositions(active);
          
          // Select first position by default if available and none is currently selected
          if (active.length > 0 && !selectedPosition) {
            setSelectedPosition(active[0]);
          } else if (active.length === 0) {
            setSelectedPosition(null);
        }

          // Count total positions
          setPredictionsMade(positions.length);
          
          // Calculate success rate
          const settledOrClaimedPositions = positions.filter(p => p.status === 'SETTLED' || p.status === 'CLAIMED');
          
          // Calculate win count (positions with payout_amount > amount)
          const winCount = settledOrClaimedPositions.filter(p => {
            if (p.status === 'CLAIMED' && p.payout_amount) {
              return p.payout_amount > p.amount;
            } else if (p.status === 'SETTLED' && p.payout_percentage) {
              // For settled but not claimed, estimate from payout percentage
              return p.payout_percentage > 100;
            }
            return false;
          }).length;
          
          // Calculate success rate
          const calculatedSuccessRate = settledOrClaimedPositions.length > 0 
            ? (winCount / settledOrClaimedPositions.length) * 100 
            : 0;
          
          setSuccessRate(calculatedSuccessRate);
        }
      });
    } else {
      setBalance(0);
      setPredictionsMade(0);
      setActivePositions([]);
      setSelectedPosition(null);
      setSuccessRate(0);
    }
  }, [wallet.publicKey, refreshOrdersCounter]);

  // Fetch BTC price on load and periodically
  useEffect(() => {
    const fetchPrice = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          'https://hermes.pyth.network/v2/updates/price/latest?ids[]=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'
        );
        
        if (!res.ok) {
          throw new Error(`API request failed with status: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (data && data.parsed && data.parsed[0] && data.parsed[0].price) {
          const pythPrice = data.parsed[0].price;
          const scaledPrice = pythPrice.price * Math.pow(10, pythPrice.expo);
          const roundedPrice = parseFloat(scaledPrice.toFixed(2));
          
          if (price > 0) {
            const change = ((roundedPrice - price) / price) * 100;
            setPriceChange(parseFloat(change.toFixed(2)));
          } else {
            setPriceChange(0);
          }
          
          setPrice(roundedPrice);
          
          // Only calculate bounds if there's no selected position
          // If there's a selected position, we'll use its bounds
          if (!selectedPosition) {
            const upper = roundedPrice * (1 + percent / 100);
            const lower = roundedPrice * (1 - percent / 100);
            
            setBounds({ 
              upper: parseFloat(upper.toFixed(2)), 
              lower: parseFloat(lower.toFixed(2)) 
            });
          }
          
          setIsLoading(false);
        } else {
          console.error('Invalid Pyth price data format:', data);
          throw new Error('Invalid price data format');
        }
      } catch (e) {
        console.error('Failed to fetch price:', e);
        setError(e instanceof Error ? e.message : 'Failed to fetch price');
        setIsLoading(false);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 1000); // Fetch every 5s
    return () => clearInterval(interval);
  }, [percent, selectedPosition]); // Remove price from dependencies to avoid unnecessary requests
  
  // Calculate bounds when selectedPosition changes
  useEffect(() => {
    if (!selectedPosition && price > 0) {
      // When switching to default, recalculate bounds based on current price
      const upper = price * (1 + percent / 100);
      const lower = price * (1 - percent / 100);
      
      setBounds({ 
        upper: parseFloat(upper.toFixed(2)), 
        lower: parseFloat(lower.toFixed(2)) 
      });
    }
  }, [selectedPosition, price, percent]);

  // Handle order placement
  const handlePlaceOrder = async (order: { side: 'LONG' | 'SHORT'; amount: number; percent: number }) => {
    if (!wallet.publicKey) {
      showNotification('error', 'Wallet not connected', 'Please connect your wallet to place orders.');
      return;
    }

    try {
      setOrderLoading(true);
      const result = await placeOrder({
        wallet,
        amount: order.amount,
        side: order.side,
        points: order.percent,
      });

      setOrderLoading(false);

      if (!result.success) {
        throw new Error(result.error || 'Failed to place order');
      }
      
      // Increment the refresh counter to trigger order list refresh
      refreshOrders();
      
      // Show success notification with transaction hash
      showNotification(
        'success',
        `${order.side == 'LONG' ? 'BREAK OUT' : 'STAY IN'} order placed successfully!`,
        `Amount: ◎${order.amount} | Volatility: ${order.percent.toFixed(1)}% | Txn: ${result.txHash?.substring(0, 8)}...${result.txHash?.substring(result.txHash.length - 8) || ''}`,
        true,
        6000
      );
    } catch (err: any) {
      setOrderLoading(false);
      console.error('Order error:', err);
      showNotification('error', 'Error placing order', err.message);
    }
  };

  // Create a position selector UI
  const PositionSelector = () => {
    if (activePositions.length === 0) return null;
    
    // Function to handle position selection
    const handlePositionSelect = (position: Position | null) => {
      setSelectedPosition(position);
      
      // If selecting null (Default), recalculate bounds based on current price
      if (!position && price > 0) {
        const upper = price * (1 + percent / 100);
        const lower = price * (1 - percent / 100);
        
        setBounds({ 
          upper: parseFloat(upper.toFixed(2)), 
          lower: parseFloat(lower.toFixed(2)) 
        });
      }
    };
    
    return (
      <div className="mb-4 p-3 bg-zinc-700 rounded-lg">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Active Positions</h4>
        <div className="flex flex-wrap gap-2">
          {activePositions.map(position => (
            <button
              key={position.id}
              onClick={() => handlePositionSelect(position)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                selectedPosition?.id === position.id
                  ? position.position_type === 0
                    ? 'bg-green-500 text-white' // SHORT
                    : 'bg-red-500 text-white' // LONG
                    
                  : 'bg-zinc-600 text-zinc-300 hover:bg-zinc-500'
              }`}
            >
              #{position.id} - {position.position_type === 0 ? 'STAY IN' : 'BREAK OUT'} 
              (${position.lower_bound.toFixed(0)} - ${position.upper_bound.toFixed(0)})
            </button>
          ))}
          <button
            onClick={() => handlePositionSelect(null)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              !selectedPosition
                ? 'bg-blue-500 text-white'
                : 'bg-zinc-600 text-zinc-300 hover:bg-zinc-500'
            }`}
          >
            Default
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Dashboard Content */}
      <div className="min-h-screen">
        {/* Header */}
       <header className="p-6 border-b border-zinc-800">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-zinc-700">
                 <Image src={logo} alt="logo" />
              </div>
              <span className="text-xl font-bold">Bound Market</span>
              
              {/* Add Positions button here */}
              <button
                onClick={onPositionsClick}
                className="ml-4 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 hover:cursor-pointer text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Positions
              </button>
            </div>
            <div className="flex items-center gap-4">
              <WalletMultiButton className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all duration-200" />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6">
          <div className="max-w-7xl mx-auto">
            {/* Back button */}
            <button 
              className="mb-6 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors hover:cursor-pointer"
              onClick={onBackClick}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Home
            </button>


            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-zinc-800 p-6 rounded-xl border border-zinc-700">
                <div className="flex justify-between mb-4">
                  <div>
                    <h3 className="text-zinc-400 text-sm">Balance</h3>
                    <p className="text-2xl font-semibold">{balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span className="text-purple-400">SOL</span></p>
                  </div>
                  <div className="w-10 h-10 bg-purple-400/10 rounded-full flex items-center justify-center">
                    <span className="text-purple-400 text-xl font-bold">◎</span>
                  </div>
                </div>
                {wallet.publicKey ? (
                  <div className="text-xs text-zinc-400 overflow-hidden text-ellipsis">
                    {wallet.publicKey.toBase58().substring(0, 8)}...{wallet.publicKey.toBase58().substring(wallet.publicKey.toBase58().length - 8)}
                    <span className="ml-2 text-zinc-500">(Devnet)</span>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-400">
                    Connect wallet to view
                  </div>
                )}
              </div>
              
              <div className="bg-zinc-800 p-6 rounded-xl border border-zinc-700">
                <div className="flex justify-between mb-4">
                  <div>
                    <h3 className="text-zinc-400 text-sm">Predictions Made</h3>
                    <p className="text-2xl font-semibold">{predictionsMade}</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-400/10 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-center">
                  {predictionsMade > 0 ? (
                    <span className="text-zinc-400 text-sm">Active: {activePositions.length}</span>
                  ) : (
                    <span className="text-zinc-400 text-sm">No predictions yet</span>
                  )}
                </div>
              </div>
              
              <div className="bg-zinc-800 p-6 rounded-xl border border-zinc-700">
                <div className="flex justify-between mb-4">
                  <div>
                    <h3 className="text-zinc-400 text-sm">Success Rate</h3>
                    <p className="text-2xl font-semibold">{successRate.toFixed(1)}%</p>
                  </div>
                  <div className="w-10 h-10 bg-purple-400/10 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-center">
                  {predictionsMade > 0 ? (
                    <span className="text-zinc-400 text-sm">Based on {predictionsMade} positions</span>
                  ) : (
                    <span className="text-zinc-400 text-sm">No positions yet</span>
                  )}
                </div>
              </div>
            </div>

            {/* Main Dashboard Panel */}
            <div className="bg-zinc-800 p-6 rounded-xl border border-zinc-700 mb-8">
              

              {/* Display active position selector if there are any */}
              {activePositions.length > 0 && <PositionSelector />}

              {/* Chart layout with order book */}
              <div className="flex flex-col lg:flex-row gap-6 mb-6">
                {/* Main chart area - left side */}
                <div className="lg:w-3/4">
                  <div className="h-[500px] w-full mb-6">
                    <BTCChart 
                      bounds={bounds} 
                      price={price}
                      activePositions={activePositions.length > 0 ? activePositions : null}
                      selectedPosition={selectedPosition}
                    />
                  </div>
                </div>

                {/* Order book - right side */}
                <div className="lg:w-1/4">
                  <OrderBook refreshTrigger={refreshOrdersCounter} />
                </div>
              </div>

              {/* Volatility Range Controls and Price Info Cards - Below chart */}
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Volatility Range Card - Left */}
                <div className="lg:w-3/4 bg-zinc-700 p-4 rounded-xl border border-zinc-600 flex flex-col">
                  <div className="flex-1">
                    <PlaceOrderPanel
                      percent={percent}
                      setPercent={setPercent}
                      isLoading={orderLoading}
                      onPlaceOrder={async (order) => {
                        await handlePlaceOrder(order);
                      }}
                    />
                  </div>
                </div>
                
                {/* Price and Bounds Cards - Right */}
                <div className="lg:w-1/4 flex flex-col gap-2">
                  {/* Current BTC Price Card */}
                  <div className="bg-zinc-700 p-5 rounded-xl border border-zinc-600 flex-1 flex flex-col justify-center">
                    <h3 className="text-sm font-medium text-zinc-400 mb-2">Current BTC Price (Pyth)</h3>
                    <div className="flex items-end gap-2">
                      {error ? (
                        <div className="text-2xl font-bold text-rose-400">{error}</div>
                      ) : (
                        <>
                          <span className="text-2xl font-bold">
                            ${price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Upper Bound Card */}
                  <div className="bg-zinc-700 p-4 rounded-lg border-l-4 border-[#FF4C4C] flex-1 flex flex-col justify-center">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium text-zinc-400">Upper Bound</h3>
                      <span className="text-xs bg-[#FF4C4C]/20 text-[#FF4C4C] px-2 py-0.5 rounded-full">+{percent.toFixed(1)}%</span>
                    </div>
                    <p className="text-xl font-semibold mt-1">${selectedPosition?.status === 'ACTIVE' ? selectedPosition.upper_bound.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : bounds.upper?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                  </div>
                  
                  {/* Lower Bound Card */}
                  <div className="bg-zinc-700 p-4 rounded-lg border-l-4 border-[#00FF99] flex-1 flex flex-col justify-center">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium text-zinc-400">Lower Bound</h3>
                      <span className="text-xs bg-[#00FF99]/20 text-[#00FF99] px-2 py-0.5 rounded-full">-{percent.toFixed(1)}%</span>
                    </div>
                    <p className="text-xl font-semibold mt-1">${selectedPosition?.status === 'ACTIVE' ? selectedPosition.lower_bound.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : bounds.lower?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Orders History Panel */}
            <div className="mb-6">
              <UserOrders 
                refreshTrigger={refreshOrdersCounter} 
                onOrderCancelled={refreshOrders}
              />
            </div>
          </div>
        </main>
      </div>
      
    </div>
  );
};

export default Dashboard;