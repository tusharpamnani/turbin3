import { PublicKey, SystemProgram} from '@solana/web3.js';
import BN from 'bn.js';

import { supabase, program, signer, priceServiceConnection, pythSolanaReceiver, BTC_FEED_ID, connection } from './shared';


async function fetchCurrentBTCPrice(): Promise<{rawPrice: number, humanReadablePrice: number}> {
  const res = await fetch(
    'https://hermes.pyth.network/v2/updates/price/latest?ids[]=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'
  );
  if (!res.ok) throw new Error('Failed to fetch BTC price');
  const data = await res.json();
  const pythPrice = data.parsed?.[0]?.price;
  if (!pythPrice) throw new Error('Invalid price data');
  // Return both raw price (for on-chain use) and human readable price (for DB)
  return {
    rawPrice: pythPrice.price,
    humanReadablePrice: parseFloat((pythPrice.price * Math.pow(10, pythPrice.expo)).toFixed(8))
  };
}

class MatchingService {
  private intervalId: NodeJS.Timeout | null = null;
  private _isRunning: boolean = false;
  private intervalMinutes: number;

  constructor(intervalMinutes = 1) {
    this.intervalMinutes = intervalMinutes;
  }

  public get isRunning(): boolean {
    return this._isRunning;
  }

  async start() {
    if (this._isRunning) return;
    this._isRunning = true;
    console.log(`Starting matching service (running every ${this.intervalMinutes} minutes)...`);

    await this.processMatchAndPlace();

    this.intervalId = setInterval(
      this.processMatchAndPlace.bind(this), 
      this.intervalMinutes * 60 * 1000
    );

    console.log('Matching service started');
  }

  stop() {
    if (!this._isRunning) return;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this._isRunning = false;
    console.log('Matching service stopped');
  }

  async processMatchAndPlace() {
    try {
      console.log('Processing match and place...');
      const { data: orders, error } = await supabase.from('orders').select('*').eq('status', 'OPEN');
      if (error || !orders) {
        console.log('No open orders to process');
        return;
      }

      const trades = [];
      const placed = [];
      const grouped = new Map();

      for (const order of orders) {
        if (!grouped.has(order.points)) grouped.set(order.points, { longs: [], shorts: [] });
        grouped.get(order.points)[order.side === 'LONG' ? 'longs' : 'shorts'].push({ ...order });
      }

      for (const [points, { longs, shorts }] of grouped.entries()) {
        const validLongs = longs.filter((l: any) => l.amount - l.filled_amount > 0.000000001);
        const validShorts = shorts.filter((s: any) => s.amount - s.filled_amount > 0.000000001);
        
        // Sort by creation time (ID) for fair processing
        validLongs.sort((a: any, b: any) => a.id - b.id);
        validShorts.sort((a: any, b: any) => a.id - b.id);

        // Process all possible matches at this points level
        let longIndex = 0;
        let shortIndex = 0;

        while (longIndex < validLongs.length && shortIndex < validShorts.length) {
          const long = validLongs[longIndex];
          const short = validShorts[shortIndex];
          
          // Calculate available amounts
          const longAvailable = long.amount - long.filled_amount;
          const shortAvailable = short.amount - short.filled_amount;
          
          // Skip fully filled orders
          if (longAvailable <= 0.000000001) {
            longIndex++;
            continue;
          }
          
          if (shortAvailable <= 0.000000001) {
            shortIndex++;
            continue;
          }
          
          // Calculate match amount
          const matchAmount = Math.min(longAvailable, shortAvailable);
          const lamports = Math.floor(matchAmount * 1_000_000_000);
          
          // Minimum viable trade size
          if (lamports < 200_000_000) {
            // Try next short order if this one is too small
            if (shortIndex < validShorts.length - 1) {
              shortIndex++;
            } else if (longIndex < validLongs.length - 1) {
              // Or try next long order if we've gone through all shorts
              longIndex++;
              shortIndex = 0;
            } else {
              break;
            }
            continue;
          }

          const price = await fetchCurrentBTCPrice();
          const lowerBound = Math.round(price.rawPrice * (1 - points / 100));
          const upperBound = Math.round(price.rawPrice * (1 + points / 100));

          const flowerBound = lowerBound / 100000000;
          const fupperBound = upperBound / 100000000;

          console.log( "lowerBound, upperBound", lowerBound, upperBound);

          const priceUpdateData = (
            await priceServiceConnection.getLatestPriceUpdates([BTC_FEED_ID], { encoding: "base64" })
          ).binary.data;

          const [tradingPoolPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('trading_pool')],
            program.programId
          );
          
          const [tradingPoolVaultPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('trading_pool_vault'), tradingPoolPDA.toBuffer()],
            program.programId
          );

          const orderPromises = await Promise.all([long, short].map(async (order) => {
            const { data: user } = await supabase.from('users')
              .select('*')
              .eq('id', order.user_id)
              .single();

            if (!user) {
              throw new Error(`User not found for order ${order.id}`);
            }

            const userKey = new PublicKey(user.wallet_address);

            // Position Direction - Map LONG to Breakout, SHORT to StayIn
            const pt = order.side === 'LONG' ? { breakout: {} } : { stayIn: {} };

            const [vaultStatePDA] = PublicKey.findProgramAddressSync(
              [Buffer.from('vault_state'), userKey.toBuffer()],
              program.programId
            );

            const [vaultPDA] = PublicKey.findProgramAddressSync(
              [Buffer.from('vault'), vaultStatePDA.toBuffer()],
              program.programId
            );

            const [positionPDA] = PublicKey.findProgramAddressSync(
              [
                Buffer.from('position'),
                userKey.toBuffer(),
                new BN(order.id).toArrayLike(Buffer, 'le', 8)
              ],
              program.programId
            );

            try {
              const { data: existingPosition } = await supabase
                .from('positions')
                .select('id')
                .eq('user_public_key', user.wallet_address)
                .eq('order_id', order.id)
                .single();
              
              if (existingPosition) {
                console.log(`⚠️ Position for order ${order.id} (user ${user.wallet_address}) already exists in database, skipping creation.`);
                return {
                  order,
                  userWallet: user.wallet_address,
                  positionPDA: positionPDA.toString(),
                  txPromise: Promise.resolve(),
                  alreadyExists: true
                };
              }
              
              try {
                const accountInfo = await connection.getAccountInfo(positionPDA);
                if (accountInfo) {
                  console.log(`⚠️ Position account ${positionPDA.toString()} already exists on-chain, skipping creation.`);
                  return {
                    order,
                    userWallet: user.wallet_address,
                    positionPDA: positionPDA.toString(),
                    txPromise: Promise.resolve(),
                    alreadyExists: true
                  };
                }
              } catch (error) {
                console.error(`Error checking position account ${positionPDA.toString()}:`, error);
              }
            } catch (error) {
              console.error(`Error checking if position exists for order ${order.id}:`, error);
            }

            // Build transaction for creating the position
            const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({
              closeUpdateAccounts: false,
            });

            await transactionBuilder.addPostPriceUpdates(priceUpdateData);

            await transactionBuilder.addPriceConsumerInstructions(async (getPriceUpdateAccount) => {
              const priceUpdateAccount = getPriceUpdateAccount(BTC_FEED_ID);
              const ix = await program.methods
                .createPosition(pt, new BN(lowerBound), new BN(upperBound), new BN(order.id), new BN(lamports))
                .accounts({
                  user: userKey,
                  admin: signer.publicKey,
                  position: positionPDA,
                  userVault: vaultPDA,
                  userVaultState: vaultStatePDA,
                  tradingPool: tradingPoolPDA,
                  tradingPoolVault: tradingPoolVaultPDA,
                  priceUpdate: priceUpdateAccount,
                  systemProgram: SystemProgram.programId
                })
                .instruction();
              return [{ instruction: ix, signers: [signer] }];
            });

            const txPromise = pythSolanaReceiver.provider.sendAll(
              await transactionBuilder.buildVersionedTransactions({
                computeUnitPriceMicroLamports: 50000,
              }),
              { preflightCommitment: "processed" }
            );
            
            return {
              order,
              userWallet: user.wallet_address,
              positionPDA: positionPDA.toString(),
              txPromise,
              alreadyExists: false
            };
          }));
          
          // Wait for all transactions to complete
          for (const orderData of orderPromises) {
            try {
              if (!orderData.alreadyExists) {
                await orderData.txPromise;
                
                // Insert position record after the transaction completes
                await supabase.from('positions').insert({
                  user_public_key: orderData.userWallet,
                  order_id: orderData.order.id,
                  on_chain_position_address: orderData.positionPDA,
                  amount: lamports / 1_000_000_000,
                  lower_bound: flowerBound,
                  upper_bound: fupperBound,
                  position_type: orderData.order.side === 'LONG' ? 1 : 0,
                  btc_price_at_creation: price.humanReadablePrice
                });
              }
            } catch (error: any) {
              console.error(`Error processing order ${orderData.order.id}:`, error);
              
              if (error.toString().includes('already in use')) {
                console.log(`⚠️ Position for order ${orderData.order.id} already exists (account already in use)`);
                
                try {
                  const { data: existingPosition } = await supabase
                    .from('positions')
                    .select('id')
                    .eq('user_public_key', orderData.userWallet)
                    .eq('order_id', orderData.order.id)
                    .single();
                  
                  if (!existingPosition) {
                    console.log(`Creating database record for existing position ${orderData.positionPDA}`);
                    await supabase.from('positions').insert({
                      user_public_key: orderData.userWallet,
                      order_id: orderData.order.id,
                      on_chain_position_address: orderData.positionPDA,
                      amount: lamports / 1_000_000_000,
                      lower_bound: flowerBound,
                      upper_bound: fupperBound,
                      position_type: orderData.order.side === 'LONG' ? 1 : 0,
                      btc_price_at_creation: price.humanReadablePrice
                    });
                  }
                } catch (dbError) {
                  console.error(`Error checking/creating position record:`, dbError);
                }
              } else {
                // For other types of errors, just log them
                console.error(`Error creating position for order ${orderData.order.id}:`, error);
              }
            }
          }
          
          // Update order fill amounts
          long.filled_amount += matchAmount;
          short.filled_amount += matchAmount;

          // Update order status in database
          const longStatus = long.filled_amount >= long.amount - 0.000000001 ? 'FILLED' : 'PARTIALLY_FILLED';
          const shortStatus = short.filled_amount >= short.amount - 0.000000001 ? 'FILLED' : 'PARTIALLY_FILLED';
          
          await supabase.from('orders').update({ 
            filled_amount: long.filled_amount,
            status: longStatus
          }).eq('id', long.id);
          
          await supabase.from('orders').update({ 
            filled_amount: short.filled_amount,
            status: shortStatus
          }).eq('id', short.id);

          // Record trade
          trades.push({
            stay_in_order_id: long.id,
            break_out_order_id: short.id,
            points,
            amount: matchAmount,
            executed_at: new Date().toISOString(),
            execution_price: price.humanReadablePrice
          });

          // Move to next order if fully filled
          if (longStatus === 'FILLED') {
            longIndex++;
          }
          
          if (shortStatus === 'FILLED') {
            shortIndex++;
          }
          
          // If both orders still have remaining amounts, continue matching them
          if (longStatus !== 'FILLED' && shortStatus !== 'FILLED') {
            // Move to next combination
            if (shortIndex < validShorts.length - 1) {
              shortIndex++;
            } else {
              longIndex++;
              shortIndex = 0;
            }
          }
        }
      }

      if (trades.length) {
        const { error: tradeInsertError } = await supabase.from('trades').insert(trades);
        if (tradeInsertError) console.error('Failed to insert trades:', tradeInsertError);
      }

      if (placed.length) {
        console.log(`Successfully placed ${placed.length} positions`);
      } else {
        console.log('No matches found to process');
      }

      console.log(`Processed ${trades.length} trades`);
    } catch (err: any) {
      console.error('Match and place error:', err);
    }
  }
}

const matchingService = new MatchingService(0.1);

export { matchingService };

if (require.main === module) {
  console.log('Starting matching service as standalone process');
  matchingService.start();
  
  process.on('SIGINT', () => {
    console.log('Shutting down matching service...');
    matchingService.stop();
    process.exit(0);
  });
} 