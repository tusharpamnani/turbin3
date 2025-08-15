import { PublicKey, SystemProgram} from '@solana/web3.js';
import BN from 'bn.js';

import { supabase, program, signer, priceServiceConnection, pythSolanaReceiver, BTC_FEED_ID, connection } from './shared';


async function init_pool() {
  try {
    console.log('Checking if trading pool exists...');
    

    const [tradingPoolPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('trading_pool')],
      program.programId
    );
 
    const [tradingPoolVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('trading_pool_vault'), tradingPoolPDA.toBuffer()],
      program.programId
    );
    

    try {
      const poolAccount = await (program.account as any).tradingPool.fetch(tradingPoolPDA);
      console.log('Trading pool already exists:', poolAccount.authority.toString());
      return;
    } catch (error) {
      console.log('Trading pool does not exist, creating now...');
    }
    
    const tx = await program.methods
      .initTradingPool()
      .accounts({
        admin: signer.publicKey,
        tradingPool: tradingPoolPDA,
        tradingPoolVault: tradingPoolVaultPDA,
        systemProgram: SystemProgram.programId
      })
      .signers([signer])
      .rpc();
    
    console.log('Trading pool initialized successfully!');
    console.log('Transaction signature:', tx);
    console.log('Trading pool address:', tradingPoolPDA.toString());
    console.log('Trading pool vault address:', tradingPoolVaultPDA.toString());
    
  } catch (error) {
    console.error('Error initializing trading pool:', error);
    throw error;
  }
}

if (require.main === module) {
  init_pool()
    .then(() => {
      console.log('Trading pool initialization process completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Trading pool initialization failed:', error);
      process.exit(1);
    });
}

export { init_pool };