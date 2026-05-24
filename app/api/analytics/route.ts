import { NextResponse } from "next/server";
import { meteoraApi } from "@/lib/meteora-api";
import { getWalletPublicKey } from "@/lib/solana";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const wallet = getWalletPublicKey().toBase58();
    const [pnl, portfolioOpen, portfolioTotal] = await Promise.allSettled([
      meteoraApi.positionPnl(env.POOL_ADDRESS),
      meteoraApi.portfolioOpen(wallet),
      meteoraApi.portfolioTotal(wallet),
    ]);

    const unwrap = (r: PromiseSettledResult<unknown>) =>
      r.status === "fulfilled" ? r.value : { error: String(r.reason) };

    return NextResponse.json({
      wallet,
      pnl: unwrap(pnl),
      portfolioOpen: unwrap(portfolioOpen),
      portfolioTotal: unwrap(portfolioTotal),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
