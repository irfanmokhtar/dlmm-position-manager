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

const Side = z.object({
  action: z.enum(["increase", "decrease"]),
  length: z.number().int().min(1), // number of bins to add/remove on that side
});
const Body = z
  .object({
    positionPubKey: z.string(),
    lower: Side.optional(),
    upper: Side.optional(),
    wallet: z.string().optional(),
    dryRun: z.boolean().default(true),
  })
  .refine((b) => b.lower || b.upper, "at least one side (lower/upper) required");

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const dlmm = await getDlmm();
    const wallet = getWallet(body.wallet);
    const owner = wallet.publicKey;
    const position = new PublicKey(body.positionPubKey);

    // guard: extended positions cap at 1400 bins (only widening adds bins)
    const added =
      (body.lower?.action === "increase" ? body.lower.length : 0) +
      (body.upper?.action === "increase" ? body.upper.length : 0);
    if (added > 0) {
      const p = await dlmm.getPosition(position);
      const current = p.positionData.upperBinId - p.positionData.lowerBinId + 1;
      if (current + added > MAX_POSITION_BINS) {
        return NextResponse.json(
          { error: `Position would exceed ${MAX_POSITION_BINS}-bin cap (current ${current})` },
          { status: 400 },
        );
      }
    }

    // One SDK call per present side; concat the tx arrays. Decreases first
    // (the segment must be empty), then increases — within each, lower then upper.
    const buildSide = (s: ResizeSide, op: { action: "increase" | "decrease"; length: number }) =>
      op.action === "increase"
        ? dlmm.increasePositionLength(position, s, new BN(op.length), owner)
        : dlmm.decreasePositionLength(position, s, new BN(op.length));

    const decreases: Promise<Awaited<ReturnType<typeof buildSide>>>[] = [];
    const increases: Promise<Awaited<ReturnType<typeof buildSide>>>[] = [];
    if (body.lower) (body.lower.action === "decrease" ? decreases : increases).push(buildSide(ResizeSide.Lower, body.lower));
    if (body.upper) (body.upper.action === "decrease" ? decreases : increases).push(buildSide(ResizeSide.Upper, body.upper));
    const txs = (await Promise.all([...decreases, ...increases])).flat();

    const anyDecrease = body.lower?.action === "decrease" || body.upper?.action === "decrease";

    if (body.dryRun) {
      const preview = await previewTransactions(txs, wallet);
      return NextResponse.json({
        dryRun: true,
        preview,
        note: anyDecrease
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
