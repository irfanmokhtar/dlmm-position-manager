import { NextResponse, type NextRequest } from "next/server";
import { meteoraApi } from "@/lib/meteora-api";
import { env } from "@/lib/env";
import { getWalletPublicKey } from "@/lib/solana";
import type { WalletTotalClaimsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

// Lifetime claimed fees + LM rewards for the active wallet in env.POOL_ADDRESS.
// Read-only passthrough to the Meteora data API. Response is plain strings, so
// no serialize() is needed.
export async function GET(req: NextRequest) {
  try {
    const walletParam = new URL(req.url).searchParams.get("wallet") ?? undefined;
    const user = getWalletPublicKey(walletParam).toBase58();
    const r = await meteoraApi.totalClaims(user, env.POOL_ADDRESS);

    const body: WalletTotalClaimsResponse = {
      totalClaimsUsd: r.total_claims_usd,
      totalClaimsSol: r.total_claims_sol,
      feeClaimCount: r.fee_claim_count,
      rewardClaimCount: r.reward_claim_count,
      lastFeeClaimTime: r.last_fee_claim_time ?? null,
      lastRewardClaimTime: r.last_reward_claim_time ?? null,
    };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
