"use client";

import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PoolResponse, PositionsResponse, toUi } from "@/lib/types";

// Pool-wide liquidity distribution. DLMM token split: bins below active are
// USDC (token-y), bins above are SOL (token-x), the active bin is mixed.
export function BinChart({
  pool,
  positions,
}: {
  pool: PoolResponse;
  positions?: PositionsResponse;
}) {
  const dx = pool.pool.tokenX.decimals;
  const dy = pool.pool.tokenY.decimals;
  const activeId = pool.activeBin.binId;

  const ownedBins = new Set<number>();
  positions?.positions.forEach((p) => {
    for (let b = p.lowerBinId; b <= p.upperBinId; b++) ownedBins.add(b);
  });

  const chart = pool.bins.map((b) => {
    const price = Number(b.pricePerToken);
    const valueUsd = toUi(b.xAmount, dx) * price + toUi(b.yAmount, dy);
    return { binId: b.binId, valueUsd, price };
  });
  const priceById = new Map(chart.map((d) => [d.binId, d.price]));

  const fillFor = (binId: number) =>
    binId === activeId
      ? "var(--active-bin)"
      : binId < activeId
        ? "var(--token-y)"
        : "var(--token-x)";

  return (
    <div className="card" style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Liquidity distribution</div>
          <div style={{ color: "var(--text-3)", fontSize: "var(--text-xs)", marginTop: 2 }}>
            Around active bin · {chart.length} bins shown
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <XAxis
            dataKey="binId"
            tick={{ fontSize: 9, fill: "var(--text-3)" }}
            interval={8}
            tickFormatter={(binId) => {
              const p = priceById.get(Number(binId));
              return p ? `$${p.toFixed(2)}` : String(binId);
            }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--text-3)" }}
            tickFormatter={(v) => `$${Math.round(Number(v))}`}
            width={48}
          />
          <Tooltip
            cursor={{ fill: "var(--bg-2)" }}
            contentStyle={{
              background: "var(--bg-1)",
              border: "1px solid var(--border-2)",
              borderRadius: 10,
              fontSize: 12,
              color: "var(--text-1)",
            }}
            labelStyle={{ color: "var(--text-1)" }}
            itemStyle={{ color: "var(--text-1)" }}
            formatter={(v) => [`$${Number(v).toFixed(2)}`, "liquidity"]}
            labelFormatter={(l, payload) => {
              const price = (payload?.[0] as { payload?: { price?: number } } | undefined)?.payload?.price;
              return price ? `bin ${l} · $${price.toFixed(4)}` : `bin ${l}`;
            }}
          />
          <ReferenceLine x={activeId} stroke="var(--active-bin)" strokeDasharray="3 3" />
          <Bar dataKey="valueUsd" radius={[2, 2, 0, 0]}>
            {chart.map((d) => (
              <Cell
                key={d.binId}
                fill={fillFor(d.binId)}
                fillOpacity={ownedBins.has(d.binId) || d.binId === activeId ? 1 : 0.32}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, background: "var(--token-x)", borderRadius: 1 }} /> SOL bins (above active)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, background: "var(--token-y)", borderRadius: 1 }} /> USDC bins (below active)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <span style={{ width: 8, height: 8, background: "var(--token-x)", borderRadius: 1, opacity: 0.32 }} /> not in your range
        </span>
      </div>
    </div>
  );
}
