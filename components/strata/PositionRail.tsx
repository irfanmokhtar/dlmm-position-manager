"use client";

import { useState } from "react";
import { PoolResponse, PositionInfo, PositionsResponse, toUi } from "@/lib/types";
import { AddLiquidityPanel } from "@/components/AddLiquidityPanel";
import { RemovePanel } from "@/components/RemovePanel";
import { ResizePanel } from "@/components/ResizePanel";
import { RebalancePanel } from "@/components/RebalancePanel";
import { PositionLiqChart } from "./PositionLiqChart";
import { I, Pill, Stat, TokenPair, shortKey, fmtUsd } from "./ui";

const RAIL_W = 480;

const HINTS: { c: string; s: string; t: string }[] = [
  { c: "var(--accent-1)", s: "↔", t: "Drag edges to resize" },
  { c: "var(--accent-1)", s: "⇔", t: "Drag grip to recenter" },
  { c: "var(--danger)", s: "−", t: "Drag pip to withdraw band" },
  { c: "var(--accent-1)", s: "+", t: "Drop slot to add band" },
];

type Tab = "add" | "remove" | "resize" | "rebalance";

export function PositionRail({
  pool,
  positions,
  selected,
  createMode,
  onClose,
  onDone,
}: {
  pool: PoolResponse;
  positions: PositionsResponse;
  selected: PositionInfo | null;
  createMode: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<Tab>("add");
  const dx = pool.pool.tokenX.decimals;
  const dy = pool.pool.tokenY.decimals;
  const price = Number(pool.activeBin.pricePerToken);

  const railShell: React.CSSProperties = {
    width: RAIL_W,
    flex: "none",
    background: "var(--bg-1)",
    boxShadow: "-24px 0 60px -20px rgba(0,0,0,0.55)",
    display: "flex",
    flexDirection: "column",
    borderLeft: "1px solid var(--border-1)",
    position: "sticky",
    top: 0,
    alignSelf: "flex-start",
    height: "100vh",
    overflow: "hidden",
  };

  // ── Create-new-position mode ──
  if (createMode || !selected) {
    return (
      <aside className="strata" style={railShell}>
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn btn-icon btn-ghost btn-sm" aria-label="Close" onClick={onClose}>{I.arrowL}</button>
            <span style={{ fontWeight: 600 }}>New position</span>
          </div>
          <button className="btn btn-sm btn-ghost btn-icon" aria-label="Close" onClick={onClose}>{I.close}</button>
        </div>
        <div style={bodyStyle}>
          <AddLiquidityPanel pool={pool} positions={positions.positions} onDone={onDone} />
        </div>
      </aside>
    );
  }

  const inRange = positions.activeBinId >= selected.lowerBinId && positions.activeBinId <= selected.upperBinId;
  const sol = toUi(selected.totalXAmount, dx);
  const usdc = toUi(selected.totalYAmount, dy);
  const value = sol * price + usdc;
  const feeUsd = toUi(selected.feeX, dx) * price + toUi(selected.feeY, dy);
  const width = selected.upperBinId - selected.lowerBinId + 1;

  const panelProps = { positions: [selected], lockedPosition: selected, onDone };

  return (
    <aside className="strata" style={railShell}>
      {/* rail header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <button className="btn btn-icon btn-ghost btn-sm" aria-label="Close" onClick={onClose}>{I.arrowL}</button>
          <TokenPair />
          <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>{shortKey(selected.publicKey, 5)}</span>
          {inRange ? <Pill kind="in" dot="pulse">in range</Pill> : <Pill kind="out">out</Pill>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <a className="btn btn-sm btn-ghost btn-icon" href={`https://solscan.io/account/${selected.publicKey}`} target="_blank" rel="noreferrer" aria-label="Solscan">
            {I.ext}
          </a>
          <button className="btn btn-sm btn-ghost btn-icon" aria-label="Close" onClick={onClose}>{I.close}</button>
        </div>
      </div>

      {/* rail body */}
      <div style={bodyStyle}>
        {/* compact stats */}
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 14 }}>
            <Stat label="Value" value={fmtUsd(value, { dec: 0 })} sub={`${sol.toFixed(2)} SOL + ${usdc.toFixed(0)} USDC`} size="lg" />
            <Stat label="Range" value={`${width} bins`} sub={`${selected.lowerBinId}–${selected.upperBinId}`} />
            <Stat label="Unclaimed" value={`$${feeUsd.toFixed(2)}`} accent="var(--success)" />
          </div>
        </div>

        {/* interactive chart (planned) */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Position liquidity</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Drag handles to resize · grip to recenter</div>
            </div>
            <Pill kind="accent" dot>PLANNED</Pill>
          </div>
          <PositionLiqChart
            pool={pool}
            position={selected}
            activeBinId={positions.activeBinId}
            width={RAIL_W - 64}
            height={260}
            showPriceScale={false}
          />
        </div>

        {/* action tabs */}
        <div className="tabs">
          <button aria-current={tab === "add"} onClick={() => setTab("add")}>Add</button>
          <button aria-current={tab === "remove"} onClick={() => setTab("remove")}>Remove</button>
          <button aria-current={tab === "resize"} onClick={() => setTab("resize")}>Resize</button>
          <button aria-current={tab === "rebalance"} onClick={() => setTab("rebalance")}>Rebalance</button>
        </div>
        {tab === "add" && <AddLiquidityPanel pool={pool} {...panelProps} />}
        {tab === "remove" && <RemovePanel {...panelProps} />}
        {tab === "resize" && <ResizePanel {...panelProps} />}
        {tab === "rebalance" && <RebalancePanel {...panelProps} />}

        {/* gesture hints (planned) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {HINTS.map((g) => (
            <div
              key={g.s}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, border: "1px solid var(--border-1)", borderRadius: 8, background: "var(--bg-2)" }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  color: g.c,
                  background: `color-mix(in oklab, ${g.c} 14%, transparent)`,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {g.s}
              </span>
              <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>{g.t}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

const headerStyle: React.CSSProperties = {
  padding: "14px 20px",
  borderBottom: "1px solid var(--border-1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "var(--bg-0)",
  flex: "none",
};

const bodyStyle: React.CSSProperties = {
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  overflow: "auto",
};
