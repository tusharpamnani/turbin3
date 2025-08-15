"use client";

import { supabaseAdmin } from "../lib/supabaseClient";

export async function fetchUserBalance(wallet: any): Promise<{ balance: number | null; error?: string }> {
  if (!wallet.publicKey) {
    return { balance: null, error: "Wallet not connected" };
  }

  try {
    const walletAddress = wallet.publicKey.toBase58();
    
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('wallet_address', walletAddress)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user:', userError);
      return { balance: 0, error: "User not found" };
    }

    const { data: balanceData, error: balanceError } = await supabaseAdmin
      .from('balances')
      .select('total_deposited, locked_amount')
      .eq('user_id', userData.id)
      .single();

    if (balanceError) {
      console.error('Error fetching balance:', balanceError);
      return { balance: 0, error: balanceError.message };
    }

    return { balance: balanceData?.total_deposited || 0 };
  } catch (err: any) {
    console.error('Failed to fetch user balance:', err);
    return { 
      balance: null, 
      error: err.message || "Error fetching balance" 
    };
  }
} 