// Jupiter swap API client (server-side). Quote + build swap tx.
// Default endpoint can be overridden with JUPITER_API (e.g. a paid host).
const JUPITER_API = process.env.JUPITER_API || "https://quote-api.jup.ag/v6";

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  routePlan: unknown[];
  [k: string]: unknown;
}

export async function getQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: string; // raw integer (lamports/atoms)
  slippageBps: number;
}): Promise<JupiterQuote> {
  const url = new URL(`${JUPITER_API}/quote`);
  url.searchParams.set("inputMint", params.inputMint);
  url.searchParams.set("outputMint", params.outputMint);
  url.searchParams.set("amount", params.amount);
  url.searchParams.set("slippageBps", String(params.slippageBps));
  url.searchParams.set("swapMode", "ExactIn");
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`jupiter quote ${res.status}: ${await res.text()}`);
  return (await res.json()) as JupiterQuote;
}

// Returns the base64-encoded VersionedTransaction to sign + send.
export async function getSwapTransaction(
  quoteResponse: JupiterQuote,
  userPublicKey: string,
): Promise<string> {
  const res = await fetch(`${JUPITER_API}/swap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });
  if (!res.ok) throw new Error(`jupiter swap ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { swapTransaction: string };
  return json.swapTransaction;
}
