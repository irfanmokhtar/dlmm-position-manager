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
  pnlPctChange: string;
  feePerTvl24h: string; // user's fee per tvl in rolling 24h
  lowerBinId: number;
  upperBinId: number;
  [k: string]: unknown;
}

export interface GetPoolPositionPnLResponse {
  positions: PositionPnLData[];
  [k: string]: unknown;
}

export const meteoraApi = {
  pool: (address: string) => get<DataApiPool>(`/pools/${address}`),

  ohlcv: (address: string, timeframe = "1h") =>
    get<unknown>(`/pools/${address}/ohlcv`, { timeframe }),

  positionPnl: (poolAddress: string) =>
    get<GetPoolPositionPnLResponse>(`/positions/${poolAddress}/pnl`),

  portfolioOpen: (wallet: string) =>
    get<unknown>(`/portfolio/open`, { wallet }),

  portfolioTotal: (wallet: string) =>
    get<unknown>(`/portfolio/total`, { wallet }),
};
