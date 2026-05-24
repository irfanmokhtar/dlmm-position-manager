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
import { PoolResponse, PositionInfo, toUi } from "@/lib/types";

// Per-position liquidity distribution across that position's own bins.
export function PositionChart({
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
  const width = position.upperBinId - position.lowerBinId + 1;
  const inRange =
    activeBinId >= position.lowerBinId && activeBinId <= position.upperBinId;

  const chart = position.binData.map((b) => ({
    binId: b.binId,
    price: Number(b.pricePerToken),
    valueUsd:
      toUi(b.positionXAmount, dx) * Number(b.pricePerToken) +
      toUi(b.positionYAmount, dy),
  }));

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="mb-2 flex items-center justify-between text-xs">
        <a
          href={`https://solscan.io/account/${position.publicKey}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-neutral-400 hover:text-neutral-200"
        >
          {position.publicKey.slice(0, 4)}…{position.publicKey.slice(-4)}
        </a>
        <span className="text-neutral-500">
          bins {position.lowerBinId}–{position.upperBinId} ({width})
          {inRange ? (
            <span className="ml-2 text-emerald-400">in range</span>
          ) : (
            <span className="ml-2 text-amber-400">out</span>
          )}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chart} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <XAxis
            dataKey="binId"
            tick={{ fontSize: 9, fill: "#737373" }}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#737373" }}
            tickFormatter={(v) => `$${Math.round(Number(v))}`}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "#0a0a0a",
              border: "1px solid #262626",
              borderRadius: 8,
              fontSize: 12,
              color: "#e5e5e5",
            }}
            labelStyle={{ color: "#e5e5e5" }}
            itemStyle={{ color: "#e5e5e5" }}
            formatter={(v) => [`$${Number(v).toFixed(2)}`, "liquidity"]}
            labelFormatter={(l, payload) => {
              const price = (payload?.[0] as { payload?: { price?: number } } | undefined)
                ?.payload?.price;
              return price ? `bin ${l} · $${price.toFixed(4)}` : `bin ${l}`;
            }}
          />
          {inRange && (
            <ReferenceLine
              x={activeBinId}
              stroke="#f59e0b"
              strokeDasharray="3 3"
            />
          )}
          <Bar dataKey="valueUsd" radius={[2, 2, 0, 0]}>
            {chart.map((d) => (
              <Cell
                key={d.binId}
                fill={d.binId === activeBinId ? "#f59e0b" : "#34d399"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
