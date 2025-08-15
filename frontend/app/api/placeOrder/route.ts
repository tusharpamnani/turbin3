/*
 * NOTE: This API route is no longer used.
 * Order placement is now handled client-side in app/services/orderbook.ts.
 * Keeping this file for reference only.
 */

import {NextRequest, NextResponse} from "next/server";
import {transferFundsToVault} from "../../services/vault";
import { supabaseAdmin } from "../../lib/supabaseClient";

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { walletAddress, amount, side, points} = body;

    if(!walletAddress || !amount || !side || !points) {
        return NextResponse.json(
            {error: "Missing required fields"},
            {status: 400}
        );
    }

    try {
        const success = await transferFundsToVault({publicKey: walletAddress},amount);
        if(!success) throw new Error('vault deposit failed');

        const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .upsert({ wallet_address: walletAddress }, { onConflict: 'wallet_address' })
        .select('id')
        .single();

        if(userError || !userData) throw userError || new Error('failed to fetch user data');

        const { error: orderError } = await supabaseAdmin.from('orders').insert([
            {
              user_id: userData.id,
              side,
              points,
              amount,
              status: 'OPEN',
            },
          ]);

        if(orderError) throw orderError;

        return NextResponse.json({message: 'Order Placed Succesfully' });        
    } catch (err : any){
        console.error('Order Placement error', err);
        return NextResponse.json({error: err.message || "Internal Server Error"}, {status: 500});
    }
    
}