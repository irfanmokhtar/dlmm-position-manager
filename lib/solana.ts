// Server-only Solana connection + wallet keypair loader.
// The keypair lives only here and in route handlers — it must never reach the client.
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { env } from "./env";

if (typeof window !== "undefined") {
  throw new Error("lib/solana.ts must never be imported on the client");
}

let _connection: Connection | null = null;
export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(env.RPC_URL, "confirmed");
  }
  return _connection;
}

function decodeSecret(secret: string): Keypair {
  let bytes: Uint8Array;
  if (secret.startsWith("[")) {
    // JSON byte array (id.json format)
    bytes = Uint8Array.from(JSON.parse(secret) as number[]);
  } else {
    // base58 (Phantom export)
    bytes = bs58.decode(secret);
  }
  return Keypair.fromSecretKey(bytes);
}

function shortLabel(pubkey: string): string {
  return `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`;
}

// Wallet registry, keyed by base58 public key, built lazily from env.WALLETS.
// Insertion order is preserved; the first entry is the default wallet.
interface WalletEntry {
  keypair: Keypair;
  label: string;
}
let _wallets: Map<string, WalletEntry> | null = null;
let _order: string[] = [];

function registry(): Map<string, WalletEntry> {
  if (_wallets) return _wallets;
  const map = new Map<string, WalletEntry>();
  const order: string[] = [];
  for (const cfg of env.WALLETS) {
    const keypair = decodeSecret(cfg.secret);
    const pubkey = keypair.publicKey.toBase58();
    if (map.has(pubkey)) continue; // dedupe repeated secrets
    map.set(pubkey, { keypair, label: cfg.label || shortLabel(pubkey) });
    order.push(pubkey);
  }
  _wallets = map;
  _order = order;
  return map;
}

export function getDefaultWalletPubkey(): string {
  registry();
  return _order[0];
}

// Resolve a wallet by base58 pubkey; no argument returns the default (first).
export function getWallet(pubkey?: string): Keypair {
  const map = registry();
  const key = pubkey ?? _order[0];
  const entry = map.get(key);
  if (!entry) throw new Error(`Unknown wallet: ${key}`);
  return entry.keypair;
}

export function getWalletPublicKey(pubkey?: string): PublicKey {
  return getWallet(pubkey).publicKey;
}

// Public listing for the UI dropdown — pubkey + label only, never secrets.
export function listWallets(): { pubkey: string; label: string }[] {
  const map = registry();
  return _order.map((pubkey) => ({ pubkey, label: map.get(pubkey)!.label }));
}
