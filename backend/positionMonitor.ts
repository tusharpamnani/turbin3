import { PublicKey, SendTransactionError} from '@solana/web3.js';
import { BN } from 'bn.js';
import * as dotenv from 'dotenv';
import {
  BTC_FEED_ID,
  priceServiceConnection,
  pythSolanaReceiver,
  program,
  supabase,
  signer
} from './shared';

dotenv.config();

async function fetchCurrentBTCPrice(): Promise<{rawPrice: number, humanReadablePrice: number}> {
  try {
    const res = await fetch(
      'https://hermes.pyth.network/v2/updates/price/latest?ids[]=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'
    );
    if (!res.ok) throw new Error('Failed to fetch BTC price');
    const data = await res.json();
    const pythPrice = data.parsed?.[0]?.price;
    if (!pythPrice) throw new Error('Invalid price data');
    
    return {
      rawPrice: pythPrice.price,
      humanReadablePrice: parseFloat((pythPrice.price * Math.pow(10, pythPrice.expo)).toFixed(8))
    };
  } catch (error) {
    console.error('Error in fetchCurrentBTCPrice:', error);
    throw error;
  }
}

async function shouldCheckPosition(position: any): Promise<boolean> {
  try {
    const createdAt = new Date(position.created_at);
    const now = new Date();
    const timeDiffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    
    if (timeDiffHours >= 24) {
      console.log(`Position ${position.on_chain_position_address} is over 24 hours old - checking on-chain`);
      return true;
    }
    
    try {
      const currentPrice = await fetchCurrentBTCPrice();
      
      if (position.lower_bound && position.upper_bound) {
        const lowerBound = parseInt(position.lower_bound) * 100000000;
        const upperBound = parseInt(position.upper_bound) * 100000000;
        
        console.log("lowerBound, upperBound", lowerBound, upperBound);
        
        if (currentPrice.rawPrice <= lowerBound || currentPrice.rawPrice >= upperBound) {
          console.log(`Position ${position.on_chain_position_address} price breakout detected - checking on-chain`);
          console.log(`Current price: ${currentPrice.rawPrice}, Bounds: ${lowerBound}-${upperBound}`);
          return true;
        }
      }
      
      console.log(`Position ${position.on_chain_position_address} - price still within bounds, skipping on-chain check`);
      return false;
    } catch (error) {
      console.error('Error fetching current BTC price:', error);
      return true;
    }
  } catch (error) {
    console.error(`Error checking if position ${position?.id} needs settlement:`, error);
    return true;
  }
}

async function checkPosition(userKey: PublicKey, orderId: number) {
  try {
    const bnOrderId = new BN(orderId);

    const [positionPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('position'),
        userKey.toBuffer(),
        bnOrderId.toArrayLike(Buffer, 'le', 8)
      ],
      program.programId
    );

    const priceUpdateData = (
      await priceServiceConnection.getLatestPriceUpdates([BTC_FEED_ID], { encoding: "base64" })
    ).binary.data;

    const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({
      closeUpdateAccounts: false,
    });

    await transactionBuilder.addPostPriceUpdates(priceUpdateData);

    await transactionBuilder.addPriceConsumerInstructions(async (getPriceUpdateAccount) => {
      const priceUpdateAccount = getPriceUpdateAccount(BTC_FEED_ID);

      const programId = program.programId;
      const data = Buffer.from([208, 242, 101, 15, 55, 242, 83, 5]); // check_position discriminator
      
      const orderIdBuffer = bnOrderId.toArrayLike(Buffer, 'le', 8);
      const instructionData = Buffer.concat([data, orderIdBuffer]);
      
      const ix = {
        programId,
        keys: [
          { pubkey: userKey, isSigner: false, isWritable: false },
          { pubkey: positionPDA, isSigner: false, isWritable: true },
          { pubkey: priceUpdateAccount, isSigner: false, isWritable: false }
        ],
        data: instructionData
      };

      console.log("Raw instruction data (hex):", instructionData.toString('hex'));

      return [{ instruction: ix, signers: [] }];
    });
    

    try {
      await pythSolanaReceiver.provider.sendAll(
        await transactionBuilder.buildVersionedTransactions({
          computeUnitPriceMicroLamports: 50000,
        }),
        { preflightCommitment: "processed" }
      );
      console.log('Transaction sent successfully');
    } catch (error: any) {
      console.error('Error sending transaction:', error);
    
      if (error instanceof SendTransactionError && error.logs) {
        console.error('Transaction logs:\n', error.logs.join('\n'));
      } else {
        console.error('No logs available for this transaction error.');
      }
    
      throw error;
    }

    const positionAccount = await (program.account as any).positionState.fetch(positionPDA);

    if (positionAccount.settlementData) {
      console.log('📊 Settlement Data:');
      console.log(`  - settlement_time: ${positionAccount.settlementData.settlementTime} (${new Date(positionAccount.settlementData.settlementTime * 1000).toISOString()})`);
      const rawPrice = positionAccount.settlementData.settlementPrice.toString();
      console.log("winning amount: ", positionAccount.settlementData
      );
      const humanReadablePrice = (Number(rawPrice) * Math.pow(10, -8)).toFixed(2);
      console.log(`  - settlement_price: ${rawPrice} (Human readable: $${humanReadablePrice})`);
      console.log(`  - payout_percentage: ${positionAccount.settlementData.payoutPercentage}`);
      console.log(`  - is_winner: ${positionAccount.settlementData.payoutPercentage > 100}`);
    }

    return {
      status: Object.keys(positionAccount.status)[0],
      settlementData: positionAccount.settlementData ?? null,
    };
  } catch (error) {
    console.error(`Error in checkPosition for user ${userKey.toString()} orderId ${orderId}:`, error);
    throw error;
  }
}

class PositionMonitor {
  private _isRunning = false;
  private syncIntervalId: NodeJS.Timeout | null = null;

  get isRunning(): boolean {
    return this._isRunning;
  }

  async start() {
    if (this._isRunning) return;
    this._isRunning = true;
    console.log('✅ Position monitor started');
    
    try {
      await this.syncPositionsFromChain();
      this.syncIntervalId = setInterval(() => {
        this.syncPositionsFromChain().catch(err => {
          console.error('Error in monitor interval callback:', err);
        });
      }, 15 * 1000);
    } catch (error) {
      console.error('Error starting position monitor:', error);
      this._isRunning = false;
    }
  }

  stop() {
    if (this.syncIntervalId) clearInterval(this.syncIntervalId);
    this._isRunning = false;
    console.log('🛑 Monitor stopped');
  }

  async syncPositionsFromChain() {
    try {
      const { data: positions, error } = await supabase
        .from('positions')
        .select('*')
        .eq('status', 'ACTIVE');

      if (error || !positions) {
        console.error('🔴 Failed to fetch active positions:', error);
        return;
      }

      console.log(`🔍 Found ${positions.length} active positions for off-chain filtering...`);

      const positionsToCheck = [];
      for (const position of positions) {
        try {
          const needsOnChainCheck = await shouldCheckPosition(position);
          if (needsOnChainCheck) {
            positionsToCheck.push(position);
          }
        } catch (positionError) {
          console.error(`Error filtering position ${position?.id}:`, positionError);
        }
      }

      console.log(`Off-chain filtering complete. ${positionsToCheck.length} of ${positions.length} positions need on-chain validation.`);

      if (positionsToCheck.length === 0) {
        return; 
      }

      const checkResults = await Promise.allSettled(
        positionsToCheck.map(async (pos) => {
          const user = new PublicKey(pos.user_public_key);
          const orderId = pos.order_id;

          try {
            const result = await checkPosition(user, orderId);
            return { pos, result, success: true };
          } catch (err) {
            console.error(`⚠️ Error checking position ${pos.id}:`, err);
            return { pos, success: false, error: err };
          }
        })
      );

      // Process the results of parallel execution
      for (const resultPromise of checkResults) {
        if (resultPromise.status === 'fulfilled' && resultPromise.value.success) {
          const { pos, result } = resultPromise.value;
          
          if (result && result.status === 'settled' && result.settlementData) {
            const percentage = result.settlementData.payoutPercentage;
            const amountInSol = typeof pos.amount === 'number' ? pos.amount : Number(pos.amount);
            const payout = amountInSol * (percentage / 100);

            console.log(`📊 Position ${pos.on_chain_position_address} payout calculation:`);
            console.log(`  - amount: ${amountInSol} SOL`);
            console.log(`  - payout %: ${percentage}`);
            console.log(`  - payout = ${payout} SOL`);

            const { error: updateErr } = await supabase.from('positions')
              .update({
                status: 'SETTLED',
                settlement_time: new Date(result.settlementData.settlementTime * 1000).toISOString(),
                settlement_price: result.settlementData.settlementPrice.toString(),
                payout_percentage: percentage,
                payout_amount: payout,
                updated_at: new Date().toISOString()
              })
              .eq('id', pos.id);

            if (updateErr) console.error('❌ Failed to update DB:', updateErr);
            else console.log(`✅ Position ${pos.on_chain_position_address} settled at ${payout} SOL`);
          }
        }
      }
    } catch (err) {
      console.error(' Monitor failed:', err);
    }
  }
}

process.on('uncaughtException', (error) => {
  console.error('🚨 UNCAUGHT EXCEPTION 🚨', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 UNHANDLED REJECTION 🚨', reason);
});

const monitor = new PositionMonitor();
export { monitor };

if (require.main === module) {
  monitor.start().catch(err => {
    console.error('Failed to start monitor:', err);
  });
  
  process.on('SIGINT', () => {
    monitor.stop();
    process.exit(0);
  });
}
