'use client'

import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion } from 'framer-motion';
import { Position, fetchUserPositions, subscribeToPositions, claimPosition } from '../services/positions';
import { useNotifications } from '../context/NotificationContext';

const POSITIONS_PER_PAGE = 10;

const UserPositions: React.FC = () => {
  const wallet = useWallet();
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [claimLoading, setClaimLoading] = useState<Record<number, boolean>>({});
  const { showNotification } = useNotifications();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'settled' | 'claimed'>('all');
  const [analytics, setAnalytics] = useState<any>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const fetchPositions = async () => {
    if (!wallet.publicKey) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { positions: userPositions, error: positionsError } = await fetchUserPositions(wallet);
      
      if (positionsError) {
        setError(positionsError);
      } else {
        setPositions(userPositions);
        // After updating positions, set current page to 1 if it would be out of bounds
        const filteredCount = userPositions ? filterPositions(userPositions).length : 0;
        const maxPages = Math.max(1, Math.ceil(filteredCount / POSITIONS_PER_PAGE));
        if (currentPage > maxPages) {
          setCurrentPage(1);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch positions');
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh function
  const handleRefresh = () => {
    setRefreshCounter(prev => prev + 1);
    fetchPositions();

  };
  const handleClaimPosition = async (position: Position) => {
    if (!wallet.publicKey || !position.order_id) return;
    
    setClaimLoading(prev => ({ ...prev, [position.id]: true }));
    
    try {

      const payoutAmount = position.amount * (position.payout_percentage! / 100);
      const profit = payoutAmount - position.amount;
      const profitText = profit >= 0 
        ? `Profit: +◎${profit.toFixed(2)}` 
        : `Loss: -◎${Math.abs(profit).toFixed(2)}`;


      const result = await claimPosition(wallet, position.order_id , payoutAmount);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to claim position');
      }

      showNotification(
        'success',
        'Position claimed successfully!',
        `Payout: ◎${payoutAmount.toFixed(5)} | ${profitText}`,
        true,
        6000
      );
      
      // Update local state
      setPositions(prevPositions => {
        if (!prevPositions) return null;
        return prevPositions.map(p => {
          if (p.id === position.id) {
            return {
              ...p,
              status: 'CLAIMED',
              claimed_at: new Date().toISOString(),
              payout_amount: payoutAmount
            };
          }
          return p;
        });
      });
      
      // Fetch updated data
      handleRefresh();
      
    } catch (err: any) {
      console.error('Claim error:', err);
      showNotification('error', 'Error claiming position', err.message);
    } finally {
      setClaimLoading(prev => ({ ...prev, [position.id]: false }));
    }
  };

  // Filter positions based on active filter
  const filterPositions = (positionsToFilter: Position[]) => {
    return positionsToFilter.filter(position => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'active') return position.status === 'ACTIVE';
      if (activeFilter === 'settled') return position.status === 'SETTLED';
      if (activeFilter === 'claimed') return position.status === 'CLAIMED';
      return true;
    });
  };

  useEffect(() => {
    if (wallet.publicKey) {
      fetchPositions();

      
      const unsubscribe = subscribeToPositions(wallet, (updatedPositions) => {
        setPositions(updatedPositions);

        
        if (positions && updatedPositions.length > positions.length) {
          const newPositions = updatedPositions.filter(
            (newPos) => !positions.some((oldPos) => oldPos.id === newPos.id)
          );
          
          newPositions.forEach(position => {
            showNotification(
              'success',
              `Trade executed: ${position.position_type === 0 ? 'SHORT' : 'LONG'} order matched!`,
              `Amount: ◎${position.amount} - Transaction: ${position.tx_signature.substring(0, 8)}...${position.tx_signature.substring(position.tx_signature.length - 8)}`,
              true,
              8000
            );
          });
        }

        if (positions) {
          updatedPositions.forEach(newPos => {
            const oldPos = positions.find(p => p.id === newPos.id);
            if (oldPos && oldPos.status !== newPos.status && newPos.status === 'SETTLED') {
              const timeDiff = calculateTimeDiff(newPos.created_at, newPos.settlement_time!);
              
              const formattedPrice = (newPos.settlement_price || 0) * 1e-8;
              
              showNotification(
                'info',
                `Position settled: ${newPos.position_type === 0 ? 'SHORT' : 'LONG'}`,
                `Duration: ${timeDiff} | Payout: ${newPos.payout_percentage}% | Breaking price: $${formattedPrice.toLocaleString()}`,
                true,
                8000
              );
            }
          });
        }
      });
      
      return () => unsubscribe();
    } else {
      setPositions(null);
      setAnalytics(null);
    }
  }, [wallet.publicKey, refreshCounter]);

  // Update filtered positions when positions or filter changes
  const filteredPositions = positions ? filterPositions(positions) : null;

  // Update pagination when filtered positions change
  useEffect(() => {
    if (filteredPositions) {
      const newTotalPages = Math.max(1, Math.ceil(filteredPositions.length / POSITIONS_PER_PAGE));
      setTotalPages(newTotalPages);
      
      // If current page is out of bounds, reset to first page
      if (currentPage > newTotalPages) {
        setCurrentPage(1);
      }
    }
  }, [filteredPositions, activeFilter]);

  // Calculate current page positions
  const currentPositions = filteredPositions
    ? filteredPositions.slice(
        (currentPage - 1) * POSITIONS_PER_PAGE,
        currentPage * POSITIONS_PER_PAGE
      )
    : [];

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const calculateTimeDiff = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const formatBlockchainPrice = (rawPrice: number) => {
    return (rawPrice * 1e-8).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const StatusBadge = ({ status }: { status: Position['status'] }) => {
    let color = '';
    
    switch (status) {
      case 'ACTIVE':
        color = 'bg-blue-500/20 text-blue-400 border-blue-500/50';
        break;
      case 'SETTLED':
        color = 'bg-green-500/20 text-green-400 border-green-500/50';
        break;
      case 'CLAIMED':
        color = 'bg-purple-500/20 text-purple-400 border-purple-500/50';
        break;
    }
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-md border ${color}`}>
        {status}
      </span>
    );
  };


  return (
    <div className="w-full bg-zinc-800/80 backdrop-blur-md p-5 rounded-xl border border-zinc-700/50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Your Positions</h3>
        <div className="flex space-x-2">
          <div className="flex rounded-md overflow-hidden">
            <button 
              onClick={() => setActiveFilter('all')}
              className={`text-xs px-3 py-1 transition-colors ${activeFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
            >
              All
            </button>
            <button 
              onClick={() => setActiveFilter('active')}
              className={`text-xs px-3 py-1 transition-colors ${activeFilter === 'active' ? 'bg-blue-500 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
            >
              Active
            </button>
            <button 
              onClick={() => setActiveFilter('settled')}
              className={`text-xs px-3 py-1 transition-colors ${activeFilter === 'settled' ? 'bg-blue-500 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
            >
              Settled
            </button>
            <button 
              onClick={() => setActiveFilter('claimed')}
              className={`text-xs px-3 py-1 transition-colors ${activeFilter === 'claimed' ? 'bg-blue-500 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
            >
              Claimed
            </button>
          </div>
          <button 
            onClick={handleRefresh}
            className="text-xs bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-1 rounded-md transition-colors flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg">
        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-zinc-400">Loading positions...</span>
            </div>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-400">
            <p>{error}</p>
            <button 
              onClick={fetchPositions}
              className="mt-2 text-xs underline hover:text-white"
            >
              Try again
            </button>
          </div>
        ) : !wallet.publicKey ? (
          <div className="py-8 text-center text-zinc-400">
            <p>Connect your wallet to view positions</p>
          </div>
        ) : positions?.length === 0 ? (
          <div className="py-8 text-center text-zinc-400">
            <p>No positions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-700">
              <thead className="bg-zinc-900/50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">ID</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Execution Price</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Price Range</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Details</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-zinc-800/30 divide-y divide-zinc-700">
                {currentPositions.map((position) => (
                  <motion.tr 
                    key={position.id} 
                    className="hover:bg-zinc-700/30 transition-colors"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-300">#{position.id}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-300">{formatDate(position.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={position.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-md border ${
                        position.position_type === 1 
                          ? 'bg-red-500/20 text-red-400 border-red-500/50' 
                          : 'bg-green-500/20 text-green-400 border-green-500/50'
                      }`}>
                        
                        {position.position_type === 1 ? 'BREAK OUT' : 'STAY IN'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-300">
                      <span className="text-purple-400 mr-1">◎</span>
                      {position.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-300">
                      { position.btc_price_at_creation ? position.btc_price_at_creation.toFixed(2) : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-300">
                      ${position.lower_bound.toFixed(2)} - ${position.upper_bound.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {position.status === 'ACTIVE' ? (
                        <span className="text-blue-400">Active</span>
                      ) : position.status === 'SETTLED' ? (
                        <div className="text-green-400">
                          <p className="mb-1">Breaking price: {position.settlement_price ? formatBlockchainPrice(position.settlement_price) : '-'}</p>
                          <p className="mb-1">Duration: {calculateTimeDiff(position.created_at, position.settlement_time!)}</p>
                          <p>Payout: {position.payout_amount?.toFixed(5)}</p>
                        </div>
                      ) : position.status === 'CLAIMED' ? (
                        <div className="text-purple-400">
                          <p className="mb-1">Payout: ◎{position.payout_amount?.toFixed(5)}</p>
                      
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <a 
                        href={`https://explorer.solana.com/address/${position.on_chain_position_address}?cluster=devnet`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 underline hover:text-blue-300 mr-2"
                      >
                        View TX
                      </a>
                      {position.status === 'SETTLED' && (
                        <button
                          onClick={() => handleClaimPosition(position)}
                          disabled={claimLoading[position.id]}
                          className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {claimLoading[position.id] ? (
                            <span className="flex items-center">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Claiming...
                            </span>
                          ) : 'Claim'}
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            
            {filteredPositions && filteredPositions.length > 0 && (
              <div className="flex justify-between items-center pt-4 pb-2 px-2">
                <div className="text-xs text-zinc-400">
                  Showing {filteredPositions.length > 0 ? (currentPage - 1) * POSITIONS_PER_PAGE + 1 : 0} to {Math.min(currentPage * POSITIONS_PER_PAGE, filteredPositions.length)} of {filteredPositions.length} positions
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-xs bg-zinc-700 text-zinc-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    &laquo;
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-xs bg-zinc-700 text-zinc-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    &lsaquo;
                  </button>
                  
                  <div className="px-3 py-1 text-xs bg-zinc-600 text-zinc-100 rounded-md">
                    {currentPage} / {totalPages}
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 text-xs bg-zinc-700 text-zinc-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    &rsaquo;
                  </button>
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 text-xs bg-zinc-700 text-zinc-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    &raquo;
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserPositions; 