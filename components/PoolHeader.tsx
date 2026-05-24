"use client";

import { PoolResponse } from "@/lib/types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function PoolHeader({ data }: { data: PoolResponse }) {
  const tvl = data.datapi?.liquidity;
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">SOL / USDC</h2>
        <a
          href={`https://solscan.io/account/${data.pool.address}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-neutral-500 hover:text-neutral-300"
        >
          {data.pool.address.slice(0, 6)}…{data.pool.address.slice(-6)}
        </a>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Price" value={`$${Number(data.activeBin.pricePerToken).toFixed(4)}`} />
        <Stat label="Active bin" value={String(data.activeBin.binId)} />
        <Stat label="Bin step" value={`${data.pool.binStep} bps`} />
        <Stat label="Base fee" value={`${Number(data.fees.base).toFixed(3)}%`} />
        <Stat label="Dynamic fee" value={`${Number(data.fees.dynamic).toFixed(3)}%`} />
        <Stat label="TVL" value={tvl ? `$${Math.round(tvl).toLocaleString()}` : "—"} />
      </div>
    </div>
  );
}
