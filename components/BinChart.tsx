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

  // bins this wallet has liquidity in (for highlight)
  const ownedBins = new Set<number>();
  positions?.positions.forEach((p) => {
    for (let b = p.lowerBinId; b <= p.upperBinId; b++) ownedBins.add(b);
  });

  const chart = pool.bins.map((b) => {
    const price = Number(b.pricePerToken);
    const valueUsd = toUi(b.xAmount, dx) * price + toUi(b.yAmount, dy);
    return { binId: b.binId, valueUsd, price };
  });

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
      <h3 className="mb-3 text-sm font-semibold text-neutral-300">
        Liquidity by bin (around active)
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <XAxis
            dataKey="binId"
            tick={{ fontSize: 10, fill: "#737373" }}
            interval={6}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#737373" }}
            tickFormatter={(v) => `$${Math.round(Number(v))}`}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "#0a0a0a",
              border: "1px solid #262626",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => [`$${Number(v).toFixed(2)}`, "liquidity"]}
            labelFormatter={(l) => `bin ${l}`}
          />
          <ReferenceLine x={activeId} stroke="#f59e0b" strokeDasharray="3 3" />
          <Bar dataKey="valueUsd" radius={[2, 2, 0, 0]}>
            {chart.map((d) => (
              <Cell
                key={d.binId}
                fill={
                  d.binId === activeId
                    ? "#f59e0b"
                    : ownedBins.has(d.binId)
                      ? "#34d399"
                      : "#3f3f46"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex gap-4 text-xs text-neutral-500">
        <span><span className="text-amber-500">▮</span> active bin</span>
        <span><span className="text-emerald-400">▮</span> your liquidity</span>
        <span><span className="text-neutral-600">▮</span> pool</span>
      </div>
    </div>
  );
}
