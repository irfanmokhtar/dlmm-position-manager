import { NextResponse } from "next/server";
import { VersionedTransaction } from "@solana/web3.js";
import { z } from "zod";
import { getSwapTransaction, type JupiterQuote } from "@/lib/jupiter";
import { getConnection, getWallet } from "@/lib/solana";

export const dynamic = "force-dynamic";

const Body = z.object({
  quoteResponse: z.record(z.string(), z.unknown()),
  wallet: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const wallet = getWallet(body.wallet);
    const connection = getConnection();

    const swapB64 = await getSwapTransaction(
      body.quoteResponse as unknown as JupiterQuote,
      wallet.publicKey.toBase58(),
    );

    const tx = VersionedTransaction.deserialize(
      Buffer.from(swapB64, "base64"),
    );
    tx.sign([wallet]);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const conf = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );

    return NextResponse.json({
      ok: !conf.value.err,
      signature,
      error: conf.value.err ? JSON.stringify(conf.value.err) : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
