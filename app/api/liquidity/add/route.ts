import { NextResponse } from "next/server";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { z } from "zod";
import { getDlmm } from "@/lib/dlmm";
import { getWalletPublicKey } from "@/lib/solana";
import { previewTransactions, sendTransactions } from "@/lib/tx";
import { buildBlendedDistribution, presetStrategy } from "@/lib/strategies";

export const dynamic = "force-dynamic";

const Body = z.object({
  positionPubKey: z.string().optional(), // omit -> create a new position
  minBinId: z.number().int(),
  maxBinId: z.number().int(),
  xAmount: z.string().default("0"), // human units (SOL)
  yAmount: z.string().default("0"), // human units (USDC)
  slippage: z.number().optional(),
  dryRun: z.boolean().default(true),
  strategy: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("preset"),
      kind: z.enum(["Spot", "Curve", "BidAsk"]),
    }),
    z.object({
      type: z.literal("blend"),
      weights: z.object({
        spot: z.number().min(0).default(0),
        curve: z.number().min(0).default(0),
        bidask: z.number().min(0).default(0),
      }),
    }),
  ]),
});

// human decimal string -> raw integer BN
function toRaw(amount: string, decimals: number): BN {
  const [whole, frac = ""] = amount.trim().split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const digits = ((whole || "0") + fracPadded).replace(/^0+(?=\d)/, "");
  return new BN(digits || "0");
}

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    if (body.minBinId > body.maxBinId) {
      return NextResponse.json({ error: "minBinId > maxBinId" }, { status: 400 });
    }
    const binCount = body.maxBinId - body.minBinId + 1;
    if (binCount > 70) {
      return NextResponse.json(
        { error: "Range > 70 bins. Use resize/rebalance (extended positions) instead." },
        { status: 400 },
      );
    }

    const dlmm = await getDlmm();
    const user = getWalletPublicKey();
    const activeBinId = (await dlmm.getActiveBin()).binId;
    const dx = dlmm.tokenX.mint.decimals;
    const dy = dlmm.tokenY.mint.decimals;
    const totalXAmount = toRaw(body.xAmount, dx);
    const totalYAmount = toRaw(body.yAmount, dy);

    if (totalXAmount.isZero() && totalYAmount.isZero()) {
      return NextResponse.json({ error: "both amounts are zero" }, { status: 400 });
    }

    // new position needs a fresh keypair that co-signs the creation tx
    let positionKp: Keypair | null = null;
    let positionPubKey: PublicKey;
    if (body.positionPubKey) {
      positionPubKey = new PublicKey(body.positionPubKey);
    } else {
      positionKp = Keypair.generate();
      positionPubKey = positionKp.publicKey;
    }
    const isNew = positionKp !== null;

    let txs: Transaction | Transaction[];
    if (body.strategy.type === "preset") {
      const strategy = presetStrategy(body.strategy.kind, body.minBinId, body.maxBinId);
      txs = isNew
        ? await dlmm.initializePositionAndAddLiquidityByStrategy({
            positionPubKey,
            totalXAmount,
            totalYAmount,
            strategy,
            user,
            slippage: body.slippage,
          })
        : await dlmm.addLiquidityByStrategy({
            positionPubKey,
            totalXAmount,
            totalYAmount,
            strategy,
            user,
            slippage: body.slippage,
          });
    } else {
      const xYAmountDistribution = buildBlendedDistribution(
        activeBinId,
        body.minBinId,
        body.maxBinId,
        body.strategy.weights,
      );
      txs = isNew
        ? await dlmm.initializePositionAndAddLiquidityByWeight({
            positionPubKey,
            totalXAmount,
            totalYAmount,
            xYAmountDistribution,
            user,
            slippage: body.slippage,
          })
        : await dlmm.addLiquidityByWeight({
            positionPubKey,
            totalXAmount,
            totalYAmount,
            xYAmountDistribution,
            user,
            slippage: body.slippage,
          });
    }

    const extraSigners = positionKp ? [positionKp] : [];

    if (body.dryRun) {
      const preview = await previewTransactions(txs, extraSigners);
      return NextResponse.json({ dryRun: true, positionPubKey: positionPubKey.toBase58(), preview });
    }

    const results = await sendTransactions(txs, extraSigners);
    const ok = results.every((r) => r.ok) && results.length > 0;
    return NextResponse.json({ dryRun: false, ok, positionPubKey: positionPubKey.toBase58(), results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
