"use client";

// Layout A position header: breadcrumb + actions + 6-stat row.
// Mirrors the design bundle's PositionHeader (project/position-detail.jsx) but
// wired to real data. PnL/Age come from the Meteora data API (pnl prop).
import { PoolResponse, PositionInfo, PositionPnL, toUi } from "@/lib/types";
import { I, Pill, Stat, TokenPair, shortKey, fmtUsd } from "./ui";

function humanizeAge(createdAtSec: number): string {
  const ms = Date.now() - createdAtSec * 1000;
  if (ms <= 0 || !Number.isFinite(ms)) return "—";
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

export function PositionHeader({
  pool,
  position,
  activeBinId,
  pnl,
  onBack,
  onClosePosition,
}: {
  pool: PoolResponse;
  position: PositionInfo;
  activeBinId: number;
  pnl: PositionPnL | null;
  onBack: () => void;
  onClosePosition?: () => void;
}) {
  const dx = pool.pool.tokenX.decimals;
  const dy = pool.pool.tokenY.decimals;
  const price = Number(pool.activeBin.pricePerToken);

  const sol = toUi(position.totalXAmount, dx);
  const usdc = toUi(position.totalYAmount, dy);
  const value = sol * price + usdc;
  const feeUsd = toUi(position.feeX, dx) * price + toUi(position.feeY, dy);
  const width = position.upperBinId - position.lowerBinId + 1;
  const inRange = activeBinId >= position.lowerBinId && activeBinId <= position.upperBinId;

  // price band from the position's own bins, falling back to geometric spacing
  const priceById = new Map<number, number>();
  for (const b of position.binData) priceById.set(b.binId, Number(b.pricePerToken));
  const priceAt = (binId: number) =>
    priceById.get(binId) ?? price * Math.pow(1 + pool.pool.binStep / 10000, binId - activeBinId);
  const loPrice = priceAt(position.lowerBinId);
  const hiPrice = priceAt(position.upperBinId);
  const rangePct = price > 0 ? ((hiPrice - loPrice) / (2 * price)) * 100 : 0;

  const pnlUsd = pnl ? Number(pnl.pnlUsd) : null;
  const pnlUsdPct = pnl ? Number(pnl.pnlPctChange) : null;
  const pnlSol = pnl?.pnlSol != null ? Number(pnl.pnlSol) : null;
  const pnlSolPct = pnl?.pnlSolPctChange != null ? Number(pnl.pnlSolPctChange) : null;
  const age = pnl ? humanizeAge(pnl.createdAt) : "—";

  function share() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
  }

  return (
    <div className="card" style={{ padding: "var(--pad-card-y) var(--pad-card)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>{I.arrowL} Positions</button>
          <span style={{ color: "var(--text-3)" }}>/</span>
          <TokenPair />
          <span className="mono" style={{ color: "var(--text-3)", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
            {shortKey(position.publicKey, 6)}
          </span>
          {inRange ? <Pill kind="in" dot="pulse">in range</Pill> : <Pill kind="out">out of range</Pill>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="btn btn-sm btn-ghost" href={`https://solscan.io/account/${position.publicKey}`} target="_blank" rel="noreferrer">
            {I.ext} Solscan
          </a>
          <button className="btn btn-sm btn-ghost" onClick={share}>{I.copy} Share</button>
          <button className="btn btn-sm btn-danger" onClick={onClosePosition}>Close position</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr 1fr", gap: 24 }}>
        <Stat label="Position value" value={fmtUsd(value, { dec: 2 })} sub={`${sol.toFixed(3)} SOL + ${usdc.toFixed(2)} USDC`} size="lg" />
        <Stat label="Range" value={`${position.lowerBinId}–${position.upperBinId}`} sub={`${width} bins · ±${rangePct.toFixed(2)}%`} />
        <Stat label="Price band" value={`$${loPrice.toFixed(2)}–$${hiPrice.toFixed(2)}`} />
        <Stat label="Unclaimed fees" value={`$${feeUsd.toFixed(2)}`} accent="var(--success)" sub={`${toUi(position.feeX, dx).toFixed(4)} SOL · ${toUi(position.feeY, dy).toFixed(2)} USDC`} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div className="label">PnL</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div className="mono num" style={{ fontSize: "var(--text-stat)", fontWeight: 600, lineHeight: 1.1, color: pnlUsd !== null ? (pnlUsd >= 0 ? "var(--success)" : "var(--danger)") : "var(--text-1)" }}>
                {pnlUsd === null ? "—" : fmtUsd(pnlUsd, { dec: 2 })}
              </div>
              {pnlUsdPct !== null && <div style={{ fontSize: "var(--text-xs)", color: pnlUsdPct >= 0 ? "var(--success)" : "var(--danger)" }}>{pnlUsdPct >= 0 ? "+" : ""}{pnlUsdPct.toFixed(2)}%</div>}
            </div>
            <div style={{ width: 1, alignSelf: "stretch", background: "var(--border)", flexShrink: 0 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div className="mono num" style={{ fontSize: "var(--text-stat)", fontWeight: 600, lineHeight: 1.1, color: pnlSol !== null ? (pnlSol >= 0 ? "var(--success)" : "var(--danger)") : "var(--text-1)" }}>
                {pnlSol === null ? "—" : `${pnlSol >= 0 ? "+" : ""}${pnlSol.toFixed(4)}`}
              </div>
              {pnlSolPct !== null && <div style={{ fontSize: "var(--text-xs)", color: pnlSolPct >= 0 ? "var(--success)" : "var(--danger)" }}>{pnlSolPct >= 0 ? "+" : ""}{pnlSolPct.toFixed(2)}%</div>}
            </div>
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>USD · SOL · since open</div>
        </div>
        <Stat label="Age" value={age} sub="since open" />
      </div>
    </div>
  );
}
