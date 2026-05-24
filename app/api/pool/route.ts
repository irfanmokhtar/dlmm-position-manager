import { NextResponse } from "next/server";
import { getDlmm } from "@/lib/dlmm";
import { meteoraApi } from "@/lib/meteora-api";
import { serialize } from "@/lib/serialize";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const BINS_EACH_SIDE = 34; // ~ one bin array window for the chart

export async function GET() {
  try {
    const dlmm = await getDlmm();
    const [activeBin, feeInfo, around] = await Promise.all([
      dlmm.getActiveBin(),
      Promise.resolve(dlmm.getFeeInfo()),
      dlmm.getBinsAroundActiveBin(BINS_EACH_SIDE, BINS_EACH_SIDE),
    ]);

    let dynamicFee = "0";
    try {
      dynamicFee = dlmm.getDynamicFee().toString();
    } catch {
      // dynamic fee depends on oracle state; ignore if unavailable
    }

    // best-effort TVL/price from the data API
    let datapi: unknown = null;
    try {
      datapi = await meteoraApi.pool(env.POOL_ADDRESS);
    } catch {
      datapi = null;
    }

    return NextResponse.json({
      pool: {
        address: env.POOL_ADDRESS,
        binStep: dlmm.lbPair.binStep,
        tokenX: {
          mint: dlmm.lbPair.tokenXMint.toBase58(),
          decimals: dlmm.tokenX.mint.decimals,
        },
        tokenY: {
          mint: dlmm.lbPair.tokenYMint.toBase58(),
          decimals: dlmm.tokenY.mint.decimals,
        },
      },
      activeBin: {
        binId: activeBin.binId,
        price: activeBin.price,
        pricePerToken: activeBin.pricePerToken,
      },
      fees: {
        base: feeInfo.baseFeeRatePercentage.toString(),
        max: feeInfo.maxFeeRatePercentage.toString(),
        protocol: feeInfo.protocolFeePercentage.toString(),
        dynamic: dynamicFee,
      },
      bins: serialize(around.bins),
      datapi,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
