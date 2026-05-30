"use client";

import { useEffect, useState } from "react";
import { PoolResponse, PositionInfo } from "@/lib/types";
import { ActionResponse, postJson } from "@/lib/client";
import { useWallet } from "@/lib/wallet-context";
import { priceToBinId } from "@/lib/binmath";
import { MAX_POSITION_BINS, TOKENS, SOL_RESERVE_LAMPORTS } from "@/lib/constants";
import { I, PanelCard, Seg, Field, PctButtons, BalLabel, sx } from "@/components/strata/ui";
import { ActionResult } from "./ActionResult";

const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } as const;

export function AddLiquidityPanel({
  pool,
  positions,
  onDone,
  lockedPosition,
  draft,
}: {
  pool: PoolResponse;
  positions: PositionInfo[];
  onDone: () => void;
  lockedPosition?: PositionInfo;
  // chart-driven pre-fill: a new `key` applies the range (the "add band" gesture)
  draft?: { minBinId: number; maxBinId: number; key: number };
}) {
  const { selected, balances } = useWallet();
  const active = pool.activeBin.binId;
  const activePrice = Number(pool.activeBin.pricePerToken);
  const binStep = pool.pool.binStep;
  const [target, setTarget] = useState(lockedPosition?.publicKey ?? ""); // "" = new position
  const [minBinId, setMinBinId] = useState(active - 10);
  const [maxBinId, setMaxBinId] = useState(active + 10);
  const [rangeMode, setRangeMode] = useState<"bins" | "price">("bins");
  const [minPrice, setMinPrice] = useState((activePrice * 0.98).toFixed(4));
  const [maxPrice, setMaxPrice] = useState((activePrice * 1.02).toFixed(4));
  const [xAmount, setXAmount] = useState("0");
  const [yAmount, setYAmount] = useState("0");
  const [mode, setMode] = useState<"preset" | "blend">("preset");
  const [kind, setKind] = useState<"Spot" | "Curve" | "BidAsk">("Spot");
  const [weights, setWeights] = useState({ spot: 50, curve: 0, bidask: 50 });
  const [slippage, setSlippage] = useState("1");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ActionResponse | null>(null);
  const [previewOk, setPreviewOk] = useState(false);

  useEffect(() => {
    if (target) {
      const p = positions.find((x) => x.publicKey === target);
      if (p) {
        setMinBinId(p.lowerBinId);
        setMaxBinId(p.upperBinId);
      }
    } else {
      setMinBinId(active - 10);
      setMaxBinId(active + 10);
    }
    setPreviewOk(false);
    setRes(null);
  }, [target, positions, active]);

  // > 70 bins must use a preset (extended-position deposit endpoint takes no blend)
  useEffect(() => {
    if (maxBinId - minBinId + 1 > 70) setMode("preset");
  }, [minBinId, maxBinId]);

  // apply a chart "add band" gesture (keyed so it never clobbers later edits)
  useEffect(() => {
    if (!draft) return;
    setRangeMode("bins");
    setMinBinId(draft.minBinId);
    setMaxBinId(draft.maxBinId);
    setPreviewOk(false);
    setRes(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.key]);

  function applyPriceRange(lo: string, hi: string) {
    const a = priceToBinId(Number(lo), active, activePrice, binStep, "floor");
    const b = priceToBinId(Number(hi), active, activePrice, binStep, "ceil");
    setMinBinId(Math.min(a, b));
    setMaxBinId(Math.max(a, b));
  }

  function pctPreset(pct: number) {
    const lo = (activePrice * (1 - pct)).toFixed(4);
    const hi = (activePrice * (1 + pct)).toFixed(4);
    setMinPrice(lo);
    setMaxPrice(hi);
    applyPriceRange(lo, hi);
  }

  function payload(dryRun: boolean) {
    return {
      dryRun,
      wallet: selected || undefined,
      positionPubKey: target || undefined,
      minBinId,
      maxBinId,
      xAmount,
      yAmount,
      slippage: Number(slippage) || undefined,
      strategy: mode === "preset" ? { type: "preset", kind } : { type: "blend", weights },
    };
  }

  async function run(dryRun: boolean) {
    setBusy(true);
    setRes(null);
    try {
      const r = await postJson<ActionResponse>("/api/liquidity/add", payload(dryRun));
      setRes(r);
      if (dryRun) setPreviewOk(Boolean(r.preview?.ok));
      else {
        setPreviewOk(false);
        if (r.ok) onDone();
      }
    } catch (e) {
      setRes({ dryRun, preview: { txCount: 0, ok: false, error: String(e) } });
    } finally {
      setBusy(false);
    }
  }

  function execute() {
    if (confirm("Send real transaction(s)? This moves funds from your wallet into the pool.")) run(false);
  }

  const binCount = maxBinId - minBinId + 1;
  const tooWide = binCount > MAX_POSITION_BINS;

  return (
    <PanelCard icon={I.plus} title="Add liquidity" accent="var(--accent-1)">
      {!lockedPosition && (
        <div>
          <div className={sx.label} style={{ marginBottom: 6 }}>Target</div>
          <select className={sx.inputText} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">＋ New position</option>
            {positions.map((p) => (
              <option key={p.publicKey} value={p.publicKey}>
                {p.publicKey.slice(0, 6)}… ({p.lowerBinId}–{p.upperBinId})
              </option>
            ))}
          </select>
        </div>
      )}

      <Seg
        value={rangeMode}
        options={[["bins", "By bins"], ["price", "By price"]]}
        onChange={(v) => {
          setRangeMode(v);
          if (v === "price") applyPriceRange(minPrice, maxPrice);
        }}
      />

      {rangeMode === "bins" ? (
        <div style={grid2}>
          <Field label="Min bin" value={minBinId} type="number" onChange={(v) => setMinBinId(Number(v))} />
          <Field label={`Max bin (active ${active})`} value={maxBinId} type="number" onChange={(v) => setMaxBinId(Number(v))} />
        </div>
      ) : (
        <>
          <div style={grid2}>
            <Field
              label={`Min price (active $${activePrice.toFixed(4)})`}
              value={minPrice}
              onChange={(v) => {
                setMinPrice(v);
                applyPriceRange(v, maxPrice);
              }}
            />
            <Field
              label="Max price"
              value={maxPrice}
              onChange={(v) => {
                setMaxPrice(v);
                applyPriceRange(minPrice, v);
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
            {[0.01, 0.02, 0.05].map((p) => (
              <button key={p} className="btn btn-sm btn-ghost" onClick={() => pctPreset(p)}>
                ±{p * 100}%
              </button>
            ))}
            <span style={{ marginLeft: "auto" }}>→ bins {minBinId}–{maxBinId}</span>
          </div>
        </>
      )}

      <div style={grid2}>
        <div>
          <Field
            label={<span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>SOL amount <BalLabel balanceRaw={balances?.sol ?? null} decimals={TOKENS.SOL.decimals} symbol="SOL" /></span>}
            value={xAmount}
            suffix="SOL"
            onChange={setXAmount}
          />
          <PctButtons balanceRaw={balances?.sol ?? null} decimals={TOKENS.SOL.decimals} reserveRaw={SOL_RESERVE_LAMPORTS} onPick={setXAmount} />
        </div>
        <div>
          <Field
            label={<span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>USDC amount <BalLabel balanceRaw={balances?.usdc ?? null} decimals={TOKENS.USDC.decimals} symbol="USDC" /></span>}
            value={yAmount}
            suffix="USDC"
            onChange={setYAmount}
          />
          <PctButtons balanceRaw={balances?.usdc ?? null} decimals={TOKENS.USDC.decimals} onPick={setYAmount} />
        </div>
      </div>

      <Seg
        value={mode}
        options={[["preset", "Preset"], ["blend", "Custom blend"]]}
        onChange={setMode}
        disabledValues={binCount > 70 ? ["blend"] : []}
      />

      {mode === "preset" ? (
        <div>
          <div className={sx.label} style={{ marginBottom: 6 }}>Strategy</div>
          <select className={sx.inputText} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="Spot">Spot (uniform)</option>
            <option value="Curve">Curve (bell)</option>
            <option value="BidAsk">BidAsk (edges)</option>
          </select>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {(["spot", "curve", "bidask"] as const).map((k) => (
            <Field key={k} label={`${k} wt`} value={weights[k]} type="number" onChange={(v) => setWeights({ ...weights, [k]: Number(v) })} />
          ))}
        </div>
      )}

      <div style={grid2}>
        <Field label="Slippage %" value={slippage} onChange={setSlippage} />
        <div style={{ display: "flex", alignItems: "flex-end", fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
          {binCount} bins
          {tooWide ? (
            <span style={{ marginLeft: 4, color: "var(--danger)" }}>(max {MAX_POSITION_BINS})</span>
          ) : binCount > 70 ? (
            <span style={{ marginLeft: 4, color: "var(--warn)" }}>extended · preset only</span>
          ) : null}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={busy || tooWide} onClick={() => run(true)}>
          {busy ? "…" : "Preview"}
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy || !previewOk || tooWide} onClick={execute}>
          {I.plus} Add
        </button>
      </div>

      <ActionResult res={res} />
    </PanelCard>
  );
}
