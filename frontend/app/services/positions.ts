"use client";

import { supabaseAdmin } from "../lib/supabaseClient";
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction 
} from '@solana/web3.js';
import { connection } from "../constants/constants";
import { claimPosition as claimPositionFromVault } from "./vault";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface Position {
  id: number;
  user_public_key: string;
  order_id: number;
  amount: number;
  lower_bound: number;
  upper_bound: number;
  position_type: 0 | 1; 
  tx_signature: string;
  created_at: string;
  status: 'ACTIVE' | 'SETTLED' | 'CLAIMED';
  settlement_time?: string;
  settlement_price?: number;
  payout_percentage?: number;
  payout_amount?: number;
  claimed_at?: string;
  on_chain_position_address?: string;
  last_checked_at?: string;
  updated_at?: string;
  btc_price_at_creation?: number; 
}

export async function fetchUserPositions(wallet: any): Promise<{ positions: Position[] | null; error?: string }> {
  if (!wallet.publicKey) {
    return { positions: null, error: "Wallet not connected" };
  }

  try {
    const walletAddress = wallet.publicKey.toBase58();
    
    const { data: positions, error: positionsError } = await supabaseAdmin
      .from('positions')
      .select('*')
      .eq('user_public_key', walletAddress)
      .order('created_at', { ascending: false });

    if (positionsError) {
      throw positionsError;
    }

    return { positions: positions as Position[] };
  } catch (err: any) {
    console.error('Error fetching positions:', err);
    return { 
      positions: null, 
      error: err.message || "Error fetching positions" 
    };
  }
}

export function subscribeToPositions(wallet: any, callback: (positions: Position[]) => void): () => void {
  if (!wallet.publicKey) return () => {};
  
  const walletAddress = wallet.publicKey.toBase58();
  
  // Set up real-time subscription
  const subscription = supabaseAdmin
    .channel('positions-channel')
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to all events (insert, update, delete)
        schema: 'public',
        table: 'positions',
        filter: `user_public_key=eq.${walletAddress}`,
      },
      () => {
        // When a change happens, fetch all positions
        fetchUserPositions(wallet).then(result => {
          if (result.positions) {
            callback(result.positions);
          }
        });
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    subscription.unsubscribe();
  };
}

export async function claimPosition(wallet: any, orderId: number, payoutAmount: number): Promise<{ success: boolean; error?: string; txHash?: string }> {
  if (!wallet.publicKey) {
    return { success: false, error: "Wallet not connected" };
  }
  
  try {
    const walletAddress = wallet.publicKey.toBase58();
    const userPubKey = wallet.publicKey;
    
    const { data: position, error: positionError } = await supabaseAdmin
      .from('positions')
      .select('*')
      .eq('order_id', orderId)
      .eq('user_public_key', walletAddress)
      .single();
    
    if (positionError || !position) {
      return { 
        success: false, 
        error: positionError?.message || "Position not found" 
      };
    }
    
    if (position.status !== 'SETTLED') {
      return { 
        success: false, 
        error: `Position is in ${position.status} state. Only SETTLED positions can be claimed.`
      };
    }
    
    console.log(`Claiming position for order ID ${orderId}...`);
    
    // Call the vault claim function with the wallet, user public key, and order ID
    const signature = await claimPositionFromVault(wallet, userPubKey, orderId, payoutAmount);
    
    if (!signature) {
      throw new Error("Failed to claim position");
    }
    
    console.log(`Position claimed successfully! Transaction signature: ${signature}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Update position status in database
    const { error: updateError } = await supabaseAdmin
      .from('positions')
      .update({
        status: 'CLAIMED',
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId);
    
    if (updateError) {
      console.warn('Failed to update position status in the database, but transaction was successful');
    } else {
      console.log('Position status updated to CLAIMED in the database');
    }
    
    return { success: true, txHash: signature };
    
  } catch (err: any) {
    console.error('Error claiming position:', err);
    return { 
      success: false, 
      error: err.message || "Error claiming position" 
    };
  }
} 