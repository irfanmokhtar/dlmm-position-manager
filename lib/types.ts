// Client-safe shapes for API responses. No SDK imports here.

export interface TokenInfo {
  mint: string;
  decimals: number;
}

export interface BinData {
  binId: number;
  xAmount: string;
  yAmount: string;
  supply: string;
  price: string;
  pricePerToken: string;
  version: number;
}

export interface PoolResponse {
  pool: {
    address: string;
    binStep: number;
    tokenX: TokenInfo;
    tokenY: TokenInfo;
  };
  activeBin: { binId: number; price: string; pricePerToken: string };
  fees: { base: string; max: string; protocol: string; dynamic: string };
  bins: BinData[];
  datapi: { current_price?: number; liquidity?: number; name?: string } | null;
}

export interface PositionBin {
  binId: number;
  price: string;
  pricePerToken: string;
  positionXAmount: string;
  positionYAmount: string;
}

export interface PositionInfo {
  publicKey: string;
  lowerBinId: number;
  upperBinId: number;
  totalXAmount: string;
  totalYAmount: string;
  feeX: string;
  feeY: string;
  rewardOne: string;
  rewardTwo: string;
  binData: PositionBin[];
}

export interface PositionsResponse {
  owner: string;
  activeBinId: number;
  positions: PositionInfo[];
}

// Per-position PnL/analytics from the Meteora data API (client-safe subset).
export interface PositionPnL {
  positionAddress: string;
  createdAt: number; // unix seconds when the position was opened
  isClosed: boolean;
  pnlUsd: string;
  pnlSol: string | null;
  pnlPctChange: string;
  pnlSolPctChange: string | null;
  feePerTvl24h: string; // fee earned / TVL over a rolling 24h window
}

export interface PositionPnLResponse {
  positions: PositionPnL[];
}

// Lifetime claimed fees + LM rewards for the active wallet in this pool.
// Sourced from Meteora data API `/wallets/{w}/pools/{p}/total_claims`.
export interface WalletTotalClaimsResponse {
  totalClaimsUsd: string;
  totalClaimsSol: string;
  feeClaimCount: number;
  rewardClaimCount: number;
  lastFeeClaimTime?: string | null;
  lastRewardClaimTime?: string | null;
}

// Active wallet's available (uninvested) balances, raw base units as strings.
export interface WalletBalanceResponse {
  sol: string; // lamports
  usdc: string; // micro-USDC
}

// raw amount string -> human number using token decimals
export function toUi(raw: string | number, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}
