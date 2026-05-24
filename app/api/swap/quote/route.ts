import { NextResponse } from "next/server";
import { z } from "zod";
import { getQuote } from "@/lib/jupiter";
import { toRaw } from "@/lib/amount";
import { TOKENS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const DECIMALS: Record<string, number> = {
  [TOKENS.SOL.mint]: TOKENS.SOL.decimals,
  [TOKENS.USDC.mint]: TOKENS.USDC.decimals,
};

const Body = z.object({
  inputMint: z.string(),
  outputMint: z.string(),
  amount: z.string(), // human units of inputMint
  slippageBps: z.number().int().min(1).max(5000).default(50),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const inDec = DECIMALS[body.inputMint] ?? 9;
    const outDec = DECIMALS[body.outputMint] ?? 6;
    const raw = toRaw(body.amount, inDec).toString();
    if (raw === "0") {
      return NextResponse.json({ error: "amount is zero" }, { status: 400 });
    }

    const quote = await getQuote({
      inputMint: body.inputMint,
      outputMint: body.outputMint,
      amount: raw,
      slippageBps: body.slippageBps,
    });

    return NextResponse.json({
      quote,
      uiOutAmount: Number(quote.outAmount) / 10 ** outDec,
      priceImpactPct: quote.priceImpactPct,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
