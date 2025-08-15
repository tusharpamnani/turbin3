"use client";

import { transferFundsToVault, withdrawFundsFromVault } from "./vault";
import { supabaseAdmin } from "../lib/supabaseClient";
import { Order } from "../types/database.types";

type OrderSide = 'LONG' | 'SHORT';

interface PlaceOrderParams {
  wallet: any;
  amount: number;
  side: OrderSide;
  points: number;
}

export async function fetchUserOrders(wallet: any): Promise<{ orders: Order[] | null; error?: string }> {
  if (!wallet.publicKey) {
    return { orders: null, error: "Wallet not connected" };
  }

  try {
    const walletAddress = wallet.publicKey.toBase58();
    
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('wallet_address', walletAddress)
      .single();

    if (userError || !userData) {
      return { orders: null, error: "User not found" };
    }

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false });

    if (ordersError) {
      throw ordersError;
    }

    return { orders: orders as Order[] };
  } catch (err: any) {
    console.error('Error fetching orders:', err);
    return { 
      orders: null, 
      error: err.message || "Error fetching orders" 
    };
  }
}

export async function placeOrder({ wallet, amount, side, points }: PlaceOrderParams): Promise<{ success: boolean; error?: string; txHash?: string }> {
  if (!wallet.publicKey) {
    return { success: false, error: "Wallet not connected" };
  }

  try {
    const walletAddress = wallet.publicKey.toBase58();
    
      // 1. Get or create user
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .upsert({ wallet_address: walletAddress }, { onConflict: 'wallet_address' })
      .select('id')
      .single();

    if (userError || !userData) {
      throw userError || new Error('Failed to fetch user data');
    }

    // 2. Create a partial order entry with PENDING status
    const { data: orderData, error: createOrderError } = await supabaseAdmin
      .from('orders')
      .insert([
        {
          user_id: userData.id,
          side,
          points,
          amount,
          filled_amount: 0,
          status: 'PENDING', // Use PENDING status initially
        }
      ])
      .select('id')
      .single();

    if (createOrderError || !orderData) {
      throw createOrderError || new Error('Failed to create order');
    }

    // 3. Transfer funds to vault using the order ID
    const vaultResponse = await transferFundsToVault(wallet, amount, orderData.id);
    
    if (vaultResponse === false) {
      // If vault transfer fails, update order status to CANCELLED
      await supabaseAdmin
        .from('orders')
        .update({ status: 'CANCELLED' })
        .eq('id', orderData.id);
        
      throw new Error('Vault deposit failed');
    }

    // 4. vaultResponse now contains the transaction hash
    const txHash = typeof vaultResponse === 'string' ? vaultResponse : '';

    // 5. Update user's balance
    const { data: balanceData } = await supabaseAdmin
      .from('balances')
      .select('total_deposited, locked_amount')
      .eq('user_id', userData.id)
      .single();

    console.log("Balance data:", balanceData);

    const totalDeposited = (balanceData?.total_deposited || 0) + amount;
    const lockedAmount = (balanceData?.locked_amount || 0) + amount;

    const { error: balanceError } = await supabaseAdmin
      .from('balances')
      .upsert({
        user_id: userData.id,
        total_deposited: totalDeposited,
        locked_amount: lockedAmount,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (balanceError) {
      throw balanceError;
    }

    // 6. Update the order with transaction hash and OPEN status
    const { error: orderUpdateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'OPEN',
        txn_hash: txHash
      })
      .eq('id', orderData.id);

    if (orderUpdateError) {
      throw orderUpdateError;
    }

    return { success: true, txHash };

  } catch (err: any) {
    console.error("Order placement error:", err);
    return { 
      success: false, 
      error: err.message || "Error placing order" 
    };
  }
}

export async function cancelOrder(wallet: any, orderId: number): Promise<{ success: boolean; error?: string; txHash?: string }> {
  if (!wallet.publicKey) {
    return { success: false, error: "Wallet not connected" };
  }

  try {
    const walletAddress = wallet.publicKey.toBase58();
    
    // Get user ID from wallet address
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('wallet_address', walletAddress)
      .single();

    if (userError || !userData) {
      return { success: false, error: "User not found" };
    }

    // Get the order to cancel
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', userData.id)
      .single();

    if (orderError || !orderData) {
      return { success: false, error: "Order not found" };
    }

    const order = orderData as Order;
    
    // Check if the order is already filled or cancelled
    if (order.status === 'FILLED' || order.status === 'CANCELLED') {
      return { success: false, error: `Order already ${order.status.toLowerCase()}` };
    }

    // Calculate refund amount (remaining unfilled amount)
    const refundAmount = order.amount - (order.filled_amount || 0);
    
    if (refundAmount <= 0) {
      return { success: false, error: "No funds to refund" };
    }

    // Update order status to CANCELLED
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ status: 'CANCELLED' })
      .eq('id', orderId);

    if (updateError) {
      throw updateError;
    }

    // Update user's balance (reduce locked amount)
    const { data: balanceData } = await supabaseAdmin
      .from('balances')
      .select('locked_amount')
      .eq('user_id', userData.id)
      .single();

    if (balanceData) {
      const newLockedAmount = Math.max(0, (balanceData.locked_amount || 0) - refundAmount);

      const { error: balanceError } = await supabaseAdmin
        .from('balances')
        .update({
          locked_amount: newLockedAmount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userData.id);

      if (balanceError) {
        throw balanceError;
      }
    }

    // Withdraw funds from vault back to the user's wallet
    const withdrawResult = await withdrawFundsFromVault(wallet, refundAmount, orderId);
    
    if (!withdrawResult) {
      throw new Error('Failed to withdraw funds from vault');
    }

    return { 
      success: true, 
      txHash: typeof withdrawResult === 'string' ? withdrawResult : undefined 
    };
  } catch (err: any) {
    console.error('Order cancellation error:', err);
    return { 
      success: false, 
      error: err.message || "Error cancelling order" 
    };
  }
}

export async function fetchOrderbook(): Promise<{ 
  longOrders: { points: number, totalAmount: number }[],
  shortOrders: { points: number, totalAmount: number }[], 
  error?: string 
}> {
  try {
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .in('status', ['OPEN', 'PARTIALLY_FILLED'])
      .order('points', { ascending: true });

    if (ordersError) {
      throw ordersError;
    }

    // Group orders by side and percentage points
    const longOrdersByPoints: Map<number, number> = new Map();
    const shortOrdersByPoints: Map<number, number> = new Map();

    // Process the orders
    orders.forEach((order) => {
      const remainingAmount = order.amount - (order.filled_amount || 0);
      if (remainingAmount <= 0) return; // Skip if no remaining amount
      
      if (order.side === 'LONG') {
        const current = longOrdersByPoints.get(order.points) || 0;
        longOrdersByPoints.set(order.points, current + remainingAmount);
      } else { 
        const current = shortOrdersByPoints.get(order.points) || 0;
        shortOrdersByPoints.set(order.points, current + remainingAmount);
      }
    });

    const longOrders = Array.from(longOrdersByPoints).map(([points, totalAmount]) => ({
      points,
      totalAmount
    })).sort((a, b) => a.points - b.points); // Sort by points ascending

    const shortOrders = Array.from(shortOrdersByPoints).map(([points, totalAmount]) => ({
      points,
      totalAmount
    })).sort((a, b) => a.points - b.points); // Sort by points ascending

    return { longOrders, shortOrders };
  } catch (err: any) {
    console.error('Error fetching orderbook:', err);
    return { 
      longOrders: [], 
      shortOrders: [],
      error: err.message || "Error fetching orderbook" 
    };
  }
} 