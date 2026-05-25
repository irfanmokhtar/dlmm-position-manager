import { NextResponse } from "next/server";
import { getDefaultWalletPubkey, listWallets } from "@/lib/solana";

export const dynamic = "force-dynamic";

// Feeds the wallet-selector dropdown. Returns pubkeys + labels only — secrets
// never leave the server.
export async function GET() {
  try {
    return NextResponse.json({
      wallets: listWallets(),
      default: getDefaultWalletPubkey(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
