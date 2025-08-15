'use client'

import React, { useState, useEffect } from 'react';
import { fetchOrderbook } from '../services/orderbook';

interface OrderBookProps {
  refreshTrigger?: number;
}

const OrderBook: React.FC<OrderBookProps> = ({ refreshTrigger = 0 }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [longOrders, setLongOrders] = useState<Array<{ points: number, totalAmount: number }>>([]);
  const [shortOrders, setShortOrders] = useState<Array<{ points: number, totalAmount: number }>>([]);

  // Fetch orderbook data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { longOrders: longs, shortOrders: shorts, error: fetchError } = await fetchOrderbook();
      
      if (fetchError) {
        setError(fetchError);
      } else {
        // Sort shorts descending by points (higher percentages at top)
        const sortedShorts = [...shorts].sort((a, b) => b.points - a.points);
        // Sort longs descending by points (higher percentages at top)
        const sortedLongs = [...longs].sort((a, b) => b.points - a.points);
        
        setShortOrders(sortedShorts);
        setLongOrders(sortedLongs);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch orderbook');
    } finally {
      setLoading(false);
    }
  };

  // Calculate volume bars widths for visualization
  const calculateVolumeBar = (amount: number, side: 'long' | 'short') => {
    const maxVolume = side === 'short' 
      ? Math.max(...shortOrders.map(o => o.totalAmount), 1)
      : Math.max(...longOrders.map(o => o.totalAmount), 1);
    
    const percentage = (amount / maxVolume) * 100;
    return `${Math.min(Math.max(percentage, 5), 100)}%`;
  };

  // Load data when component mounts or refreshTrigger changes
  useEffect(() => {
    fetchData();
    
    // Set up auto-refresh interval (e.g., every 30 seconds)
    const interval = setInterval(fetchData, 30000);
    
    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, [refreshTrigger]);

  return (
    <div className="bg-zinc-800 h-[500px] p-3 rounded-xl border border-zinc-700 flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-zinc-300">Order Book</h3>
        <button 
          onClick={fetchData}
          className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-400 px-2 py-1 rounded-md transition-colors"
          title="Refresh orderbook"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      
      {/* Order book table */}
      <div className="flex-1 overflow-hidden flex flex-col text-xs">
        <div className="grid grid-cols-2 py-2 border-b border-zinc-700 sticky top-0 bg-zinc-800 z-10">
          <div className="text-center font-medium text-zinc-400">Volatility %</div>
          <div className="text-right text-zinc-400">Total <span className="text-purple-400">◎</span></div>
        </div>
        
        { 
        error ? (
          <div className="flex-1 flex items-center justify-center text-red-400 text-sm">
            <p>{error}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-zinc-800">
            {/* Asks/Shorts section - top */}
            <div className="bg-opacity-5">
              {shortOrders.length > 0 ? (
                shortOrders.map((order, i) => (
                  <div key={`short-${i}`} className="grid grid-cols-2 py-1 relative">
                    {/* Red volume visualization bar */}
                    <div 
                      className="absolute right-0 top-0 h-full bg-green-500/10 z-0" 
                      style={{ width: calculateVolumeBar(order.totalAmount, 'short') }}
                    ></div>
                    
                    {/* Order data */}
                    <div className="text-center font-medium text-green-400 z-10">{order.points.toFixed(1)}%</div>
                    <div className="text-right text-zinc-300 z-10">{order.totalAmount.toFixed(3)}</div>
                  </div>
                ))
              ) : (
                <div className="py-2 text-center text-zinc-500">No short orders</div>
              )}
            </div>
            
            {/* Spread section - middle */}
            <div className="py-2 px-2 bg-zinc-700/20 border-y border-zinc-700 my-1">
              <div className="flex justify-between text-zinc-400">
                <span>Spread</span>
                <span>
                  {shortOrders.length > 0 && longOrders.length > 0 
                    ? `${(Math.min(...shortOrders.map(o => o.points)) - Math.max(...longOrders.map(o => o.points))).toFixed(1)}%` 
                    : '—'}
                </span>
              </div>
            </div>
            
            {/* Bids/Longs section - bottom */}
            <div className="bg-opacity-5">
              {longOrders.length > 0 ? (
                longOrders.map((order, i) => (
                  <div key={`long-${i}`} className="grid grid-cols-2 py-1 relative">
                    {/* Green volume visualization bar */}
                    <div 
                      className="absolute right-0 top-0 h-full bg-red-500/10 z-0" 
                      style={{ width: calculateVolumeBar(order.totalAmount, 'long') }}
                    ></div>
                    
                    {/* Order data */}
                    <div className="text-center font-medium text-red-400 z-10">{order.points.toFixed(1)}%</div>
                    <div className="text-right text-zinc-300 z-10">{order.totalAmount.toFixed(3)}</div>
                  </div>
                ))
              ) : (
                <div className="py-2 text-center text-zinc-500">No long orders</div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Info footer */}
      <div className="mt-2 pt-2 border-t border-zinc-700 text-xs text-zinc-500 flex justify-between">
        <span>Volatility-based Orderbook</span>
        <span>Sorted by percentage</span>
      </div>
    </div>
  );
};

export default OrderBook; 