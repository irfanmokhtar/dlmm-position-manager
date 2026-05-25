import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { z } from "zod";
import { getDlmm } from "@/lib/dlmm";
import { getWallet } from "@/lib/solana";
import { previewTransactions, sendTransactions } from "@/lib/tx";

export const dynamic = "force-dynamic";

const Body = z.object({
  positionPubKey: z.string(),
  fromBinId: z.number().int(),
  toBinId: z.number().int(),
  bps: z.number().int().min(1).max(10000), // 10000 = 100% of liquidity in range
  shouldClaimAndClose: z.boolean().default(false),
  wallet: z.string().optional(),
  dryRun: z.boolean().default(true),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    if (body.fromBinId > body.toBinId) {
      return NextResponse.json({ error: "fromBinId > toBinId" }, { status: 400 });
    }

    const dlmm = await getDlmm();
    const wallet = getWallet(body.wallet);
    const user = wallet.publicKey;

    const txs = await dlmm.removeLiquidity({
      user,
      position: new PublicKey(body.positionPubKey),
      fromBinId: body.fromBinId,
      toBinId: body.toBinId,
      bps: new BN(body.bps),
      shouldClaimAndClose: body.shouldClaimAndClose,
    });

    if (body.dryRun) {
      const preview = await previewTransactions(txs, wallet);
      return NextResponse.json({ dryRun: true, preview });
    }

    const results = await sendTransactions(txs, wallet);
    const ok = results.every((r) => r.ok) && results.length > 0;
    return NextResponse.json({ dryRun: false, ok, results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
