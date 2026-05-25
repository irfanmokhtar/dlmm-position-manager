"use client";

import { useEffect, useState } from "react";
import { PositionInfo } from "@/lib/types";
import { ActionResponse, postJson } from "@/lib/client";
import { useWallet } from "@/lib/wallet-context";
import { ActionResult } from "./ActionResult";

const input =
  "w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm";
const label = "text-xs uppercase tracking-wide text-neutral-500";

export function RebalancePanel({
  positions,
  onDone,
}: {
  positions: PositionInfo[];
  onDone: () => void;
}) {
  const { selected } = useWallet();
  const [target, setTarget] = useState(positions[0]?.publicKey ?? "");
  const [strategy, setStrategy] = useState<"Spot" | "Curve" | "BidAsk">("Spot");
  const [withdrawXBps, setWithdrawXBps] = useState(10000);
  const [withdrawYBps, setWithdrawYBps] = useState(10000);
  const [topUpX, setTopUpX] = useState("0");
  const [topUpY, setTopUpY] = useState("0");
  const [slip, setSlip] = useState("5");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ActionResponse | null>(null);
  const [previewOk, setPreviewOk] = useState(false);

  useEffect(() => {
    setPreviewOk(false);
    setRes(null);
  }, [target, strategy, withdrawXBps, withdrawYBps, topUpX, topUpY]);

  async function run(dryRun: boolean) {
    setBusy(true);
    setRes(null);
    try {
      const r = await postJson<ActionResponse>("/api/position/rebalance", {
        dryRun,
        wallet: selected || undefined,
        positionPubKey: target,
        strategy,
        withdrawXBps,
        withdrawYBps,
        topUpX,
        topUpY,
        maxActiveBinSlippage: Number(slip) || 5,
      });
      setRes(r);
      if (dryRun) setPreviewOk(Boolean(r.preview?.ok));
      else {
        setPreviewOk(false);
        if (r.ok) onDone();
      }
    } catch (e) {
      setRes({ dryRun, preview: { txCount: 0, ok: false, error: String(e) } });
    } finally {
      setBusy(false);
    }
  }

  function execute() {
    if (
      confirm(
        "Rebalance? This withdraws (per the % below) and redeposits across a recentered range.",
      )
    )
      run(false);
  }

  if (positions.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-500">
        No positions to rebalance.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <h3 className="mb-3 text-sm font-semibold">Rebalance (recenter)</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <span className={label}>Position</span>
          <select
            className={input}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            {positions.map((p) => (
              <option key={p.publicKey} value={p.publicKey}>
                {p.publicKey.slice(0, 6)}… ({p.lowerBinId}–{p.upperBinId})
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className={label}>Shape</span>
          <select
            className={input}
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as typeof strategy)}
          >
            <option value="Spot">Spot</option>
            <option value="Curve">Curve</option>
            <option value="BidAsk">BidAsk</option>
          </select>
        </div>
        <div>
          <span className={label}>Active-bin slippage</span>
          <input
            type="number"
            className={input}
            value={slip}
            onChange={(e) => setSlip(e.target.value)}
          />
        </div>

        <div>
          <span className={label}>Withdraw SOL {(withdrawXBps / 100).toFixed(0)}%</span>
          <input
            type="range"
            min={0}
            max={10000}
            value={withdrawXBps}
            onChange={(e) => setWithdrawXBps(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <span className={label}>Withdraw USDC {(withdrawYBps / 100).toFixed(0)}%</span>
          <input
            type="range"
            min={0}
            max={10000}
            value={withdrawYBps}
            onChange={(e) => setWithdrawYBps(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <span className={label}>Top-up SOL</span>
          <input className={input} value={topUpX} onChange={(e) => setTopUpX(e.target.value)} />
        </div>
        <div>
          <span className={label}>Top-up USDC</span>
          <input className={input} value={topUpY} onChange={(e) => setTopUpY(e.target.value)} />
        </div>
      </div>

      {res?.summary && (
        <p className="mt-2 text-xs text-neutral-500">
          {res.summary.txCount} tx · {res.summary.initBinArrayIxs} bin-array init ·{" "}
          {res.summary.rebalanceIxs} rebalance ix
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          disabled={busy}
          onClick={() => run(true)}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-900 disabled:opacity-50"
        >
          {busy ? "…" : "Preview (simulate)"}
        </button>
        <button
          disabled={busy || !previewOk}
          onClick={execute}
          className="rounded-lg bg-purple-700 px-3 py-1.5 text-sm hover:bg-purple-600 disabled:opacity-40"
        >
          Execute
        </button>
      </div>

      <ActionResult res={res} />
    </div>
  );
}
