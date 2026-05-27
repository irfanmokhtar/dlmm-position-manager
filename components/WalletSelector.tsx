"use client";

import { useWallet } from "@/lib/wallet-context";

export function WalletSelector() {
  const { wallets, selected, setSelected } = useWallet();
  if (wallets.length === 0) return null;
  return (
    <select
      className="input"
      style={{ width: "auto" }}
      value={selected}
      onChange={(e) => setSelected(e.target.value)}
      title="Active wallet"
    >
      {wallets.map((w) => (
        <option key={w.pubkey} value={w.pubkey}>
          {w.label}
        </option>
      ))}
    </select>
  );
}
