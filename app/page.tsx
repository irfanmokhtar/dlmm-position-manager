"use client";

import { useCallback, useEffect, useState } from "react";
import { PoolHeader } from "@/components/PoolHeader";
import { BinChart } from "@/components/BinChart";
import { PositionTable } from "@/components/PositionTable";
import { AddLiquidityPanel } from "@/components/AddLiquidityPanel";
import { ClaimBar } from "@/components/ClaimBar";
import { SwapPanel } from "@/components/SwapPanel";
import { WalletSelector } from "@/components/WalletSelector";
import { useWallet } from "@/lib/wallet-context";
import { PoolResponse, PositionsResponse } from "@/lib/types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json as T;
}

export default function Dashboard() {
  const { selected } = useWallet();
  const [pool, setPool] = useState<PoolResponse | null>(null);
  const [positions, setPositions] = useState<PositionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const posUrl = selected
        ? `/api/positions?wallet=${selected}`
        : "/api/positions";
      const [p, pos] = await Promise.all([
        fetchJson<PoolResponse>("/api/pool"),
        fetchJson<PositionsResponse>(posUrl),
      ]);
      setPool(p);
      setPositions(pos);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-black px-4 py-8 text-neutral-100">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">DLMM Position Manager</h1>
        <div className="flex items-center gap-2">
          <WalletSelector />
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-900 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-900 bg-red-950/50 p-4 text-sm text-red-300">
          <p className="font-semibold">Failed to load.</p>
          <p className="mt-1 font-mono text-xs">{error}</p>
          <p className="mt-2 text-red-400/80">
            Check that <code>RPC_URL</code> and <code>WALLETS</code> (or legacy{" "}
            <code>WALLET_SECRET</code>) are set in <code>.env.local</code>.
          </p>
        </div>
      )}

      {pool && (
        <div className="flex flex-col gap-6">
          <PoolHeader data={pool} />
          <BinChart pool={pool} positions={positions ?? undefined} />

          {positions && <PositionTable pool={pool} data={positions} />}

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SwapPanel onDone={load} />
            <ClaimBar onDone={load} />
            <AddLiquidityPanel
              pool={pool}
              positions={positions?.positions ?? []}
              onDone={load}
            />
          </section>
        </div>
      )}

      {!pool && !error && <div className="text-neutral-500">Loading pool…</div>}
    </main>
  );
}
