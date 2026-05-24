// Server-only cached DLMM pool instance.
import DLMM from "@meteora-ag/dlmm";
import { PublicKey } from "@solana/web3.js";
import { getConnection } from "./solana";
import { env } from "./env";

if (typeof window !== "undefined") {
  throw new Error("lib/dlmm.ts must never be imported on the client");
}

let _dlmm: DLMM | null = null;

// Returns the cached pool instance, refreshing its on-chain state each call so
// reads (active bin, reserves, fees) reflect the latest slot.
export async function getDlmm(): Promise<DLMM> {
  if (!_dlmm) {
    _dlmm = await DLMM.create(getConnection(), new PublicKey(env.POOL_ADDRESS));
  } else {
    await _dlmm.refetchStates();
  }
  return _dlmm;
}
