"use client";

import { useEffect, useState } from "react";
import { PoolResponse, PositionsResponse, toUi, type WalletTotalClaimsResponse } from "@/lib/types";
import { useWallet } from "@/lib/wallet-context";
import { ClaimBar } from "@/components/ClaimBar";
import { Stat, fmtUsd, shortKey } from "./ui";

export function WalletSummary({
  pool,
  positions,
  onDone,
}: {
  pool: PoolResponse;
  positions: PositionsResponse | null;
  onDone: () => void;
}) {
  const { selected, wallets } = useWallet();
  const label = wallets.find((w) => w.pubkey === selected)?.label ?? "Wallet";
  const owner = positions?.owner ?? selected;

  const dx = pool.pool.tokenX.decimals;
  const dy = pool.pool.tokenY.decimals;
  const price = Number(pool.activeBin.pricePerToken);

  let totalLiq = 0;
  let totalFees = 0;
  for (const p of positions?.positions ?? []) {
    totalLiq += toUi(p.totalXAmount, dx) * price + toUi(p.totalYAmount, dy);
    totalFees += toUi(p.feeX, dx) * price + toUi(p.feeY, dy);
  }

  const [claims, setClaims] = useState<WalletTotalClaimsResponse | null>(null);
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    fetch(`/api/wallet/total-claims?wallet=${selected}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled) setClaims(j as WalletTotalClaimsResponse | null);
      })
      .catch(() => {
        if (!cancelled) setClaims(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const claimsUsd = claims ? Number(claims.totalClaimsUsd) : 0;
  const claimsCount = claims ? claims.feeClaimCount + claims.rewardClaimCount : 0;

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div className="label" style={{ marginBottom: 4 }}>Wallet · {label}</div>
        {owner && <div className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>{shortKey(owner, 6)}</div>}
      </div>
      <div className="divider" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <Stat label="Position value" value={fmtUsd(totalLiq, { dec: 0 })} />
        <Stat label="Unclaimed" value={fmtUsd(totalFees, { dec: 2 })} accent="var(--success)" />
        <Stat
          label="Total claimed"
          value={fmtUsd(claimsUsd, { dec: 0 })}
          sub={claims ? `${claimsCount} claims` : "—"}
        />
      </div>
      <div className="divider" />
      <ClaimBar onDone={onDone} />
    </div>
  );
}
