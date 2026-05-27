"use client";

import { useEffect, useState } from "react";
import { PositionInfo } from "@/lib/types";
import { ActionResponse, postJson } from "@/lib/client";
import { useWallet } from "@/lib/wallet-context";
import { I, PanelCard, Field, sx } from "@/components/strata/ui";
import { ActionResult } from "./ActionResult";

const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } as const;

export function RemovePanel({
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
  const [fromBinId, setFromBinId] = useState(0);
  const [toBinId, setToBinId] = useState(0);
  const [bps, setBps] = useState(10000);
  const [claimClose, setClaimClose] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ActionResponse | null>(null);
  const [previewOk, setPreviewOk] = useState(false);

  useEffect(() => {
    const p = positions.find((x) => x.publicKey === target);
    if (p) {
      setFromBinId(p.lowerBinId);
      setToBinId(p.upperBinId);
    }
    setPreviewOk(false);
    setRes(null);
  }, [target, positions]);

  async function run(dryRun: boolean) {
    setBusy(true);
    setRes(null);
    try {
      const r = await postJson<ActionResponse>("/api/liquidity/remove", {
        dryRun,
        wallet: selected || undefined,
        positionPubKey: target,
        fromBinId,
        toBinId,
        bps,
        shouldClaimAndClose: claimClose,
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
    if (confirm("Send real transaction(s)? This withdraws liquidity.")) run(false);
  }

  if (positions.length === 0) {
    return (
      <PanelCard icon={I.minus} title="Remove liquidity" accent="var(--danger)">
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-3)" }}>No positions to remove from.</div>
      </PanelCard>
    );
  }

  return (
    <PanelCard icon={I.minus} title="Remove liquidity" accent="var(--danger)">
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

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <div className={sx.label}>Withdraw amount</div>
          <span className="mono num" style={{ color: "var(--danger)", fontWeight: 600 }}>{(bps / 100).toFixed(0)}%</span>
        </div>
        <input type="range" min={1} max={10000} value={bps} onChange={(e) => setBps(Number(e.target.value))} />
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {[2500, 5000, 7500, 10000].map((v) => (
            <button key={v} className="btn btn-sm btn-ghost" style={{ flex: 1 }} onClick={() => setBps(v)}>
              {v / 100}%
            </button>
          ))}
        </div>
      </div>

      <div style={grid2}>
        <Field label="From bin" value={fromBinId} type="number" onChange={(v) => setFromBinId(Number(v))} />
        <Field label="To bin" value={toBinId} type="number" onChange={(v) => setToBinId(Number(v))} />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)", color: "var(--text-2)" }}>
        <input type="checkbox" checked={claimClose} onChange={(e) => setClaimClose(e.target.checked)} />
        Claim fees &amp; close position if fully emptied
      </label>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={busy} onClick={() => run(true)}>
          {busy ? "…" : "Preview"}
        </button>
        <button className="btn btn-danger" style={{ flex: 1 }} disabled={busy || !previewOk} onClick={execute}>
          {I.minus} Withdraw
        </button>
      </div>

      <ActionResult res={res} />
    </PanelCard>
  );
}
