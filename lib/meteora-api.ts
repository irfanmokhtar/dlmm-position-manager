// Typed client for Meteora's DLMM data API (read-only analytics + PnL).
// Docs: https://dlmm.datapi.meteora.ag/api-docs/openapi.json
import { DATAPI_BASE } from "./constants";

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(path, DATAPI_BASE);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    // Data API tolerates short caching; revalidate frequently.
    next: { revalidate: 15 },
  });
  if (!res.ok) {
    throw new Error(`datapi ${path} -> ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export interface DataApiPool {
  address: string;
  name?: string;
  current_price?: number;
  liquidity?: number; // TVL (USD)
  bin_step?: number;
  base_fee_percentage?: string | number;
  [k: string]: unknown;
}

// `/positions/{pool}/pnl` → GetPoolPositionPnLResponse (subset we consume).
// Verified against https://dlmm.datapi.meteora.ag/api-docs/openapi.json
export interface PositionPnLData {
  positionAddress: string;
  createdAt: number; // int64 unix seconds
  isClosed: boolean;
  closedAt?: number | null;
  pnlUsd: string;
  pnlSol?: number | null;
  pnlPctChange: string;
  pnlSolPctChange?: number | null;
  feePerTvl24h: string; // user's fee per tvl in rolling 24h
  lowerBinId: number;
  upperBinId: number;
  [k: string]: unknown;
}

export interface GetPoolPositionPnLResponse {
  positions: PositionPnLData[];
  [k: string]: unknown;
}

// `/wallets/{wallet}/pools/{pool_address}/total_claims` → GetWalletTotalClaimsResponse.
// Lifetime claimed fees + LM rewards for a wallet in one pool. All numeric fields
// are JSON strings to preserve precision.
export interface WalletTotalClaims {
  pool_address: string;
  user_address: string;
  total_fee_x: string;
  total_fee_y: string;
  total_fee_x_usd: string;
  total_fee_y_usd: string;
  total_fee_x_sol: string;
  total_fee_y_sol: string;
  fee_claim_count: number;
  last_fee_claim_time?: string | null;
  total_reward_x: string;
  total_reward_y: string;
  total_reward_x_usd: string;
  total_reward_y_usd: string;
  total_reward_x_sol: string;
  total_reward_y_sol: string;
  reward_claim_count: number;
  last_reward_claim_time?: string | null;
  total_claims_usd: string;
  total_claims_sol: string;
}

export const meteoraApi = {
  pool: (address: string) => get<DataApiPool>(`/pools/${address}`),

  ohlcv: (address: string, timeframe = "1h") =>
    get<unknown>(`/pools/${address}/ohlcv`, { timeframe }),

  positionPnl: (
    poolAddress: string,
    user: string,
    opts?: { status?: "open" | "closed" | "all"; page?: number; page_size?: number },
  ) =>
    get<GetPoolPositionPnLResponse>(`/positions/${poolAddress}/pnl`, {
      user,
      status: opts?.status ?? "all",
      page: opts?.page ?? 1,
      page_size: opts?.page_size ?? 100,
    }),

  totalClaims: (wallet: string, poolAddress: string) =>
    get<WalletTotalClaims>(`/wallets/${wallet}/pools/${poolAddress}/total_claims`),

  portfolioOpen: (wallet: string) =>
    get<unknown>(`/portfolio/open`, { wallet }),

  portfolioTotal: (wallet: string) =>
    get<unknown>(`/portfolio/total`, { wallet }),
};
