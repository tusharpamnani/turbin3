import { AnchorProvider, Idl } from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import idl from "../idl/vault.json"
import { Connection, ConnectionConfig, PublicKey , clusterApiUrl } from "@solana/web3.js"

export const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("devnet");

export const connection = new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('devnet'),
    {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    } as ConnectionConfig
  );


