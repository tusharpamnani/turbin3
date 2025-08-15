"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import UserPositions from './UserPositions';
import { fetchUserPositions, Position } from '../services/positions';

interface PositionsPageProps {
  onBackClick: () => void;
}

interface Analytics {
  total_positions: number;
  active_positions: number;
  success_rate: number;
  total_profit: number;
  win_count: number;
}

const PositionsPage = ({ onBackClick }: PositionsPageProps) => {
  const wallet = useWallet();
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [analytics, setAnalytics] = useState<Analytics>({
    total_positions: 0,
    active_positions: 0,
    success_rate: 0,
    total_profit: 0,
    win_count: 0
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshCounter, setRefreshCounter] = useState<number>(0);

  useEffect(() => {
    const fetchPositionsAndCalculateAnalytics = async () => {
      if (!wallet.publicKey) {
        setPositions(null);
        setAnalytics({
          total_positions: 0,
          active_positions: 0,
          success_rate: 0,
          total_profit: 0,
          win_count: 0
        });
        return;
      }
      
      setLoading(true);
      try {
        const { positions: userPositions } = await fetchUserPositions(wallet);
        
        if (userPositions && userPositions.length > 0) {
          setPositions(userPositions);
          
          // Calculate analytics from positions data
          const totalPositions = userPositions.length;
          const activePositions = userPositions.filter(p => p.status === 'ACTIVE').length;
          const settledOrClaimedPositions = userPositions.filter(p => p.status === 'SETTLED' || p.status === 'CLAIMED');
          
          // Calculate win count (positions with payout_amount > amount)
          const winCount = settledOrClaimedPositions.filter(p => {
            if (p.status === 'CLAIMED' && p.payout_amount) {
              return p.payout_amount > p.amount;
            } else if (p.status === 'SETTLED' && p.payout_percentage) {
              return p.payout_percentage > 100;
            }
            return false;
          }).length;
          
          // Calculate success rate
          const successRate = settledOrClaimedPositions.length > 0 
            ? (winCount / settledOrClaimedPositions.length) * 100 
            : 0;
          
          // Calculate total profit
          let totalProfit = 0;
          userPositions.forEach(position => {
            if (position.status === 'CLAIMED' && position.payout_amount) {
              // Profit = payout amount - original amount
              const profit = position.payout_amount - position.amount;
              totalProfit += profit;
            } else if (position.status === 'SETTLED' && position.payout_percentage) {
              // For settled positions, estimate profit based on payout percentage
              const estimatedPayout = position.amount * (position.payout_percentage / 100);
              const estimatedProfit = estimatedPayout - position.amount;
              totalProfit += estimatedProfit;
            }
          });
          
          setAnalytics({
            total_positions: totalPositions,
            active_positions: activePositions,
            success_rate: successRate,
            total_profit: totalProfit,
            win_count: winCount
          });
        } else {
          setPositions([]);
          setAnalytics({
            total_positions: 0,
            active_positions: 0,
            success_rate: 0,
            total_profit: 0,
            win_count: 0
          });
        }
      } catch (error) {
        console.error('Failed to fetch positions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPositionsAndCalculateAnalytics();
    
    // Set up a refresh interval
    const intervalId = setInterval(() => {
      setRefreshCounter(prev => prev + 1);
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [wallet.publicKey, refreshCounter]);

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Positions Page Content */}
      <div className="min-h-screen">
        {/* Header */}
        <header className="p-6 border-b border-zinc-800">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center border border-zinc-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-xl font-bold">Positions</span>
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
              Back to Dashboard
            </button>

            {/* Positions Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-zinc-800 p-6 rounded-xl border border-zinc-700">
                <div className="flex justify-between mb-4">
                  <div>
                    <h3 className="text-zinc-400 text-sm">Total Positions</h3>
                    <p className="text-2xl font-semibold">{loading ? '...' : analytics.total_positions}</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-400/10 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <div className="text-xs text-zinc-400">
                  Positions created
                </div>
              </div>
              
              <div className="bg-zinc-800 p-6 rounded-xl border border-zinc-700">
                <div className="flex justify-between mb-4">
                  <div>
                    <h3 className="text-zinc-400 text-sm">Active Positions</h3>
                    <p className="text-2xl font-semibold">{loading ? '...' : analytics.active_positions}</p>
                  </div>
                  <div className="w-10 h-10 bg-green-400/10 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-xs text-zinc-400">
                  Currently active
                </div>
              </div>
              
              <div className="bg-zinc-800 p-6 rounded-xl border border-zinc-700">
                <div className="flex justify-between mb-4">
                  <div>
                    <h3 className="text-zinc-400 text-sm">Success Rate</h3>
                    <p className="text-2xl font-semibold">{loading ? '...' : analytics.success_rate.toFixed(1)}%</p>
                  </div>
                  <div className="w-10 h-10 bg-purple-400/10 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </div>
                <div className="text-xs text-zinc-400">
                  Win rate
                </div>
              </div>
              
              <div className="bg-zinc-800 p-6 rounded-xl border border-zinc-700">
                <div className="flex justify-between mb-4">
                  <div>
                    <h3 className="text-zinc-400 text-sm">Total Profit</h3>
                    <p className={`text-2xl font-semibold ${analytics.total_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {loading ? '...' : `${analytics.total_profit >= 0 ? '+' : ''}${analytics.total_profit.toFixed(2)} SOL`}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-yellow-400/10 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-xs text-zinc-400">
                  Cumulative profit
                </div>
              </div>
            </div>
                <div className="bg-zinc-900/30 p-4 rounded-lg">
                  <UserPositions />
                </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PositionsPage;