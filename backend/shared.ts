import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  ConnectionConfig
} from '@solana/web3.js';
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import idl from './idl.json';
import { PythSolanaReceiver } from '@pythnetwork/pyth-solana-receiver';
import { HermesClient } from '@pythnetwork/hermes-client';

dotenv.config();

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const connection = new Connection(
  process.env.SOLANA_RPC_URL || clusterApiUrl('devnet'),
  {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  } as ConnectionConfig
);

export const secret = JSON.parse(process.env.SOLANA_PRIVATE_KEY || '');
export const signer = Keypair.fromSecretKey(Uint8Array.from(secret));

export const wallet = {
  payer: signer,
  publicKey: signer.publicKey,
  signTransaction: async (tx: any) => {
    if (tx instanceof VersionedTransaction) tx.sign([signer]);
    else tx.partialSign(signer);
    return tx;
  },
  signAllTransactions: async (txs: any[]) => {
    for (const tx of txs) {
      if (tx instanceof VersionedTransaction) tx.sign([signer]);
      else tx.partialSign(signer);
    }
    return txs;
  }
};

export const provider = new AnchorProvider(connection, wallet, {
  commitment: 'confirmed',
});

export const program = new Program(idl as Idl, provider);

export const BTC_FEED_ID = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';

export const priceServiceConnection = new HermesClient(
  'https://hermes.pyth.network/',
  {}
);

export const pythSolanaReceiver = new PythSolanaReceiver({
  connection,
  wallet,
});