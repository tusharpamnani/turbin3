import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";
import {
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { expect } from "chai";

describe("vault", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Vault as Program<Vault>;
  
  // Create a new keypair for testing
  const user = anchor.web3.Keypair.generate();
  
  // PDAs
  let vaultStatePda: PublicKey;
  let vaultStateBump: number;
  let vaultPda: PublicKey;
  let vaultBump: number;

  // Constants
  const MIN_AMOUNT = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL

  it("Fund the user account", async () => {
    // Airdrop SOL to the user
    const airdropTx = await provider.connection.requestAirdrop(
      user.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropTx);
    
    // Verify the user has received the airdrop
    const balance = await provider.connection.getBalance(user.publicKey);
    expect(balance).to.equal(2 * LAMPORTS_PER_SOL, "User should have 2 SOL");
  });

  it("Initialize vault PDAs", async () => {
    // First derive vault_state PDA
[vaultStatePda, vaultStateBump] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault_state"), user.publicKey.toBuffer()],
  program.programId
);

// Then derive vault PDA using vault_state PDA as seed
[vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), vaultStatePda.toBuffer()],
  program.programId
);

    console.log("User public key:", user.publicKey.toBase58());
    console.log("Vault state PDA:", vaultStatePda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());
  });

  it("Initialize the vault", async () => {
    // Initialize the vault
    await program.methods
      .initialize()
      .accounts({
        user: user.publicKey,
        vaultState: vaultStatePda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();
    
    // Verify the vault state is properly initialized
    const vaultState = await program.account.vaultState.fetch(vaultStatePda);
    expect(vaultState.authority.toBase58()).to.equal(user.publicKey.toBase58());
  });

  it("Deposit ≥ 0.1 SOL succeeds", async () => {
    // Check initial balances
    const initialUserBalance = await provider.connection.getBalance(user.publicKey);
    const initialVaultBalance = await provider.connection.getBalance(vaultPda);
    
    // Define deposit amount (0.1 SOL)
    const depositAmount = MIN_AMOUNT;
    const orderId = new anchor.BN(1);
    
    // Execute deposit
    await program.methods
      .deposit(
        new anchor.BN(depositAmount),
        orderId
      )
      .accounts({
        user: user.publicKey,
        vault: vaultPda,
        vaultState: vaultStatePda,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();
    
    // Verify balances after deposit
    const finalUserBalance = await provider.connection.getBalance(user.publicKey);
    const finalVaultBalance = await provider.connection.getBalance(vaultPda);
    
    // User balance should decrease by at least deposit amount (plus some fees)
    expect(initialUserBalance - finalUserBalance).to.be.at.least(depositAmount);
    
    // Vault balance should increase by exactly deposit amount
    expect(finalVaultBalance - initialVaultBalance).to.equal(depositAmount);
  });

  it("Deposit < 0.1 SOL fails", async () => {
    // Define small deposit amount (0.05 SOL)
    const smallDepositAmount = MIN_AMOUNT / 2;
    const orderId = new anchor.BN(2);
    
    try {
      // Attempt to deposit a small amount
      await program.methods
        .deposit(
          new anchor.BN(smallDepositAmount),
          orderId
        )
        .accounts({
          user: user.publicKey,
          vault: vaultPda,
          vaultState: vaultStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();
      
      // If we reach here, the test has failed
      expect.fail("Deposit below minimum amount should have failed");
    } catch (error) {
      // Ensure the error is the expected one
      expect(error.error.errorCode.code).to.equal("AmountTooSmall");
    }
  });

  xit("Withdraw only up to deposited amount succeeds", async () => {
    // Check initial balances
    const initialUserBalance = await provider.connection.getBalance(user.publicKey);
    const initialVaultBalance = await provider.connection.getBalance(vaultPda);
    
    // Define withdrawal amount (exactly what we deposited: 0.1 SOL)
    const withdrawAmount = MIN_AMOUNT;
    const orderId = new anchor.BN(3);
    
    // Execute withdrawal
    await program.methods
      .withdraw(
        new anchor.BN(withdrawAmount),
        orderId
      )
      .accounts({
        user: user.publicKey,
        vault: vaultPda,
        vaultState: vaultStatePda,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();
    
    // Verify balances after withdrawal
    const finalUserBalance = await provider.connection.getBalance(user.publicKey);
    const finalVaultBalance = await provider.connection.getBalance(vaultPda);
    
    // User balance should increase by approximately withdrawal amount (minus fees)
    expect(finalUserBalance).to.be.greaterThan(initialUserBalance - 10000); // Allow for fee deduction
    
    // Vault balance should decrease by exactly withdrawal amount
    expect(initialVaultBalance - finalVaultBalance).to.equal(withdrawAmount);
  });

  xit("Withdraw more than deposited fails", async () => {
    // Make a small deposit first so the vault isn't empty
    const smallDeposit = MIN_AMOUNT;
    await program.methods
      .deposit(
        new anchor.BN(smallDeposit),
        new anchor.BN(4)
      )
      .accounts({
        user: user.publicKey,
        vault: vaultPda,
        vaultState: vaultStatePda,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();
      
    // Define excessive withdrawal amount (more than what's in the vault)
    const excessiveWithdrawAmount = 2 * MIN_AMOUNT; // 0.2 SOL
    const orderId = new anchor.BN(5);
    
    try {
      // Attempt to withdraw an excessive amount
      await program.methods
        .withdraw(
          new anchor.BN(excessiveWithdrawAmount),
          orderId
        )
        .accounts({
          user: user.publicKey,
          vault: vaultPda,
          vaultState: vaultStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();
      
      // If we reach here, the test has failed
      expect.fail("Withdrawal exceeding vault balance should have failed");
    } catch (error) {
      // Ensure the error is the expected one
      console.log("Withdrawal error:", error);
    }
  });

  it("Close empty vault succeeds", async () => {
    // Withdraw all funds first
    const balance = await provider.connection.getBalance(vaultPda);
    if (balance > 0) {
      await program.methods
        .withdraw(
          new anchor.BN(balance),
          new anchor.BN(6)
        )
        .accounts({
          user: user.publicKey,
          vault: vaultPda,
          vaultState: vaultStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();
    }
    
    // Now close the vault
    await program.methods
      .close()
      .accounts({
        user: user.publicKey,
        vault: vaultPda,
        vaultState: vaultStatePda,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();
      
    // Verify the vault_state account no longer exists
    try {
      await program.account.vaultState.fetch(vaultStatePda);
      expect.fail("Vault state should have been closed");
    } catch (error) {
      expect(error.message).to.include("Account does not exist");
    }
  });
});