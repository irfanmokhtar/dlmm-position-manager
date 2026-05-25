import { NextResponse } from "next/server";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { z } from "zod";
import {
  buildLiquidityStrategyParameters,
  chunkDepositWithRebalanceEndpoint,
  getLiquidityStrategyParameterBuilder,
} from "@meteora-ag/dlmm";
import { getDlmm } from "@/lib/dlmm";
import { getWallet } from "@/lib/solana";
import { previewTransactions, sendTransactions } from "@/lib/tx";
import { buildBlendedDistribution, presetStrategy, STRATEGY_TYPE } from "@/lib/strategies";
import { toRaw } from "@/lib/amount";
import { MAX_POSITION_BINS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const Body = z.object({
  positionPubKey: z.string().optional(), // omit -> create a new position
  minBinId: z.number().int(),
  maxBinId: z.number().int(),
  xAmount: z.string().default("0"), // human units (SOL)
  yAmount: z.string().default("0"), // human units (USDC)
  slippage: z.number().optional(),
  wallet: z.string().optional(),
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

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    if (body.minBinId > body.maxBinId) {
      return NextResponse.json({ error: "minBinId > maxBinId" }, { status: 400 });
    }
    const binCount = body.maxBinId - body.minBinId + 1;
    if (binCount > MAX_POSITION_BINS) {
      return NextResponse.json(
        { error: `Range ${binCount} bins exceeds the ${MAX_POSITION_BINS}-bin single-position cap.` },
        { status: 400 },
      );
    }
    const isExtended = binCount > 70;
    if (isExtended && body.strategy.type !== "preset") {
      return NextResponse.json(
        { error: "Custom blend is limited to 70 bins. Pick a preset (Spot/Curve/BidAsk) for wider ranges." },
        { status: 400 },
      );
    }

    const dlmm = await getDlmm();
    const wallet = getWallet(body.wallet);
    const user = wallet.publicKey;
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
    if (isExtended) {
      // > 70 bins: single extended position, Solscan-style flow.
      // createExtendedEmptyPosition (InitializePosition) + chunked
      // InitializeBinArray + RebalanceLiquidity deposits. Preset only (guarded above).
      const kind = (body.strategy as { kind: "Spot" | "Curve" | "BidAsk" }).kind;
      const favorXInActiveId = !totalXAmount.isZero();
      const lsp = buildLiquidityStrategyParameters(
        totalXAmount,
        totalYAmount,
        new BN(body.minBinId - activeBinId),
        new BN(body.maxBinId - activeBinId),
        new BN(dlmm.lbPair.binStep),
        favorXInActiveId,
        new BN(activeBinId),
        getLiquidityStrategyParameterBuilder(STRATEGY_TYPE[kind]),
      );
      const ixGroups = await chunkDepositWithRebalanceEndpoint(
        dlmm,
        presetStrategy(kind, body.minBinId, body.maxBinId),
        body.slippage ?? 1, // slippagePercentage
        5, // maxActiveBinSlippage (bins)
        positionPubKey,
        body.minBinId,
        body.maxBinId,
        lsp,
        user,
        user, // payer
        false, // isParallel — keep sequential for the chunked sender
      );
      const depositTxs = ixGroups.map((g) => new Transaction().add(...g));
      txs = isNew
        ? [
            await dlmm.createExtendedEmptyPosition(
              body.minBinId,
              body.maxBinId,
              positionPubKey,
              user,
            ),
            ...depositTxs,
          ]
        : depositTxs;
    } else if (body.strategy.type === "preset") {
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
      const preview = await previewTransactions(txs, wallet, extraSigners);
      return NextResponse.json({ dryRun: true, positionPubKey: positionPubKey.toBase58(), preview });
    }

    const results = await sendTransactions(txs, wallet, extraSigners);
    const ok = results.every((r) => r.ok) && results.length > 0;
    return NextResponse.json({ dryRun: false, ok, positionPubKey: positionPubKey.toBase58(), results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
