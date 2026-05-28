"use client";

import { PoolResponse, PositionInfo, PositionsResponse, toUi } from "@/lib/types";
import { I, Pill, shortKey } from "@/components/strata/ui";

const COLS = "1.5fr 1.2fr 0.6fr 1fr 1fr 1.2fr 0.7fr 0.7fr";

export function PositionTable({
  pool,
  data,
  selectedId,
  onOpen,
  onNew,
}: {
  pool: PoolResponse;
  data: PositionsResponse;
  selectedId?: string;
  onOpen?: (p: PositionInfo) => void;
  onNew?: () => void;
}) {
  const dx = pool.pool.tokenX.decimals;
  const dy = pool.pool.tokenY.decimals;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px var(--pad-card) 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Positions</div>
          <Pill kind="accent">{data.positions.length}</Pill>
        </div>
        {onNew && (
          <button className="btn btn-sm btn-primary" onClick={onNew}>
            {I.plus} New position
          </button>
        )}
      </div>

      {data.positions.length === 0 ? (
        <div style={{ padding: "8px var(--pad-card) 20px", fontSize: "var(--text-sm)", color: "var(--text-3)" }}>
          No open positions in this pool for {shortKey(data.owner)}.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: COLS,
              padding: "10px var(--pad-card)",
              color: "var(--text-3)",
              fontSize: "var(--text-xs)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              borderBottom: "1px solid var(--border-1)",
            }}
          >
            <div>Position</div>
            <div>Range (bins)</div>
            <div>Width</div>
            <div>SOL</div>
            <div>USDC</div>
            <div>Unclaimed</div>
            <div>Status</div>
            <div />
          </div>

          {data.positions.map((p) => {
            const width = p.upperBinId - p.lowerBinId + 1;
            const inRange = data.activeBinId >= p.lowerBinId && data.activeBinId <= p.upperBinId;
            const feeUsd = toUi(p.feeX, dx) * Number(pool.activeBin.pricePerToken) + toUi(p.feeY, dy);
            const sel = selectedId === p.publicKey;
            return (
              <div
                key={p.publicKey}
                onClick={() => onOpen?.(p)}
                className="row"
                style={{
                  gridTemplateColumns: COLS,
                  padding: "0 var(--pad-card)",
                  borderBottom: "1px solid var(--border-1)",
                  cursor: "pointer",
                  background: sel ? "var(--bg-2)" : "transparent",
                  borderLeft: sel ? "2px solid var(--accent-1)" : "2px solid transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 26, height: 26, background: "var(--bg-3)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-1)" }}>
                    {I.layers}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span className="mono" style={{ fontSize: 12 }}>{shortKey(p.publicKey, 4)}</span>
                    <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>{width} bins</span>
                  </div>
                </div>
                <div className="mono num" style={{ fontSize: "var(--text-sm)" }}>
                  {p.lowerBinId} <span style={{ color: "var(--text-3)" }}>→</span> {p.upperBinId}
                </div>
                <div className="mono num" style={{ color: "var(--text-2)", fontSize: "var(--text-sm)" }}>{width}</div>
                <div className="mono num" style={{ fontSize: "var(--text-sm)" }}>{toUi(p.totalXAmount, dx).toFixed(3)}</div>
                <div className="mono num" style={{ fontSize: "var(--text-sm)" }}>{toUi(p.totalYAmount, dy).toFixed(2)}</div>
                <div className="mono num" style={{ fontSize: "var(--text-sm)", color: "var(--success)" }}>${feeUsd.toFixed(2)}</div>
                <div>{inRange ? <Pill kind="in" dot="pulse">in range</Pill> : <Pill kind="out">out</Pill>}</div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen?.(p);
                    }}
                  >
                    Open {I.chevR}
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
