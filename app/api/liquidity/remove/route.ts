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

    console.log("[remove] params", {
      position: body.positionPubKey,
      fromBinId: body.fromBinId,
      toBinId: body.toBinId,
      bps: body.bps,
      bpsPct: `${(body.bps / 100).toFixed(2)}%`,
      shouldClaimAndClose: body.shouldClaimAndClose,
      wallet: user.toBase58(),
      dryRun: body.dryRun,
    });

    const txs = await dlmm.removeLiquidity({
      user,
      position: new PublicKey(body.positionPubKey),
      fromBinId: body.fromBinId,
      toBinId: body.toBinId,
      bps: new BN(body.bps),
      shouldClaimAndClose: body.shouldClaimAndClose,
    });

    const txArray = Array.isArray(txs) ? txs : [txs];
    console.log("[remove] SDK returned", txArray.length, "tx(s)");

    if (body.dryRun) {
      const preview = await previewTransactions(txs, wallet);
      console.log("[remove] preview", { ok: preview.ok, txCount: preview.txCount, error: preview.error });
      if (preview.logs) console.log("[remove] sim logs\n" + preview.logs.join("\n"));
      return NextResponse.json({ dryRun: true, preview });
    }

    const results = await sendTransactions(txs, wallet);
    const ok = results.every((r) => r.ok) && results.length > 0;
    for (const r of results) {
      console.log(`[remove] tx#${r.index}`, { ok: r.ok, signature: r.signature, error: r.error });
      if (r.logs) console.log(`[remove] tx#${r.index} logs\n` + r.logs.join("\n"));
    }
    return NextResponse.json({ dryRun: false, ok, results });
  } catch (e) {
    console.error("[remove] error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
