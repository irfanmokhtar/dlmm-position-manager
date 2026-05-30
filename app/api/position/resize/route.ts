import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { z } from "zod";
import { ResizeSide, isPositionNoFee, isPositionNoReward } from "@meteora-ag/dlmm";
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

    // Fetch position once — used for the cap guard and the doomed-bin scan below.
    const p = await dlmm.getPosition(position);
    const { lowerBinId, upperBinId, positionBinData } = p.positionData;
    const currentWidth = upperBinId - lowerBinId + 1;

    // guard: extended positions cap at 1400 bins (only widening adds bins)
    const added =
      (body.lower?.action === "increase" ? body.lower.length : 0) +
      (body.upper?.action === "increase" ? body.upper.length : 0);
    if (added > 0 && currentWidth + added > MAX_POSITION_BINS) {
      return NextResponse.json(
        { error: `Position would exceed ${MAX_POSITION_BINS}-bin cap (current ${currentWidth})` },
        { status: 400 },
      );
    }

    // Bins about to be dropped by a shrink: Lower trims from the bottom, Upper
    // from the top. Clamp each side to leave ≥1 bin (mirrors the SDK).
    type DoomRange = { fromBinId: number; toBinId: number };
    const doomed: DoomRange[] = [];
    if (body.lower?.action === "decrease") {
      const n = Math.min(body.lower.length, currentWidth - 1);
      if (n > 0) doomed.push({ fromBinId: lowerBinId, toBinId: lowerBinId + n - 1 });
    }
    if (body.upper?.action === "decrease") {
      const n = Math.min(body.upper.length, currentWidth - 1);
      if (n > 0) doomed.push({ fromBinId: upperBinId - n + 1, toBinId: upperBinId });
    }

    // Inspect the doomed bins: any liquidity must be withdrawn before shrinking
    // (else the on-chain decrease fails with BinRangeIsNotEmpty), and any pending
    // fees/rewards must be claimed first (the decrease ix has no vault accounts,
    // so anything left in a dropped bin is lost forever).
    const nz = (s: string) => s !== "" && s !== "0";
    let needClaim = false;
    const rangesWithLiquidity: DoomRange[] = [];
    for (const r of doomed) {
      const bins = positionBinData.filter((b) => b.binId >= r.fromBinId && b.binId <= r.toBinId);
      const hasLiquidity = bins.some(
        (b) => nz(b.positionXAmount) || nz(b.positionYAmount) || nz(b.positionLiquidity),
      );
      const hasPending = bins.some(
        (b) =>
          nz(b.positionFeeXAmount) ||
          nz(b.positionFeeYAmount) ||
          (b.positionRewardAmount ?? []).some(nz),
      );
      if (hasLiquidity) rangesWithLiquidity.push(r);
      if (hasLiquidity || hasPending) needClaim = true;
    }

    // Order is load-bearing: claim (while the doomed bins still hold liquidity, so
    // the SDK's whole-position claim covers them) → withdraw liquidity → decrease
    // → increase.
    const claimTxs =
      needClaim && !(isPositionNoFee(p.positionData) && isPositionNoReward(p.positionData))
        ? await dlmm.claimAllRewardsByPosition({ owner, position: p })
        : [];

    const removeTxs = (
      await Promise.all(
        rangesWithLiquidity.map((r) =>
          dlmm.removeLiquidity({
            user: owner,
            position,
            fromBinId: r.fromBinId,
            toBinId: r.toBinId,
            bps: new BN(10000), // 100% — segment must be empty before decrease
            shouldClaimAndClose: false, // shrink only, never close the position
          }),
        ),
      )
    ).flat();

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
    const resizeTxs = (await Promise.all([...decreases, ...increases])).flat();

    const txs = [...claimTxs, ...removeTxs, ...resizeTxs];

    const anyDecrease = body.lower?.action === "decrease" || body.upper?.action === "decrease";
    const autoEmpty = {
      claimed: claimTxs.length > 0,
      withdrawnRanges: rangesWithLiquidity,
    };
    const emptied = autoEmpty.claimed || rangesWithLiquidity.length > 0;

    if (body.dryRun) {
      const preview = await previewTransactions(txs, wallet);
      return NextResponse.json({
        dryRun: true,
        preview,
        autoEmpty,
        note: anyDecrease
          ? emptied
            ? "Fees/rewards on the removed bins were claimed and their liquidity withdrawn before shrinking. Rent from a decrease is reclaimed only on full closePosition, not on shrink."
            : "Rent from a decrease is reclaimed only on full closePosition, not on shrink."
          : undefined,
      });
    }

    const results = await sendTransactions(txs, wallet);
    const ok = results.every((r) => r.ok) && results.length > 0;
    return NextResponse.json({ dryRun: false, ok, results, autoEmpty });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
