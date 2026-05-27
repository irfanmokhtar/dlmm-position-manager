"use client";

import { PoolResponse } from "@/lib/types";
import { I, Pill, Stat, TokenPair, shortKey, fmtUsd } from "@/components/strata/ui";

export function PoolHeader({ data }: { data: PoolResponse }) {
  const tvl = data.datapi?.liquidity;
  const price = Number(data.activeBin.pricePerToken);
  return (
    <div className="card" style={{ padding: "var(--pad-card-y) var(--pad-card)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <TokenPair x="SOL" y="USDC" />
          <Pill kind="accent" dot>DLMM</Pill>
          <span className="mono" style={{ color: "var(--text-3)", fontSize: "var(--text-xs)" }}>
            {data.pool.binStep} bps · bin {data.activeBin.binId}
          </span>
          <a
            href={`https://solscan.io/account/${data.pool.address}`}
            target="_blank"
            rel="noreferrer"
            className="mono"
            style={{ color: "var(--text-3)", fontSize: "var(--text-xs)", display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            {shortKey(data.pool.address, 6)} {I.ext}
          </a>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 24 }}>
        <Stat label="SOL Price" value={`$${price.toFixed(2)}`} size="lg" />
        <Stat label="Active bin" value={String(data.activeBin.binId)} />
        <Stat label="Bin step" value={`${data.pool.binStep} bps`} />
        <Stat label="Base fee" value={`${Number(data.fees.base).toFixed(3)}%`} />
        <Stat label="Dynamic fee" value={`${Number(data.fees.dynamic).toFixed(3)}%`} />
        <Stat label="TVL" value={tvl ? fmtUsd(tvl, { compact: true }) : "—"} />
      </div>
    </div>
  );
}
