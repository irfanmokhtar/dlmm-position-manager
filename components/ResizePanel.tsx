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
  draft,
}: {
  positions: PositionInfo[];
  onDone: () => void;
  lockedPosition?: PositionInfo;
  // chart-driven pre-fill from an edge-drag (resize) gesture
  draft?: { lower?: { action: "increase" | "decrease"; length: number }; upper?: { action: "increase" | "decrease"; length: number }; key: number };
}) {
  const { selected } = useWallet();
  const [target, setTarget] = useState(lockedPosition?.publicKey ?? positions[0]?.publicKey ?? "");
  // Each edge is independent: on/off, widen vs narrow, bin count.
  const [lowerOn, setLowerOn] = useState(false);
  const [lowerAction, setLowerAction] = useState<"increase" | "decrease">("increase");
  const [lowerLen, setLowerLen] = useState(10);
  const [upperOn, setUpperOn] = useState(true);
  const [upperAction, setUpperAction] = useState<"increase" | "decrease">("increase");
  const [upperLen, setUpperLen] = useState(10);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ActionResponse | null>(null);
  const [previewOk, setPreviewOk] = useState(false);

  const pos = positions.find((p) => p.publicKey === target);
  const width = pos ? pos.upperBinId - pos.lowerBinId + 1 : 0;

  const lowerActive = lowerOn && lowerLen > 0;
  const upperActive = upperOn && upperLen > 0;
  const anyActive = lowerActive || upperActive;
  const anyDecrease = (lowerActive && lowerAction === "decrease") || (upperActive && upperAction === "decrease");

  useEffect(() => {
    setPreviewOk(false);
    setRes(null);
  }, [target, lowerOn, lowerAction, lowerLen, upperOn, upperAction, upperLen]);

  // apply a chart edge-drag (resize) gesture (keyed) — absent side toggles off
  useEffect(() => {
    if (!draft) return;
    setLowerOn(Boolean(draft.lower));
    if (draft.lower) {
      setLowerAction(draft.lower.action);
      setLowerLen(draft.lower.length);
    }
    setUpperOn(Boolean(draft.upper));
    if (draft.upper) {
      setUpperAction(draft.upper.action);
      setUpperLen(draft.upper.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.key]);

  async function run(dryRun: boolean) {
    setBusy(true);
    setRes(null);
    try {
      const r = await postJson<ActionResponse>("/api/position/resize", {
        dryRun,
        wallet: selected || undefined,
        positionPubKey: target,
        lower: lowerActive ? { action: lowerAction, length: lowerLen } : undefined,
        upper: upperActive ? { action: upperAction, length: upperLen } : undefined,
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
    const msg = anyDecrease
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

      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>Current width {width} bins · adjust either edge or both.</div>

      <SideRow
        title="Upper edge"
        on={upperOn}
        onToggle={setUpperOn}
        action={upperAction}
        onAction={setUpperAction}
        length={upperLen}
        onLength={setUpperLen}
      />
      <SideRow
        title="Lower edge"
        on={lowerOn}
        onToggle={setLowerOn}
        action={lowerAction}
        onAction={setLowerAction}
        length={lowerLen}
        onLength={setLowerLen}
      />

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
        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={busy || !anyActive} onClick={() => run(true)}>
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

// One resizable edge: include toggle + Widen/Narrow + bin count.
function SideRow({
  title,
  on,
  onToggle,
  action,
  onAction,
  length,
  onLength,
}: {
  title: string;
  on: boolean;
  onToggle: (v: boolean) => void;
  action: "increase" | "decrease";
  onAction: (v: "increase" | "decrease") => void;
  length: number;
  onLength: (v: number) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border-1)",
        borderRadius: 8,
        padding: 10,
        opacity: on ? 1 : 0.6,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} />
        <span className={sx.label} style={{ fontWeight: 600 }}>{title}</span>
      </label>
      {on && (
        <div style={grid2}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Seg value={action} options={[["increase", "Widen"], ["decrease", "Narrow"]]} onChange={onAction} />
          </div>
          <Field label={`Bins to ${action === "increase" ? "add" : "remove"}`} value={length} type="number" onChange={(v) => onLength(Number(v))} />
        </div>
      )}
    </div>
  );
}
