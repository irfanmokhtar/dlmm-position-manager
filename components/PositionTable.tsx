"use client";

import { PoolResponse, PositionsResponse, toUi } from "@/lib/types";

export function PositionTable({
  pool,
  data,
}: {
  pool: PoolResponse;
  data: PositionsResponse;
}) {
  const dx = pool.pool.tokenX.decimals;
  const dy = pool.pool.tokenY.decimals;

  if (data.positions.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 text-sm text-neutral-500">
        No open positions in this pool for {data.owner.slice(0, 4)}…
        {data.owner.slice(-4)}.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
          <tr className="border-b border-neutral-800">
            <th className="p-3">Position</th>
            <th className="p-3">Range (bins)</th>
            <th className="p-3">Width</th>
            <th className="p-3">SOL</th>
            <th className="p-3">USDC</th>
            <th className="p-3">Unclaimed fees</th>
            <th className="p-3">In range</th>
          </tr>
        </thead>
        <tbody>
          {data.positions.map((p) => {
            const width = p.upperBinId - p.lowerBinId + 1;
            const inRange =
              data.activeBinId >= p.lowerBinId &&
              data.activeBinId <= p.upperBinId;
            return (
              <tr key={p.publicKey} className="border-b border-neutral-900">
                <td className="p-3 font-mono text-xs">
                  {p.publicKey.slice(0, 4)}…{p.publicKey.slice(-4)}
                </td>
                <td className="p-3 tabular-nums">
                  {p.lowerBinId} → {p.upperBinId}
                </td>
                <td className="p-3 tabular-nums">{width}</td>
                <td className="p-3 tabular-nums">
                  {toUi(p.totalXAmount, dx).toFixed(4)}
                </td>
                <td className="p-3 tabular-nums">
                  {toUi(p.totalYAmount, dy).toFixed(2)}
                </td>
                <td className="p-3 tabular-nums text-emerald-400">
                  {toUi(p.feeX, dx).toFixed(4)} SOL /{" "}
                  {toUi(p.feeY, dy).toFixed(2)} USDC
                </td>
                <td className="p-3">
                  <span
                    className={
                      inRange ? "text-emerald-400" : "text-amber-400"
                    }
                  >
                    {inRange ? "yes" : "no"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
