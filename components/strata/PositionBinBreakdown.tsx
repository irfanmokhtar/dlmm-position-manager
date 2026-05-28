"use client";

// Real per-bin breakdown for the exclusive position page — replaces the mock
// GestureSpecCard from the design's Layout A. Lists every bin the position
// holds (from position.binData) with its price and SOL/USDC split.
import { PoolResponse, PositionInfo, toUi } from "@/lib/types";

function fmtAmt(v: number): string {
  if (v === 0) return "—";
  if (v < 0.0001) return v.toExponential(1);
  return v.toLocaleString(undefined, { maximumFractionDigits: v < 1 ? 4 : 2 });
}

export function PositionBinBreakdown({
  pool,
  position,
  activeBinId,
}: {
  pool: PoolResponse;
  position: PositionInfo;
  activeBinId: number;
}) {
  const dx = pool.pool.tokenX.decimals;
  const dy = pool.pool.tokenY.decimals;
  const bins = [...position.binData].sort((a, b) => b.binId - a.binId); // high → low

  const colDot = (side: "x" | "y" | "active") =>
    side === "active"
      ? "linear-gradient(to bottom, var(--token-x) 50%, var(--token-y) 50%)"
      : side === "x"
        ? "var(--token-x)"
        : "var(--token-y)";

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Per-bin breakdown</div>
          <div style={{ color: "var(--text-3)", fontSize: "var(--text-xs)", marginTop: 2 }}>
            {bins.length} bins · {position.lowerBinId}–{position.upperBinId}
          </div>
        </div>
      </div>

      {/* header row */}
      <div
        className="label"
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr 1fr 1fr",
          gap: 10,
          paddingBottom: 6,
          borderBottom: "1px solid var(--border-1)",
        }}
      >
        <span>Bin</span>
        <span style={{ textAlign: "right" }}>Price</span>
        <span style={{ textAlign: "right" }}>SOL</span>
        <span style={{ textAlign: "right" }}>USDC</span>
      </div>

      {/* scrollable rows */}
      <div style={{ display: "flex", flexDirection: "column", overflow: "auto", maxHeight: 340 }}>
        {bins.map((b) => {
          const side: "x" | "y" | "active" =
            b.binId === activeBinId ? "active" : b.binId > activeBinId ? "x" : "y";
          const sol = toUi(b.positionXAmount, dx);
          const usdc = toUi(b.positionYAmount, dy);
          return (
            <div
              key={b.binId}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr 1fr 1fr",
                gap: 10,
                alignItems: "center",
                padding: "6px 0",
                fontSize: "var(--text-xs)",
                borderBottom: "1px solid var(--border-1)",
                background: side === "active" ? "color-mix(in oklab, var(--active-bin) 10%, transparent)" : undefined,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: colDot(side), flex: "none" }} />
                <span className="mono num" style={{ color: side === "active" ? "var(--active-bin)" : "var(--text-2)" }}>
                  {b.binId}
                </span>
              </span>
              <span className="mono num" style={{ textAlign: "right", color: "var(--text-2)" }}>
                ${Number(b.pricePerToken).toFixed(2)}
              </span>
              <span className="mono num" style={{ textAlign: "right", color: sol ? "var(--text-1)" : "var(--text-4)" }}>
                {fmtAmt(sol)}
              </span>
              <span className="mono num" style={{ textAlign: "right", color: usdc ? "var(--text-1)" : "var(--text-4)" }}>
                {fmtAmt(usdc)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
