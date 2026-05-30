// Shared constants for the SOL/USDC DLMM manager. Safe to import from client or server.

export const DEFAULT_POOL_ADDRESS =
  "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6";

// DLMM program (mainnet). Verified on-chain from real position txns.
export const DLMM_PROGRAM_ID = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";

export const TOKENS = {
  SOL: {
    symbol: "SOL",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
  },
  USDC: {
    symbol: "USDC",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
  },
} as const;

// Meteora DLMM data API (read-only pool/position/analytics data).
export const DATAPI_BASE = "https://dlmm.datapi.meteora.ag";

// Native SOL kept in reserve when picking "100%" of the SOL balance for a
// deposit/swap — covers tx fees + wSOL wrap rent so the tx doesn't fail.
export const SOL_RESERVE_LAMPORTS = "30000000"; // 0.03 SOL

// SDK hard limits (from @meteora-ag/dlmm 1.9.x).
export const MAX_POSITION_BINS = 1400; // extended position cap
export const BINS_PER_BIN_ARRAY = 70;
export const MAX_BIN_LENGTH_PER_TX = 26; // MAX_BIN_LENGTH_ALLOWED_IN_ONE_TX
