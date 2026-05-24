// Liquidity distribution builders. Server-side (imports the SDK).
//
// Two paths:
//  - preset: map to StrategyType.{Spot,Curve,BidAsk} for addLiquidityByStrategy.
//  - custom blend: weighted sum of the per-bin bps from calculate{Spot,Normal,BidAsk}
//    Distribution, renormalized to 10000 bps per side, for addLiquidityByWeight.
import {
  calculateSpotDistribution,
  calculateBidAskDistribution,
  calculateNormalDistribution,
  StrategyType,
  type BinAndAmount,
} from "@meteora-ag/dlmm";
import BN from "bn.js";

if (typeof window !== "undefined") {
  throw new Error("lib/strategies.ts must never be imported on the client");
}

export const BPS_TOTAL = 10000;

export type PresetKind = "Spot" | "Curve" | "BidAsk";

export const STRATEGY_TYPE: Record<PresetKind, StrategyType> = {
  Spot: StrategyType.Spot,
  Curve: StrategyType.Curve, // SDK "Curve" == normal/bell distribution
  BidAsk: StrategyType.BidAsk,
};

// Mix of the three base shapes; values are relative weights (need not sum to 1).
export interface BlendWeights {
  spot?: number;
  curve?: number;
  bidask?: number;
}

function range(min: number, max: number): number[] {
  const out: number[] = [];
  for (let b = min; b <= max; b++) out.push(b);
  return out;
}

// Largest-remainder rounding so the integer bps sum to exactly BPS_TOTAL.
function normalizeToBps(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return values.map(() => 0);
  const scaled = values.map((v) => (v / total) * BPS_TOTAL);
  const floored = scaled.map((v) => Math.floor(v));
  let remainder = BPS_TOTAL - floored.reduce((a, b) => a + b, 0);
  const byFrac = scaled
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; remainder > 0 && byFrac.length > 0; k++, remainder--) {
    floored[byFrac[k % byFrac.length].i]++;
  }
  return floored;
}

/**
 * Build a custom per-bin distribution by blending Spot / Curve / BidAsk shapes.
 * Returns BinAndAmount[] (bps of total per side) ready for addLiquidityByWeight.
 */
export function buildBlendedDistribution(
  activeBin: number,
  minBinId: number,
  maxBinId: number,
  weights: BlendWeights,
): BinAndAmount[] {
  const binIds = range(minBinId, maxBinId);
  const w = {
    spot: Math.max(0, weights.spot ?? 0),
    curve: Math.max(0, weights.curve ?? 0),
    bidask: Math.max(0, weights.bidask ?? 0),
  };
  if (w.spot + w.curve + w.bidask === 0) {
    throw new Error("blend weights must not all be zero");
  }

  const shapes: { weight: number; dist: BinAndAmount[] }[] = [];
  if (w.spot > 0)
    shapes.push({ weight: w.spot, dist: calculateSpotDistribution(activeBin, binIds) });
  if (w.curve > 0)
    shapes.push({ weight: w.curve, dist: calculateNormalDistribution(activeBin, binIds) });
  if (w.bidask > 0)
    shapes.push({ weight: w.bidask, dist: calculateBidAskDistribution(activeBin, binIds) });

  // accumulate weighted bps per bin per side
  const xAcc = new Array(binIds.length).fill(0);
  const yAcc = new Array(binIds.length).fill(0);
  for (const { weight, dist } of shapes) {
    const byId = new Map(dist.map((d) => [d.binId, d]));
    binIds.forEach((binId, idx) => {
      const d = byId.get(binId);
      if (!d) return;
      xAcc[idx] += weight * d.xAmountBpsOfTotal.toNumber();
      yAcc[idx] += weight * d.yAmountBpsOfTotal.toNumber();
    });
  }

  const xBps = normalizeToBps(xAcc);
  const yBps = normalizeToBps(yAcc);

  return binIds.map((binId, idx) => ({
    binId,
    xAmountBpsOfTotal: new BN(xBps[idx]),
    yAmountBpsOfTotal: new BN(yBps[idx]),
  }));
}

export function presetStrategy(
  kind: PresetKind,
  minBinId: number,
  maxBinId: number,
) {
  return { minBinId, maxBinId, strategyType: STRATEGY_TYPE[kind] };
}
