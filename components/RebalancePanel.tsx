"use client";

import { useEffect, useState } from "react";
import { PositionInfo } from "@/lib/types";
import { ActionResponse, postJson } from "@/lib/client";
import { useWallet } from "@/lib/wallet-context";
import { I, PanelCard, Seg, Field, sx } from "@/components/strata/ui";
import { ActionResult } from "./ActionResult";

const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } as const;

export function RebalancePanel({
  positions,
  onDone,
  lockedPosition,
}: {
  positions: PositionInfo[];
  onDone: () => void;
  lockedPosition?: PositionInfo;
}) {
  const { selected } = useWallet();
  const [target, setTarget] = useState(lockedPosition?.publicKey ?? positions[0]?.publicKey ?? "");
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
    if (confirm("Rebalance? This withdraws (per the % below) and redeposits across a recentered range.")) run(false);
  }

  if (positions.length === 0) {
    return (
      <PanelCard icon={I.target} title="Rebalance · recenter" accent="var(--accent-1)">
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-3)" }}>No positions to rebalance.</div>
      </PanelCard>
    );
  }

  return (
    <PanelCard icon={I.target} title="Rebalance · recenter" accent="var(--accent-1)">
      {!lockedPosition && (
        <div>
          <div className={sx.label} style={{ marginBottom: 6 }}>Position</div>
          <select className={sx.inputText} value={target} onChange={(e) => setTarget(e.target.value)}>
            {positions.map((p) => (
              <option key={p.publicKey} value={p.publicKey}>
                {p.publicKey.slice(0, 6)}… ({p.lowerBinId}–{p.upperBinId})
              </option>
            ))}
          </select>
        </div>
      )}

      <Seg value={strategy} options={[["Spot", "Spot"], ["Curve", "Curve"], ["BidAsk", "Bid-Ask"]]} onChange={setStrategy} />

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <div className={sx.label}>Withdraw SOL</div>
          <span className="mono num" style={{ fontWeight: 600 }}>{(withdrawXBps / 100).toFixed(0)}%</span>
        </div>
        <input type="range" min={0} max={10000} value={withdrawXBps} onChange={(e) => setWithdrawXBps(Number(e.target.value))} />
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <div className={sx.label}>Withdraw USDC</div>
          <span className="mono num" style={{ fontWeight: 600 }}>{(withdrawYBps / 100).toFixed(0)}%</span>
        </div>
        <input type="range" min={0} max={10000} value={withdrawYBps} onChange={(e) => setWithdrawYBps(Number(e.target.value))} />
      </div>

      <div style={grid2}>
        <Field label="Top-up SOL" value={topUpX} suffix="SOL" onChange={setTopUpX} />
        <Field label="Top-up USDC" value={topUpY} suffix="USDC" onChange={setTopUpY} />
        <Field label="Active-bin slippage" value={slip} type="number" onChange={setSlip} />
      </div>

      {res?.summary && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
          {res.summary.txCount} tx · {res.summary.initBinArrayIxs} bin-array init · {res.summary.rebalanceIxs} rebalance ix
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={busy} onClick={() => run(true)}>
          {busy ? "…" : "Preview (simulate)"}
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy || !previewOk} onClick={execute}>
          {I.target} Rebalance
        </button>
      </div>

      <ActionResult res={res} />
    </PanelCard>
  );
}
