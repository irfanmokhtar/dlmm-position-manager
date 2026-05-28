"use client";

// Layout A — the exclusive, full-width position page. Reached from the rail's
// expand button (or a direct /positions/<pubkey> deep link). Unlike the rail's
// tabbed single-action view, every action panel is visible at once in a 2×2
// grid alongside a large liquidity chart and a per-bin breakdown.
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/strata/AppHeader";
import { SwapModal } from "@/components/strata/SwapModal";
import { PositionLiqChart, type ChartGesture, type ChartMode } from "@/components/strata/PositionLiqChart";
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

// Gesture toggles — armed one at a time; matches the four action panels.
const MODES: { key: Exclude<ChartMode, null>; label: string }[] = [
  { key: "add", label: "Add" },
  { key: "remove", label: "Remove" },
  { key: "resize", label: "Resize" },
  { key: "rebalance", label: "Rebalance" },
];
const MODE_HINTS: Record<Exclude<ChartMode, null>, string> = {
  add: "Drag the dashed slot endpoints to set the band to top up — release pre-fills Add.",
  remove: "Drag the red pips for the band · drag the % bar for amount — release pre-fills Remove.",
  resize: "Drag the LO / HI edges to widen or narrow — release pre-fills Resize.",
  rebalance: "Drag the grip to recenter (rebalances on the active bin) — release jumps to Rebalance.",
};

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

  // chart-gesture → panel pre-fill drafts (keyed so they apply once per drag)
  const draftKey = useRef(0);
  const [addDraft, setAddDraft] = useState<{ minBinId: number; maxBinId: number; key: number }>();
  const [removeDraft, setRemoveDraft] = useState<{ fromBinId: number; toBinId: number; bps: number; key: number }>();
  const [resizeDraft, setResizeDraft] = useState<{ side: "Lower" | "Upper"; action: "increase" | "decrease"; length: number; key: number }>();
  const [highlight, setHighlight] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>(null);

  const handleGesture = useCallback((g: ChartGesture) => {
    const key = draftKey.current + 1;
    draftKey.current = key;
    const panelId =
      g.type === "add" ? "add-panel" : g.type === "withdraw" ? "remove-panel" : g.type === "resize" ? "resize-panel" : "rebalance-panel";
    if (g.type === "add") setAddDraft({ minBinId: g.minBinId, maxBinId: g.maxBinId, key });
    else if (g.type === "withdraw") setRemoveDraft({ fromBinId: g.fromBinId, toBinId: g.toBinId, bps: g.bps, key });
    else if (g.type === "resize") setResizeDraft({ side: g.side, action: g.action, length: g.length, key });
    document.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlight(panelId);
    window.setTimeout(() => setHighlight((h) => (h === panelId ? null : h)), 1500);
  }, []);

  const ring = (id: string): React.CSSProperties =>
    highlight === id ? { outline: "2px solid var(--accent-1)", outlineOffset: 3, borderRadius: "var(--r-lg)" } : {};

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
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Position liquidity</div>
                    <div style={{ color: "var(--text-3)", fontSize: "var(--text-xs)", marginTop: 2, maxWidth: 460 }}>
                      {chartMode ? MODE_HINTS[chartMode] : "Arm an action to reveal its on-chart control."}
                    </div>
                  </div>
                  <div className="seg">
                    {MODES.map((m) => (
                      <button
                        key={m.key}
                        aria-pressed={chartMode === m.key}
                        onClick={() => setChartMode((cur) => (cur === m.key ? null : m.key))}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <PositionLiqChart
                  pool={pool}
                  position={position}
                  activeBinId={activeBinId}
                  width={760}
                  height={340}
                  interactive
                  mode={chartMode}
                  onGesture={handleGesture}
                  removeBand={removeDraft ? { lo: Math.min(removeDraft.fromBinId, removeDraft.toBinId), hi: Math.max(removeDraft.fromBinId, removeDraft.toBinId), pct: removeDraft.bps / 100 } : undefined}
                  addBand={addDraft ? { lo: Math.min(addDraft.minBinId, addDraft.maxBinId), hi: Math.max(addDraft.minBinId, addDraft.maxBinId) } : undefined}
                />
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

            {/* Action panels — all four visible at once. Chart gestures
                pre-fill the matching panel (highlighted briefly on release). */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap-card)", alignItems: "start" }}>
              <div id="add-panel" style={ring("add-panel")}>
                <AddLiquidityPanel pool={pool} {...panelBase} draft={addDraft} />
              </div>
              <div id="remove-panel" style={ring("remove-panel")}>
                <RemovePanel {...panelBase} draft={removeDraft} />
              </div>
              <div id="resize-panel" style={ring("resize-panel")}>
                <ResizePanel {...panelBase} draft={resizeDraft} />
              </div>
              <div id="rebalance-panel" style={ring("rebalance-panel")}>
                <RebalancePanel {...panelBase} />
              </div>
            </div>
          </>
        )}

        {!pool && !error && <div style={{ color: "var(--text-3)" }}>Loading position…</div>}
      </main>

      {swapOpen && <SwapModal onClose={() => setSwapOpen(false)} onDone={load} />}
    </div>
  );
}
