"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.init_pool = init_pool;
const web3_js_1 = require("@solana/web3.js");
const shared_1 = require("./shared");
async function init_pool() {
    try {
        console.log('Checking if trading pool exists...');
        const [tradingPoolPDA] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('trading_pool')], shared_1.program.programId);
        const [tradingPoolVaultPDA] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('trading_pool_vault'), tradingPoolPDA.toBuffer()], shared_1.program.programId);
        try {
            const poolAccount = await shared_1.program.account.tradingPool.fetch(tradingPoolPDA);
            console.log('Trading pool already exists:', poolAccount.authority.toString());
            return;
        }
        catch (error) {
            console.log('Trading pool does not exist, creating now...');
        }
        const tx = await shared_1.program.methods
            .initTradingPool()
            .accounts({
            admin: shared_1.signer.publicKey,
            tradingPool: tradingPoolPDA,
            tradingPoolVault: tradingPoolVaultPDA,
            systemProgram: web3_js_1.SystemProgram.programId
        })
            .signers([shared_1.signer])
            .rpc();
        console.log('Trading pool initialized successfully!');
        console.log('Transaction signature:', tx);
        console.log('Trading pool address:', tradingPoolPDA.toString());
        console.log('Trading pool vault address:', tradingPoolVaultPDA.toString());
    }
    catch (error) {
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
