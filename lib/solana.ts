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

let _wallet: Keypair | null = null;
export function getWallet(): Keypair {
  if (_wallet) return _wallet;
  const secret = env.WALLET_SECRET;
  let bytes: Uint8Array;
  if (secret.startsWith("[")) {
    // JSON byte array (id.json format)
    bytes = Uint8Array.from(JSON.parse(secret) as number[]);
  } else {
    // base58 (Phantom export)
    bytes = bs58.decode(secret);
  }
  _wallet = Keypair.fromSecretKey(bytes);
  return _wallet;
}

export function getWalletPublicKey(): PublicKey {
  return getWallet().publicKey;
}
