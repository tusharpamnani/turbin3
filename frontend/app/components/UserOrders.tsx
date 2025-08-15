'use client'

import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { fetchUserOrders, cancelOrder } from '../services/orderbook';
import { Order, OrderStatus } from '../types/database.types';
import { useNotifications } from '../context/NotificationContext';

// Status badge component
const StatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  let color = '';
  
  switch (status) {
    case 'OPEN':
      color = 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      break;
    case 'PARTIALLY_FILLED':
      color = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      break;
    case 'FILLED':
      color = 'bg-green-500/20 text-green-400 border-green-500/50';
      break;
    case 'CANCELLED':
      color = 'bg-red-500/20 text-red-400 border-red-500/50';
      break;
  }
  
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-md border ${color}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

// Side badge component
const SideBadge: React.FC<{ side: 'LONG' | 'SHORT' }> = ({ side }) => {
  const color = side === 'LONG' 
    ? 'bg-red-500/20 text-red-400 border-red-500/50' 
    : 'bg-green-500/20 text-green-400 border-green-500/50';
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-md border ${color}`}>
      {side === 'LONG' ? 'BREAK OUT' : 'STAY IN'}
    </span>
  );
};

interface UserOrdersProps {
  refreshTrigger?: number;
  onOrderCancelled?: () => void;
}

const ORDERS_PER_PAGE = 10;

const UserOrders: React.FC<UserOrdersProps> = ({ refreshTrigger = 0, onOrderCancelled }) => {
  const wallet = useWallet();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'filled' | 'cancelled'>('all');
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);
  const { showNotification } = useNotifications();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Filter orders based on active tab
  const filterOrders = (ordersToFilter: Order[]) => {
    return ordersToFilter.filter(order => {
      if (activeTab === 'all') return true;
      if (activeTab === 'open') return order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED';
      if (activeTab === 'filled') return order.status === 'FILLED';
      if (activeTab === 'cancelled') return order.status === 'CANCELLED';
      return true;
    });
  };

  const fetchOrders = async () => {
    if (!wallet.publicKey) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { orders: userOrders, error: ordersError } = await fetchUserOrders(wallet);
      
      if (ordersError) {
        setError(ordersError);
      } else {
        setOrders(userOrders);
        // After updating orders, check if current page would be out of bounds
        const filteredCount = userOrders ? filterOrders(userOrders).length : 0;
        const maxPages = Math.max(1, Math.ceil(filteredCount / ORDERS_PER_PAGE));
        if (currentPage > maxPages) {
          setCurrentPage(1);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh function
  const handleRefresh = () => {
    setRefreshCounter(prev => prev + 1);
    fetchOrders();
  };

  useEffect(() => {
    if (wallet.publicKey) {
      fetchOrders();
    } else {
      setOrders(null);
    }
  }, [wallet.publicKey, refreshTrigger, refreshCounter]);

  // Get filtered orders
  const filteredOrders = orders ? filterOrders(orders) : null;

  // Update total pages whenever filtered orders change
  useEffect(() => {
    if (filteredOrders) {
      const newTotalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
      setTotalPages(newTotalPages);
      
      // If current page is out of bounds, reset to first page
      if (currentPage > newTotalPages) {
        setCurrentPage(1);
      }
    }
  }, [filteredOrders, activeTab]);

  // Get current page of orders
  const currentOrders = filteredOrders
    ? filteredOrders.slice(
        (currentPage - 1) * ORDERS_PER_PAGE,
        currentPage * ORDERS_PER_PAGE
      )
    : [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Handle order cancellation
  const handleCancelOrder = async (orderId: number) => {
    if (!wallet.publicKey) {
      showNotification('error', 'Wallet not connected', 'Please connect your wallet to cancel orders.');
      return;
    }

    try {
      setCancellingOrderId(orderId);
      
      const result = await cancelOrder(wallet, orderId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel order');
      }
      
      // Show success notification
      showNotification(
        'success',
        'Order cancelled successfully',
        `Order #${orderId} has been cancelled and funds returned to your wallet.`,
        true,
        6000
      );
      
      // Refresh the orders list
      handleRefresh();
      
      // Notify parent component if callback provided
      if (onOrderCancelled) {
        onOrderCancelled();
      }
    } catch (err: any) {
      console.error('Order cancellation error:', err);
      showNotification('error', 'Error cancelling order', err.message);
    } finally {
      setCancellingOrderId(null);
    }
  };

  // Pagination controls
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="w-full bg-zinc-800/80 backdrop-blur-md p-5 rounded-xl border border-zinc-700/50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Your Orders</h3>
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

      {/* Tabs */}
      <div className="flex space-x-2 mb-4 border-b border-zinc-700 pb-2">
        <button 
          className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          onClick={() => setActiveTab('all')}
        >
          All
        </button>
        <button 
          className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'open' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          onClick={() => setActiveTab('open')}
        >
          Open
        </button>
        <button 
          className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'filled' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          onClick={() => setActiveTab('filled')}
        >
          Filled
        </button>
        <button 
          className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'cancelled' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          onClick={() => setActiveTab('cancelled')}
        >
          Cancelled
        </button>
      </div>

      {/* Orders content */}
      <div className="overflow-hidden rounded-lg">
        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-zinc-400">Loading orders...</span>
            </div>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-400">
            <p>{error}</p>
            <button 
              onClick={fetchOrders}
              className="mt-2 text-xs underline hover:text-white"
            >
              Try again
            </button>
          </div>
        ) : !wallet.publicKey ? (
          <div className="py-8 text-center text-zinc-400">
            <p>Connect your wallet to view orders</p>
          </div>
        ) : orders?.length === 0 ? (
          <div className="py-8 text-center text-zinc-400">
            <p>No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-700">
              <thead className="bg-zinc-900/50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">ID</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Side</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Points</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Amount <span className="text-purple-400">◎</span>
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Filled <span className="text-purple-400">◎</span>
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-zinc-800/30 divide-y divide-zinc-700">
                {currentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-zinc-700/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-300">#{order.id}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-300">{formatDate(order.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <SideBadge side={order.side} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-300">{order.points}%</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-300">
                      <span className="text-purple-400 mr-1">◎</span>
                      {order.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-300">
                      {order.filled_amount ? (
                        <div className="flex flex-col">
                          <span>
                            <span className="text-purple-400 mr-1">◎</span>
                            {order.filled_amount.toFixed(2)}
                          </span>
                          <span className="text-xs text-zinc-500">
                            ({((order.filled_amount / order.amount) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      ) : (
                        <span>
                          <span className="text-purple-400 mr-1">◎</span>
                          0.00
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {(order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED') && (
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          disabled={cancellingOrderId === order.id}
                          className={`px-3 py-1 text-xs rounded-md transition-colors 
                            ${cancellingOrderId === order.id 
                              ? 'bg-zinc-600 text-zinc-400 cursor-not-allowed' 
                              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50'}`}
                        >
                          {cancellingOrderId === order.id ? (
                            <div className="flex items-center">
                              <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin mr-1"></div>
                              Cancelling
                            </div>
                          ) : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Pagination controls */}
            {filteredOrders && filteredOrders.length > 0 && (
              <div className="flex justify-between items-center pt-4 pb-2 px-2">
                <div className="text-xs text-zinc-400">
                  Showing {filteredOrders.length > 0 ? (currentPage - 1) * ORDERS_PER_PAGE + 1 : 0} to {Math.min(currentPage * ORDERS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length} orders
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
                  
                  {/* Page number display */}
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

export default UserOrders; 