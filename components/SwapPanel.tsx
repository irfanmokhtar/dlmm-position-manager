"use client";

import { useState } from "react";
import { postJson } from "@/lib/client";
import { useWallet } from "@/lib/wallet-context";
import { TOKENS } from "@/lib/constants";
import { I, Field, sx } from "@/components/strata/ui";

interface QuoteResp {
  quote: Record<string, unknown>;
  uiOutAmount: number;
  priceImpactPct: string;
}

export function SwapPanel({ onDone }: { onDone: () => void }) {
  const { selected } = useWallet();
  const [dir, setDir] = useState<"SOLtoUSDC" | "USDCtoSOL">("SOLtoUSDC");
  const [amount, setAmount] = useState("0.1");
  const [slippageBps, setSlippageBps] = useState(50);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<QuoteResp | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [inTok, outTok] = dir === "SOLtoUSDC" ? [TOKENS.SOL, TOKENS.USDC] : [TOKENS.USDC, TOKENS.SOL];

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
    if (!confirm(`Swap ${amount} ${inTok.symbol} → ~${quote.uiOutAmount.toFixed(4)} ${outTok.symbol}?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await postJson<{ ok: boolean; signature?: string; error?: string }>("/api/swap/execute", {
        quoteResponse: quote.quote,
        wallet: selected || undefined,
      });
      setMsg(r.ok && r.signature ? `Sent: ${r.signature}` : `Failed: ${r.error ?? "unknown"}`);
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div className={sx.label} style={{ marginBottom: 6 }}>Direction</div>
          <select
            className={sx.inputText}
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
        <Field label="Slippage bps" value={slippageBps} type="number" onChange={(v) => setSlippageBps(Number(v))} />
      </div>

      <Field
        label={`Amount (${inTok.symbol})`}
        value={amount}
        suffix={inTok.symbol}
        onChange={(v) => {
          setAmount(v);
          setQuote(null);
        }}
      />

      {quote && (
        <div style={{ fontSize: "var(--text-sm)" }}>
          ≈ <span style={{ fontWeight: 600 }}>{quote.uiOutAmount.toFixed(6)} {outTok.symbol}</span>
          <span style={{ marginLeft: 8, fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
            impact {(Number(quote.priceImpactPct) * 100).toFixed(3)}%
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={busy} onClick={getQuote}>
          {busy ? "…" : "Get quote"}
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy || !quote} onClick={swap}>
          {I.swap} Swap
        </button>
      </div>

      {msg && <p className="mono" style={{ wordBreak: "break-all", fontSize: "var(--text-xs)", color: "var(--text-3)" }}>{msg}</p>}
    </div>
  );
}
