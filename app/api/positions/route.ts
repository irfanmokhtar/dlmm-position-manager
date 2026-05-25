import { NextResponse } from "next/server";
import { getDlmm } from "@/lib/dlmm";
import { getWalletPublicKey } from "@/lib/solana";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const dlmm = await getDlmm();
    const wallet = new URL(req.url).searchParams.get("wallet") ?? undefined;
    const owner = getWalletPublicKey(wallet);
    const { activeBin, userPositions } =
      await dlmm.getPositionsByUserAndLbPair(owner);

    return NextResponse.json({
      owner: owner.toBase58(),
      activeBinId: activeBin.binId,
      positions: serialize(
        userPositions.map((p) => ({
          publicKey: p.publicKey,
          lowerBinId: p.positionData.lowerBinId,
          upperBinId: p.positionData.upperBinId,
          totalXAmount: p.positionData.totalXAmount,
          totalYAmount: p.positionData.totalYAmount,
          feeX: p.positionData.feeX,
          feeY: p.positionData.feeY,
          rewardOne: p.positionData.rewardOne,
          rewardTwo: p.positionData.rewardTwo,
          binData: p.positionData.positionBinData,
        })),
      ),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
