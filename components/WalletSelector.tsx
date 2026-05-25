"use client";

import { useWallet } from "@/lib/wallet-context";

export function WalletSelector() {
  const { wallets, selected, setSelected } = useWallet();
  if (wallets.length === 0) return null;
  return (
    <select
      className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
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
