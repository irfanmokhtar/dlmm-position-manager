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

// raw amount string -> human number using token decimals
export function toUi(raw: string | number, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}
