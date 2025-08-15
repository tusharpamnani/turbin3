"use client"

import { SystemProgram, LAMPORTS_PER_SOL, PublicKey, VersionedTransaction, TransactionInstruction, Transaction } from "@solana/web3.js";
import { connection } from "../constants/constants";
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import BN from "bn.js";
import idl from "../idl/vault.json"

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function transferFundsToVault(wallet: any, amount: number, orderId: number = 1) {
    let retries = 3;
    
    while (retries > 0) {
      try {
        const provider = new AnchorProvider(connection, wallet, {
          commitment: 'confirmed',
          preflightCommitment: 'processed',
        });
        
        // Always pass the program ID as the second argument!
        const program = new Program(
          idl as Idl,
          // "9bqQoWC9ovH3FFGzEAV2MJJkF1uNuS4EVGZ2SmRw17w8",
          provider
        );
    
        const userPubkey = provider.wallet.publicKey;
    
        const lamports = new BN(amount * LAMPORTS_PER_SOL);
    
        const [vaultStatePDA] = await PublicKey.findProgramAddressSync(
          [Buffer.from("vault_state"), userPubkey.toBuffer()],
          program.programId
        );
    
        const [vaultPDA] = await PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), vaultStatePDA.toBuffer()],
          program.programId
        );
    
        const vaultStateAccount = await connection.getAccountInfo(vaultStatePDA);
        if (!vaultStateAccount) {
          console.log("Vault not initialized. Initializing now...");
    
          const initTxn = await program.methods
            .initialize()
            .accounts({
              user: userPubkey,
              vault_state: vaultStatePDA,
              vault: vaultPDA,
              system_program: SystemProgram.programId,
            })
            .rpc(); 
    
          console.log("Vault initialized:", initTxn);
        }
    
        const txn = await program.methods
          .deposit(lamports, new BN(orderId))
          .accounts({
            user: userPubkey,
            vault_state: vaultStatePDA,
            vault: vaultPDA,
            system_program: SystemProgram.programId,
          })
          .rpc({
            skipPreflight: true
          });
    
        console.log("Deposit successful:", txn);
        return txn;
    
      } catch (err: any) {
        retries--;
        console.error(`Error transferring funds (${retries} retries left):`, err);
        
        if (err.message && (
            err.message.includes("This transaction has already been processed") || 
            err.message.includes("Transaction simulation failed")
          )) {
          await sleep(1000);
          continue;
        }
        
        return false;
      }
    }
    
    return false;
  }


  export async function claimPosition(wallet: any, userPubKey: PublicKey, order_id: number, payoutAmount: number) {
    let retries = 3;

    while (retries > 0) {
      try {
        const provider = new AnchorProvider(connection, wallet, {
          commitment: 'confirmed',
          preflightCommitment: 'processed',
        });

        const program = new Program(idl as Idl, provider);
        const bnOrderId = new BN(order_id);
        const userPubkey = userPubKey;

        const [vaultStatePDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault_state'), userPubkey.toBuffer()],
          program.programId
        );
        
        const [vaultPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault'), vaultStatePDA.toBuffer()],
          program.programId
        );
        
        const [positionPDA] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('position'),
            userPubkey.toBuffer(),
            bnOrderId.toArrayLike(Buffer, 'le', 8)
          ],
          program.programId
        );
    
        const [tradingPoolPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('trading_pool')],
          program.programId
        );
        
        const [tradingPoolVaultPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('trading_pool_vault'), tradingPoolPDA.toBuffer()],
          program.programId
        );
        
        const programId = program.programId;
        
        const data = Buffer.from([168, 90, 89, 44, 203, 246, 210, 46]); 
        
        const orderIdBuffer = bnOrderId.toArrayLike(Buffer, 'le', 8);
        const instructionData = Buffer.concat([data, orderIdBuffer]);
        
        const ix = new TransactionInstruction({
          programId,
          keys: [
            { pubkey: userPubkey, isSigner: true, isWritable: true },
            { pubkey: positionPDA, isSigner: false, isWritable: true },
            { pubkey: vaultPDA, isSigner: false, isWritable: true },
            { pubkey: vaultStatePDA, isSigner: false, isWritable: false },
            { pubkey: tradingPoolPDA, isSigner: false, isWritable: true },
            { pubkey: tradingPoolVaultPDA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
          ],
          data: instructionData
        });

        const transaction = new Transaction().add(ix);
        
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userPubkey;
        
        const signedTransaction = await wallet.signTransaction(transaction);
        
        const txn = await connection.sendRawTransaction(
          signedTransaction.serialize(),
          { skipPreflight: true }
        );
        
        await connection.confirmTransaction(txn, 'confirmed');

        console.log("Claim position successful:", txn);

        await withdrawFundsFromVault(wallet, payoutAmount, order_id);
        return txn;
      } catch (err: any) {
        retries--;
        console.error(`Error claiming position (${retries} retries left):`, err);
        
        if (err.message && (
            err.message.includes("This transaction has already been processed") || 
            err.message.includes("Transaction simulation failed")
          )) {
          await sleep(1000);
          continue;
        }
        
        return false;
      }
    }
    
    return false;
  }


  export async function withdrawFundsFromVault(wallet: any, amount: number, orderId: number = 1) {
    let retries = 3; 
    
    while (retries > 0) {
      try {
        const provider = new AnchorProvider(connection, wallet, {
          commitment: 'confirmed',
          preflightCommitment: 'processed',
        });

        const program = new Program(
          idl as Idl,
          // "9bqQoWC9ovH3FFGzEAV2MJJkF1uNuS4EVGZ2SmRw17w8",
          provider
        );
    
        const userPubkey = provider.wallet.publicKey;
    
        const lamports = new BN(amount * LAMPORTS_PER_SOL);
    
        const [vaultStatePDA] = await PublicKey.findProgramAddressSync(
          [Buffer.from("vault_state"), userPubkey.toBuffer()],
          program.programId
        );
    
        const [vaultPDA] = await PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), vaultStatePDA.toBuffer()],
          program.programId
        );

        const txn = await program.methods
          .withdraw(lamports, new BN(orderId))
          .accounts({
            user: userPubkey,
            vault_state: vaultStatePDA,
            vault: vaultPDA,
            system_program: SystemProgram.programId,
          })
          .rpc({
            skipPreflight: true
          });

        console.log("Withdrawal successful:", txn);
        return txn;
      } catch (err: any) {
        retries--;
        console.error(`Error withdrawing funds (${retries} retries left):`, err);
        
        if (err.message && (
            err.message.includes("This transaction has already been processed") || 
            err.message.includes("Transaction simulation failed")
          )) {
          await sleep(1000);
          continue;
        }
        
        return false;
      }
    }
    
    return false;
  }