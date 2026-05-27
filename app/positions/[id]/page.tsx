"use client";

// Layout A — the exclusive, full-width position page. Reached from the rail's
// expand button (or a direct /positions/<pubkey> deep link). Unlike the rail's
// tabbed single-action view, every action panel is visible at once in a 2×2
// grid alongside a large liquidity chart and a per-bin breakdown.
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/strata/AppHeader";
import { SwapModal } from "@/components/strata/SwapModal";
import { PositionLiqChart } from "@/components/strata/PositionLiqChart";
import { PositionHeader } from "@/components/strata/PositionHeader";
import { PositionBinBreakdown } from "@/components/strata/PositionBinBreakdown";
import { AddLiquidityPanel } from "@/components/AddLiquidityPanel";
import { RemovePanel } from "@/components/RemovePanel";
import { ResizePanel } from "@/components/ResizePanel";
import { RebalancePanel } from "@/components/RebalancePanel";
import { useWallet } from "@/lib/wallet-context";
import { PoolResponse, PositionInfo, PositionsResponse, PositionPnL, PositionPnLResponse } from "@/lib/types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json as T;
}

export default function PositionPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { selected } = useWallet();

  const [pool, setPool] = useState<PoolResponse | null>(null);
  const [positions, setPositions] = useState<PositionsResponse | null>(null);
  const [pnl, setPnl] = useState<PositionPnL | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
      // PnL is best-effort — never block the page on the data API.
      fetchJson<PositionPnLResponse>("/api/position/pnl")
        .then((r) => setPnl(r.positions.find((x) => x.positionAddress === id) ?? null))
        .catch(() => setPnl(null));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selected, id]);

  useEffect(() => {
    load();
  }, [load]);

  const position: PositionInfo | null = positions?.positions.find((p) => p.publicKey === id) ?? null;
  const activeBinId = positions?.activeBinId ?? pool?.activeBin.binId ?? 0;
  const panelBase = position ? { positions: [position], lockedPosition: position, onDone: load } : null;

  return (
    <div className="strata" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-0)" }}>
      <AppHeader onSwap={() => setSwapOpen(true)} onRefresh={load} loading={loading} />

      <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: "var(--gap-card)" }}>
        {error && (
          <div className="card" style={{ borderColor: "color-mix(in oklab, var(--danger) 30%, transparent)", color: "var(--danger)" }}>
            <p style={{ fontWeight: 600, margin: 0 }}>Failed to load.</p>
            <p className="mono" style={{ marginTop: 4, fontSize: "var(--text-xs)" }}>{error}</p>
          </div>
        )}

        {!error && !loading && pool && positions && !position && (
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
            <p style={{ fontWeight: 600, margin: 0 }}>Position not found</p>
            <p style={{ margin: 0, color: "var(--text-3)", fontSize: "var(--text-sm)" }}>
              No position <span className="mono">{id}</span> for the selected wallet.
            </p>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push("/")}>← Back to dashboard</button>
          </div>
        )}

        {pool && position && panelBase && (
          <>
            <PositionHeader
              pool={pool}
              position={position}
              activeBinId={activeBinId}
              pnl={pnl}
              onBack={() => router.push("/")}
              onClosePosition={() => document.getElementById("remove-panel")?.scrollIntoView({ behavior: "smooth", block: "center" })}
            />

            {/* Centerpiece: big chart + per-bin breakdown */}
            <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: "var(--gap-card)", alignItems: "start" }}>
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Position liquidity</div>
                  <div style={{ color: "var(--text-3)", fontSize: "var(--text-xs)", marginTop: 2 }}>
                    Bins {position.lowerBinId}–{position.upperBinId} · with surrounding pool context
                  </div>
                </div>
                <PositionLiqChart pool={pool} position={position} activeBinId={activeBinId} width={760} height={340} />
                <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", fontSize: "var(--text-xs)", color: "var(--text-3)", paddingTop: 8, borderTop: "1px solid var(--border-1)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--token-x)" }} />
                    SOL · bins above active
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--token-y)" }} />
                    USDC · bins below active
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: "linear-gradient(to bottom, var(--token-x) 50%, var(--token-y) 50%)" }} />
                    active bin · mixed
                  </span>
                  <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--token-x)", opacity: 0.28 }} />
                    outside your range
                  </span>
                </div>
              </div>
              <PositionBinBreakdown pool={pool} position={position} activeBinId={activeBinId} />
            </div>

            {/* Action panels — all four visible at once */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap-card)", alignItems: "start" }}>
              <AddLiquidityPanel pool={pool} {...panelBase} />
              <div id="remove-panel">
                <RemovePanel {...panelBase} />
              </div>
              <ResizePanel {...panelBase} />
              <RebalancePanel {...panelBase} />
            </div>
          </>
        )}

        {!pool && !error && <div style={{ color: "var(--text-3)" }}>Loading position…</div>}
      </main>

      {swapOpen && <SwapModal onClose={() => setSwapOpen(false)} onDone={load} />}
    </div>
  );
}
