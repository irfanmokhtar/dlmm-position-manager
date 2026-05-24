import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { z } from "zod";
import { StrategyType } from "@meteora-ag/dlmm";
import { getDlmm } from "@/lib/dlmm";
import { getWalletPublicKey } from "@/lib/solana";
import { instructionsToTxs, previewTransactions, sendTransactions } from "@/lib/tx";
import { toRaw } from "@/lib/amount";

export const dynamic = "force-dynamic";

const STRATEGY: Record<string, StrategyType> = {
  Spot: StrategyType.Spot,
  Curve: StrategyType.Curve,
  BidAsk: StrategyType.BidAsk,
};

const Body = z.object({
  positionPubKey: z.string(),
  strategy: z.enum(["Spot", "Curve", "BidAsk"]).default("Spot"),
  topUpX: z.string().default("0"), // extra SOL to deposit (human)
  topUpY: z.string().default("0"), // extra USDC to deposit (human)
  withdrawXBps: z.number().int().min(0).max(10000).default(10000),
  withdrawYBps: z.number().int().min(0).max(10000).default(10000),
  maxActiveBinSlippage: z.number().int().min(0).default(5),
  slippage: z.number().optional(),
  dryRun: z.boolean().default(true),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const dlmm = await getDlmm();
    const owner = getWalletPublicKey();
    const position = new PublicKey(body.positionPubKey);
    const dx = dlmm.tokenX.mint.decimals;
    const dy = dlmm.tokenY.mint.decimals;

    const { positionData } = await dlmm.getPosition(position);

    // local simulation: recenter on current price using the chosen shape
    const sim = await dlmm.simulateRebalancePositionWithBalancedStrategy(
      position,
      positionData,
      STRATEGY[body.strategy],
      toRaw(body.topUpX, dx),
      toRaw(body.topUpY, dy),
      new BN(body.withdrawXBps),
      new BN(body.withdrawYBps),
    );

    const { initBinArrayInstructions, rebalancePositionInstruction } =
      await dlmm.rebalancePosition(
        sim,
        new BN(body.maxActiveBinSlippage),
        owner,
        body.slippage,
      );

    const txs = instructionsToTxs([
      { ixs: initBinArrayInstructions, perTx: 8 },
      { ixs: rebalancePositionInstruction, perTx: 3 },
    ]);

    if (txs.length === 0) {
      return NextResponse.json({ dryRun: body.dryRun, ok: true, note: "Nothing to rebalance." });
    }

    const summary = {
      initBinArrayIxs: initBinArrayInstructions.length,
      rebalanceIxs: rebalancePositionInstruction.length,
      txCount: txs.length,
    };

    if (body.dryRun) {
      const preview = await previewTransactions(txs);
      return NextResponse.json({ dryRun: true, summary, preview });
    }

    const results = await sendTransactions(txs);
    const ok = results.every((r) => r.ok) && results.length > 0;
    return NextResponse.json({ dryRun: false, ok, summary, results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
