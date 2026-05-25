"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PositionChart } from "@/components/PositionChart";
import { AddLiquidityPanel } from "@/components/AddLiquidityPanel";
import { RemovePanel } from "@/components/RemovePanel";
import { ResizePanel } from "@/components/ResizePanel";
import { RebalancePanel } from "@/components/RebalancePanel";
import { WalletSelector } from "@/components/WalletSelector";
import { useWallet } from "@/lib/wallet-context";
import { PoolResponse, PositionsResponse, toUi } from "@/lib/types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json as T;
}

export default function PositionDetail() {
  const { id } = useParams<{ id: string }>();
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

  const position = positions?.positions.find((p) => p.publicKey === id);

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-black px-4 py-8 text-neutral-100">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-neutral-400 hover:text-neutral-200"
        >
          ← Positions
        </Link>
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
        </div>
      )}

      {!error && !loading && pool && positions && !position && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 text-sm text-neutral-400">
          <p className="font-semibold text-neutral-200">Position not found.</p>
          <p className="mt-1">
            <span className="font-mono text-xs">{id}</span> is not open for the
            selected wallet (it may have been closed, or belongs to another
            wallet).
          </p>
          <Link
            href="/"
            className="mt-3 inline-block text-neutral-300 underline hover:text-neutral-100"
          >
            ← Back to positions
          </Link>
        </div>
      )}

      {pool && positions && position && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="font-mono text-xl font-bold">
              {position.publicKey.slice(0, 6)}…{position.publicKey.slice(-6)}
            </h1>
            <div className="text-sm text-neutral-400">
              bins {position.lowerBinId}–{position.upperBinId} (
              {position.upperBinId - position.lowerBinId + 1})
              {positions.activeBinId >= position.lowerBinId &&
              positions.activeBinId <= position.upperBinId ? (
                <span className="ml-2 text-emerald-400">in range</span>
              ) : (
                <span className="ml-2 text-amber-400">out of range</span>
              )}
              <span className="ml-3 tabular-nums">
                {toUi(position.totalXAmount, pool.pool.tokenX.decimals).toFixed(
                  4,
                )}{" "}
                SOL /{" "}
                {toUi(position.totalYAmount, pool.pool.tokenY.decimals).toFixed(
                  2,
                )}{" "}
                USDC
              </span>
            </div>
          </div>

          <PositionChart
            pool={pool}
            position={position}
            activeBinId={positions.activeBinId}
          />

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AddLiquidityPanel
              pool={pool}
              positions={[position]}
              lockedPosition={position}
              onDone={load}
            />
            <RemovePanel
              positions={[position]}
              lockedPosition={position}
              onDone={load}
            />
            <ResizePanel
              positions={[position]}
              lockedPosition={position}
              onDone={load}
            />
            <RebalancePanel
              positions={[position]}
              lockedPosition={position}
              onDone={load}
            />
          </section>
        </div>
      )}

      {loading && !position && (
        <div className="text-neutral-500">Loading position…</div>
      )}
    </main>
  );
}
