import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getConnection, getWalletPublicKey } from "@/lib/solana";
import { TOKENS } from "@/lib/constants";
import type { WalletBalanceResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

// Active wallet's available (uninvested) balances: native SOL + USDC token account.
export async function GET(req: Request) {
  try {
    const wallet = new URL(req.url).searchParams.get("wallet") ?? undefined;
    const owner = getWalletPublicKey(wallet);
    const conn = getConnection();

    // Native SOL (this is what add/swap wraps), lamports.
    const sol = await conn.getBalance(owner);

    // USDC sits in the owner's associated token account; may not exist yet.
    let usdc = "0";
    try {
      const ata = getAssociatedTokenAddressSync(new PublicKey(TOKENS.USDC.mint), owner, true);
      const bal = await conn.getTokenAccountBalance(ata);
      usdc = bal.value.amount;
    } catch {
      // no USDC ATA → 0
    }

    const body: WalletBalanceResponse = { sol: String(sol), usdc };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
