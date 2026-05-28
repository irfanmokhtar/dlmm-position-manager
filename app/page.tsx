"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/strata/AppHeader";
import { PoolHeader } from "@/components/PoolHeader";
import { BinChart } from "@/components/BinChart";
import { PositionTable } from "@/components/PositionTable";
import { WalletSummary } from "@/components/strata/WalletSummary";
import { PositionRail } from "@/components/strata/PositionRail";
import { SwapModal } from "@/components/strata/SwapModal";
import { useWallet } from "@/lib/wallet-context";
import { PoolResponse, PositionInfo, PositionsResponse } from "@/lib/types";

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

  // right-rail state — Layout B: position detail opens in place, no route change
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const posUrl = selected ? `/api/positions?wallet=${selected}` : "/api/positions";
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

  // deep-link: /?pos=<pubkey> opens that position's rail
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("pos");
    if (id) setSelectedId(id);
  }, []);

  const selectedPosition: PositionInfo | null =
    (selectedId && positions?.positions.find((p) => p.publicKey === selectedId)) || null;
  const railOpen = createMode || Boolean(selectedPosition);

  function openPosition(p: PositionInfo) {
    setCreateMode(false);
    setSelectedId(p.publicKey);
  }
  function openNew() {
    setSelectedId(null);
    setCreateMode(true);
  }
  function closeRail() {
    setSelectedId(null);
    setCreateMode(false);
  }

  return (
    <div className="strata" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-0)" }}>
      <AppHeader onSwap={() => setSwapOpen(true)} onRefresh={load} loading={loading} />

      <div style={{ display: "flex", flex: 1, alignItems: "flex-start", minHeight: 0 }}>
        <main style={{ flex: 1, minWidth: 0, padding: 20, display: "flex", flexDirection: "column", gap: "var(--gap-card)" }}>
          {error && (
            <div
              className="card"
              style={{ borderColor: "color-mix(in oklab, var(--danger) 30%, transparent)", color: "var(--danger)" }}
            >
              <p style={{ fontWeight: 600, margin: 0 }}>Failed to load.</p>
              <p className="mono" style={{ marginTop: 4, fontSize: "var(--text-xs)" }}>{error}</p>
              <p style={{ marginTop: 8, color: "var(--text-3)", fontSize: "var(--text-xs)" }}>
                Check that <code>RPC_URL</code> and <code>WALLETS</code> (or legacy <code>WALLET_SECRET</code>) are set in
                <code> .env.local</code>.
              </p>
            </div>
          )}

          {pool && (
            <>
              <PoolHeader data={pool} />
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: "var(--gap-card)", alignItems: "start" }}>
                <BinChart pool={pool} positions={positions ?? undefined} />
                <WalletSummary pool={pool} positions={positions} onDone={load} />
              </div>
              {positions && (
                <PositionTable
                  pool={pool}
                  data={positions}
                  selectedId={selectedPosition?.publicKey}
                  onOpen={openPosition}
                  onNew={openNew}
                />
              )}
            </>
          )}

          {!pool && !error && <div style={{ color: "var(--text-3)" }}>Loading pool…</div>}
        </main>

        {pool && positions && railOpen && (
          <PositionRail
            pool={pool}
            positions={positions}
            selected={selectedPosition}
            createMode={createMode}
            onClose={closeRail}
            onDone={load}
          />
        )}
      </div>

      {swapOpen && <SwapModal onClose={() => setSwapOpen(false)} onDone={load} />}
    </div>
  );
}
