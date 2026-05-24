// Server-only environment access. Never import this from a "use client" module.
import { DEFAULT_POOL_ADDRESS } from "./constants";

if (typeof window !== "undefined") {
  throw new Error("lib/env.ts must never be imported on the client");
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required env var: ${name} (set it in .env.local)`);
  }
  return v.trim();
}

export const env = {
  get RPC_URL() {
    return required("RPC_URL");
  },
  get WALLET_SECRET() {
    return required("WALLET_SECRET");
  },
  get POOL_ADDRESS() {
    return process.env.POOL_ADDRESS?.trim() || DEFAULT_POOL_ADDRESS;
  },
};
