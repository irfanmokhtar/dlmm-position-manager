// Server-side transaction processing: simulate, sign with the local keypair
// (only the signers each tx actually requires), and send sequentially.
import { Keypair, Transaction, TransactionInstruction } from "@solana/web3.js";
import { getConnection, getWallet } from "./solana";

if (typeof window !== "undefined") {
  throw new Error("lib/tx.ts must never be imported on the client");
}

export interface TxStepResult {
  index: number;
  ok: boolean;
  signature?: string;
  logs?: string[];
  unitsConsumed?: number;
  error?: string;
}

export interface PreviewResult {
  txCount: number;
  ok: boolean;
  logs?: string[];
  unitsConsumed?: number;
  error?: string;
}

function asArray(t: Transaction | Transaction[]): Transaction[] {
  return Array.isArray(t) ? t : [t];
}

/**
 * Pack ordered instruction groups into transactions, chunking each group by
 * `perTx`. Order is preserved across groups (e.g. bin-array init before
 * rebalance). Used for methods that return raw instructions (rebalancePosition).
 */
export function instructionsToTxs(
  groups: { ixs: TransactionInstruction[]; perTx: number }[],
): Transaction[] {
  const txs: Transaction[] = [];
  for (const g of groups) {
    for (let i = 0; i < g.ixs.length; i += g.perTx) {
      const tx = new Transaction();
      tx.add(...g.ixs.slice(i, i + g.perTx));
      txs.push(tx);
    }
  }
  return txs;
}

// A tx must be signed only by the signers it declares as required; partialSign
// with an unrelated keypair throws "unknown signer".
function signRequired(tx: Transaction, signers: Keypair[]) {
  const required = new Set(tx.signatures.map((s) => s.publicKey.toBase58()));
  const use = signers.filter((s) => required.has(s.publicKey.toBase58()));
  if (use.length) tx.partialSign(...use);
}

async function prepare(tx: Transaction, signers: Keypair[]) {
  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  if (!tx.feePayer) tx.feePayer = signers[0].publicKey;
  signRequired(tx, signers);
  return { blockhash, lastValidBlockHeight };
}

/**
 * Simulate only the first transaction (later chunks depend on earlier ones
 * landing on-chain, so simulating them pre-send would falsely fail).
 */
export async function previewTransactions(
  input: Transaction | Transaction[],
  extraSigners: Keypair[] = [],
): Promise<PreviewResult> {
  const connection = getConnection();
  const signers = [getWallet(), ...extraSigners];
  const txs = asArray(input);
  if (txs.length === 0) return { txCount: 0, ok: false, error: "no transactions" };

  try {
    await prepare(txs[0], signers);
    const sim = await connection.simulateTransaction(txs[0]);
    return {
      txCount: txs.length,
      ok: !sim.value.err,
      logs: sim.value.logs ?? undefined,
      unitsConsumed: sim.value.unitsConsumed ?? undefined,
      error: sim.value.err ? JSON.stringify(sim.value.err) : undefined,
    };
  } catch (e) {
    return {
      txCount: txs.length,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Sign + send all transactions in order, confirming each before the next.
 * Stops at the first failure and returns results collected so far.
 */
export async function sendTransactions(
  input: Transaction | Transaction[],
  extraSigners: Keypair[] = [],
): Promise<TxStepResult[]> {
  const connection = getConnection();
  const signers = [getWallet(), ...extraSigners];
  const txs = asArray(input);
  const results: TxStepResult[] = [];

  for (let i = 0; i < txs.length; i++) {
    try {
      const { blockhash, lastValidBlockHeight } = await prepare(txs[i], signers);
      const raw = txs[i].serialize();
      const signature = await connection.sendRawTransaction(raw, {
        skipPreflight: false,
        maxRetries: 3,
      });
      const conf = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      if (conf.value.err) {
        results.push({
          index: i,
          ok: false,
          signature,
          error: JSON.stringify(conf.value.err),
        });
        break;
      }
      results.push({ index: i, ok: true, signature });
    } catch (e) {
      results.push({
        index: i,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
      break;
    }
  }
  return results;
}
