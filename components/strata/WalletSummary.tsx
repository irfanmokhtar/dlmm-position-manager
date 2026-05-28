"use client";

import { PoolResponse, PositionsResponse, toUi } from "@/lib/types";
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

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div className="label" style={{ marginBottom: 4 }}>Wallet · {label}</div>
        {owner && <div className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>{shortKey(owner, 6)}</div>}
      </div>
      <div className="divider" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Stat label="Position value" value={fmtUsd(totalLiq, { dec: 0 })} />
        <Stat label="Unclaimed" value={fmtUsd(totalFees, { dec: 2 })} accent="var(--success)" />
      </div>
      <div className="divider" />
      <ClaimBar onDone={onDone} />
    </div>
  );
}
