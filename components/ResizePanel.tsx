"use client";

import { useEffect, useState } from "react";
import { PositionInfo } from "@/lib/types";
import { ActionResponse, postJson } from "@/lib/client";
import { useWallet } from "@/lib/wallet-context";
import { I, PanelCard, Seg, Field, sx } from "@/components/strata/ui";
import { ActionResult } from "./ActionResult";

const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } as const;

export function ResizePanel({
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
  const [action, setAction] = useState<"increase" | "decrease">("increase");
  const [side, setSide] = useState<"Lower" | "Upper">("Upper");
  const [length, setLength] = useState(10);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ActionResponse | null>(null);
  const [previewOk, setPreviewOk] = useState(false);

  const pos = positions.find((p) => p.publicKey === target);
  const width = pos ? pos.upperBinId - pos.lowerBinId + 1 : 0;

  useEffect(() => {
    setPreviewOk(false);
    setRes(null);
  }, [target, action, side, length]);

  async function run(dryRun: boolean) {
    setBusy(true);
    setRes(null);
    try {
      const r = await postJson<ActionResponse>("/api/position/resize", {
        dryRun,
        wallet: selected || undefined,
        positionPubKey: target,
        action,
        side,
        length,
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
    const msg =
      action === "decrease"
        ? "Shrink position? Rent is refunded only on full close, not on shrink."
        : "Expand position? This pays rent for new bins.";
    if (confirm(msg)) run(false);
  }

  if (positions.length === 0) {
    return (
      <PanelCard icon={I.range} title="Resize width" accent="var(--accent-1)">
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-3)" }}>No positions to resize.</div>
      </PanelCard>
    );
  }

  return (
    <PanelCard icon={I.range} title="Resize width" accent="var(--accent-1)">
      {!lockedPosition && (
        <div>
          <div className={sx.label} style={{ marginBottom: 6 }}>Position {pos ? `(${width} bins)` : ""}</div>
          <select className={sx.inputText} value={target} onChange={(e) => setTarget(e.target.value)}>
            {positions.map((p) => (
              <option key={p.publicKey} value={p.publicKey}>
                {p.publicKey.slice(0, 6)}… ({p.lowerBinId}–{p.upperBinId})
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className={sx.label}>Action</div>
        <Seg value={action} options={[["increase", "Widen"], ["decrease", "Narrow"]]} onChange={setAction} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className={sx.label}>Side</div>
        <Seg value={side} options={[["Upper", "Upper"], ["Lower", "Lower"]]} onChange={setSide} />
      </div>

      <div style={grid2}>
        <Field label="Current width" value={`${width} bins`} mono={false} onChange={() => {}} />
        <Field label={`Bins to ${action === "increase" ? "add" : "remove"}`} value={length} type="number" onChange={(v) => setLength(Number(v))} />
      </div>

      <div
        style={{
          background: "color-mix(in oklab, var(--warn) 10%, transparent)",
          border: "1px solid color-mix(in oklab, var(--warn) 30%, transparent)",
          borderRadius: 8,
          padding: "8px 10px",
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          fontSize: "var(--text-xs)",
        }}
      >
        <span style={{ color: "var(--warn)", marginTop: 1 }}>{I.warn}</span>
        <div style={{ color: "var(--text-2)" }}>
          <strong style={{ color: "var(--text-1)" }}>Heads-up.</strong> Widening only changes the range — seed new bins with Add.
          Narrowing doesn&apos;t refund rent; only full <span className="mono">closePosition</span> does.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={busy} onClick={() => run(true)}>
          {busy ? "…" : "Preview"}
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy || !previewOk} onClick={execute}>
          {I.range} Resize
        </button>
      </div>

      <ActionResult res={res} />
    </PanelCard>
  );
}
