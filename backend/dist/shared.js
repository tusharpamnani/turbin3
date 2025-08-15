"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pythSolanaReceiver = exports.priceServiceConnection = exports.BTC_FEED_ID = exports.program = exports.provider = exports.wallet = exports.signer = exports.secret = exports.connection = exports.supabase = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@coral-xyz/anchor");
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
const idl_json_1 = __importDefault(require("./idl.json"));
const pyth_solana_receiver_1 = require("@pythnetwork/pyth-solana-receiver");
const hermes_client_1 = require("@pythnetwork/hermes-client");
dotenv.config();
exports.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
exports.connection = new web3_js_1.Connection(process.env.SOLANA_RPC_URL || (0, web3_js_1.clusterApiUrl)('devnet'), {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
});
exports.secret = JSON.parse(process.env.SOLANA_PRIVATE_KEY || '');
exports.signer = web3_js_1.Keypair.fromSecretKey(Uint8Array.from(exports.secret));
exports.wallet = {
    payer: exports.signer,
    publicKey: exports.signer.publicKey,
    signTransaction: async (tx) => {
        if (tx instanceof web3_js_1.VersionedTransaction)
            tx.sign([exports.signer]);
        else
            tx.partialSign(exports.signer);
        return tx;
    },
    signAllTransactions: async (txs) => {
        for (const tx of txs) {
            if (tx instanceof web3_js_1.VersionedTransaction)
                tx.sign([exports.signer]);
            else
                tx.partialSign(exports.signer);
        }
        return txs;
    }
};
exports.provider = new anchor_1.AnchorProvider(exports.connection, exports.wallet, {
    commitment: 'confirmed',
});
exports.program = new anchor_1.Program(idl_json_1.default, exports.provider);
exports.BTC_FEED_ID = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
exports.priceServiceConnection = new hermes_client_1.HermesClient('https://hermes.pyth.network/', {});
exports.pythSolanaReceiver = new pyth_solana_receiver_1.PythSolanaReceiver({
    connection: exports.connection,
    wallet: exports.wallet,
});
