import { NextResponse } from "next/server";
import { meteoraApi, type PositionPnLData } from "@/lib/meteora-api";
import { env } from "@/lib/env";
import type { PositionPnL, PositionPnLResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

// Per-position analytics (APR proxy + age) sourced from the Meteora data API.
// The on-chain SDK has no PnL/age, so this is a separate read path — see
// lib/meteora-api.ts. Response is plain JSON strings (no BN/PublicKey), so no
// serialize() is needed.
export async function GET() {
  try {
    const raw = await meteoraApi.positionPnl(env.POOL_ADDRESS);
    // The endpoint returns { positions: [...] }; tolerate a bare array too.
    const list: PositionPnLData[] = Array.isArray(raw)
      ? (raw as PositionPnLData[])
      : (raw?.positions ?? []);

    const positions: PositionPnL[] = list.map((p) => ({
      positionAddress: p.positionAddress,
      createdAt: Number(p.createdAt),
      isClosed: Boolean(p.isClosed),
      pnlUsd: String(p.pnlUsd ?? "0"),
      pnlPctChange: String(p.pnlPctChange ?? "0"),
      feePerTvl24h: String(p.feePerTvl24h ?? "0"),
    }));

    return NextResponse.json({ positions } satisfies PositionPnLResponse);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
