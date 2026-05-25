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

// One configured wallet: a secret (base58 or JSON byte array) and an optional
// human label for the UI dropdown.
export interface WalletConfig {
  secret: string;
  label?: string;
}

function parseWallets(): WalletConfig[] {
  const raw = process.env.WALLETS?.trim();
  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('WALLETS must be valid JSON: an array of { secret, label? }');
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("WALLETS must be a non-empty JSON array of { secret, label? }");
    }
    return parsed.map((w, i) => {
      const entry = w as Partial<WalletConfig>;
      if (!entry || typeof entry.secret !== "string" || entry.secret.trim() === "") {
        throw new Error(`WALLETS[${i}] must have a non-empty "secret" string`);
      }
      return {
        secret: entry.secret.trim(),
        label: typeof entry.label === "string" ? entry.label.trim() : undefined,
      };
    });
  }
  // Migration fallback: legacy single WALLET_SECRET still works as one wallet.
  const legacy = process.env.WALLET_SECRET?.trim();
  if (legacy) return [{ secret: legacy }];
  throw new Error(
    "Missing wallet config: set WALLETS (JSON array) or WALLET_SECRET in .env.local",
  );
}

export const env = {
  get RPC_URL() {
    return required("RPC_URL");
  },
  get WALLETS(): WalletConfig[] {
    return parseWallets();
  },
  get POOL_ADDRESS() {
    return process.env.POOL_ADDRESS?.trim() || DEFAULT_POOL_ADDRESS;
  },
};
