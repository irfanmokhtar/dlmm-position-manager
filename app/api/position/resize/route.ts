import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { z } from "zod";
import { ResizeSide } from "@meteora-ag/dlmm";
import { getDlmm } from "@/lib/dlmm";
import { getWallet } from "@/lib/solana";
import { previewTransactions, sendTransactions } from "@/lib/tx";
import { MAX_POSITION_BINS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const Body = z.object({
  positionPubKey: z.string(),
  action: z.enum(["increase", "decrease"]),
  side: z.enum(["Lower", "Upper"]),
  length: z.number().int().min(1), // number of bins to add/remove on that side
  wallet: z.string().optional(),
  dryRun: z.boolean().default(true),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const dlmm = await getDlmm();
    const wallet = getWallet(body.wallet);
    const owner = wallet.publicKey;
    const position = new PublicKey(body.positionPubKey);
    const side = body.side === "Lower" ? ResizeSide.Lower : ResizeSide.Upper;
    const length = new BN(body.length);

    // guard: extended positions cap at 1400 bins
    if (body.action === "increase") {
      const p = await dlmm.getPosition(position);
      const current =
        p.positionData.upperBinId - p.positionData.lowerBinId + 1;
      if (current + body.length > MAX_POSITION_BINS) {
        return NextResponse.json(
          { error: `Position would exceed ${MAX_POSITION_BINS}-bin cap (current ${current})` },
          { status: 400 },
        );
      }
    }

    const txs =
      body.action === "increase"
        ? await dlmm.increasePositionLength(position, side, length, owner)
        : await dlmm.decreasePositionLength(position, side, length);

    if (body.dryRun) {
      const preview = await previewTransactions(txs, wallet);
      return NextResponse.json({
        dryRun: true,
        preview,
        note:
          body.action === "decrease"
            ? "Rent from a decrease is reclaimed only on full closePosition, not on shrink."
            : undefined,
      });
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
