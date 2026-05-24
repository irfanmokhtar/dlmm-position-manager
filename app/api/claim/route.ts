import { NextResponse } from "next/server";
import { z } from "zod";
import { getDlmm } from "@/lib/dlmm";
import { getWalletPublicKey } from "@/lib/solana";
import { previewTransactions, sendTransactions } from "@/lib/tx";

export const dynamic = "force-dynamic";

const Body = z.object({
  type: z.enum(["fees", "all"]).default("fees"), // fees only, or fees + LM rewards
  dryRun: z.boolean().default(true),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const dlmm = await getDlmm();
    const owner = getWalletPublicKey();
    const { userPositions } = await dlmm.getPositionsByUserAndLbPair(owner);

    if (userPositions.length === 0) {
      return NextResponse.json({ dryRun: body.dryRun, ok: true, note: "No positions." });
    }

    const txs =
      body.type === "all"
        ? await dlmm.claimAllRewards({ owner, positions: userPositions })
        : await dlmm.claimAllSwapFee({ owner, positions: userPositions });

    if (txs.length === 0) {
      return NextResponse.json({ dryRun: body.dryRun, ok: true, note: "Nothing to claim." });
    }

    if (body.dryRun) {
      const preview = await previewTransactions(txs);
      return NextResponse.json({ dryRun: true, preview });
    }

    const results = await sendTransactions(txs);
    const ok = results.every((r) => r.ok) && results.length > 0;
    return NextResponse.json({ dryRun: false, ok, results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
