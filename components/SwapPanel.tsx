"use client";

import { useState } from "react";
import { postJson } from "@/lib/client";
import { TOKENS } from "@/lib/constants";

const input =
  "w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm";
const label = "text-xs uppercase tracking-wide text-neutral-500";

interface QuoteResp {
  quote: Record<string, unknown>;
  uiOutAmount: number;
  priceImpactPct: string;
}

export function SwapPanel({ onDone }: { onDone: () => void }) {
  const [dir, setDir] = useState<"SOLtoUSDC" | "USDCtoSOL">("SOLtoUSDC");
  const [amount, setAmount] = useState("0.1");
  const [slippageBps, setSlippageBps] = useState(50);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<QuoteResp | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [inTok, outTok] =
    dir === "SOLtoUSDC" ? [TOKENS.SOL, TOKENS.USDC] : [TOKENS.USDC, TOKENS.SOL];

  async function getQuote() {
    setBusy(true);
    setMsg(null);
    setQuote(null);
    try {
      const q = await postJson<QuoteResp>("/api/swap/quote", {
        inputMint: inTok.mint,
        outputMint: outTok.mint,
        amount,
        slippageBps,
      });
      setQuote(q);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function swap() {
    if (!quote) return;
    if (!confirm(`Swap ${amount} ${inTok.symbol} → ~${quote.uiOutAmount.toFixed(4)} ${outTok.symbol}?`))
      return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await postJson<{ ok: boolean; signature?: string; error?: string }>(
        "/api/swap/execute",
        { quoteResponse: quote.quote },
      );
      setMsg(
        r.ok && r.signature
          ? `Sent: ${r.signature}`
          : `Failed: ${r.error ?? "unknown"}`,
      );
      if (r.ok) {
        setQuote(null);
        onDone();
      }
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <h3 className="mb-3 text-sm font-semibold">Swap (Jupiter)</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className={label}>Direction</span>
          <select
            className={input}
            value={dir}
            onChange={(e) => {
              setDir(e.target.value as typeof dir);
              setQuote(null);
            }}
          >
            <option value="SOLtoUSDC">SOL → USDC</option>
            <option value="USDCtoSOL">USDC → SOL</option>
          </select>
        </div>
        <div>
          <span className={label}>Slippage bps</span>
          <input
            type="number"
            className={input}
            value={slippageBps}
            onChange={(e) => setSlippageBps(Number(e.target.value))}
          />
        </div>
        <div className="col-span-2">
          <span className={label}>Amount ({inTok.symbol})</span>
          <input
            className={input}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setQuote(null);
            }}
          />
        </div>
      </div>

      {quote && (
        <p className="mt-2 text-sm text-neutral-300">
          ≈ <span className="font-semibold">{quote.uiOutAmount.toFixed(6)} {outTok.symbol}</span>
          <span className="ml-2 text-xs text-neutral-500">
            impact {(Number(quote.priceImpactPct) * 100).toFixed(3)}%
          </span>
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          disabled={busy}
          onClick={getQuote}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-900 disabled:opacity-50"
        >
          {busy ? "…" : "Get quote"}
        </button>
        <button
          disabled={busy || !quote}
          onClick={swap}
          className="rounded-lg bg-orange-700 px-3 py-1.5 text-sm hover:bg-orange-600 disabled:opacity-40"
        >
          Swap
        </button>
      </div>

      {msg && (
        <p className="mt-2 break-all font-mono text-xs text-neutral-400">{msg}</p>
      )}
    </div>
  );
}
