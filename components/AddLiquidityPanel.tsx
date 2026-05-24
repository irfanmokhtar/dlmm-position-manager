"use client";

import { useEffect, useState } from "react";
import { PoolResponse, PositionInfo } from "@/lib/types";
import { ActionResponse, postJson } from "@/lib/client";
import { ActionResult } from "./ActionResult";

const input =
  "w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm";
const label = "text-xs uppercase tracking-wide text-neutral-500";

export function AddLiquidityPanel({
  pool,
  positions,
  onDone,
}: {
  pool: PoolResponse;
  positions: PositionInfo[];
  onDone: () => void;
}) {
  const active = pool.activeBin.binId;
  const [target, setTarget] = useState(""); // "" = new position
  const [minBinId, setMinBinId] = useState(active - 10);
  const [maxBinId, setMaxBinId] = useState(active + 10);
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

  function payload(dryRun: boolean) {
    return {
      dryRun,
      positionPubKey: target || undefined,
      minBinId,
      maxBinId,
      xAmount,
      yAmount,
      slippage: Number(slippage) || undefined,
      strategy:
        mode === "preset"
          ? { type: "preset", kind }
          : { type: "blend", weights },
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
    if (
      confirm(
        "Send real transaction(s)? This moves funds from your wallet into the pool.",
      )
    )
      run(false);
  }

  const binCount = maxBinId - minBinId + 1;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <h3 className="mb-3 text-sm font-semibold">Add liquidity</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <span className={label}>Target</span>
          <select
            className={input}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">＋ New position</option>
            {positions.map((p) => (
              <option key={p.publicKey} value={p.publicKey}>
                {p.publicKey.slice(0, 6)}… ({p.lowerBinId}–{p.upperBinId})
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className={label}>Min bin</span>
          <input
            type="number"
            className={input}
            value={minBinId}
            onChange={(e) => setMinBinId(Number(e.target.value))}
          />
        </div>
        <div>
          <span className={label}>Max bin (active {active})</span>
          <input
            type="number"
            className={input}
            value={maxBinId}
            onChange={(e) => setMaxBinId(Number(e.target.value))}
          />
        </div>

        <div>
          <span className={label}>SOL amount</span>
          <input
            className={input}
            value={xAmount}
            onChange={(e) => setXAmount(e.target.value)}
          />
        </div>
        <div>
          <span className={label}>USDC amount</span>
          <input
            className={input}
            value={yAmount}
            onChange={(e) => setYAmount(e.target.value)}
          />
        </div>

        <div className="col-span-2 flex gap-2">
          <button
            className={`rounded px-2 py-1 text-xs ${mode === "preset" ? "bg-neutral-700" : "bg-neutral-900"}`}
            onClick={() => setMode("preset")}
          >
            Preset
          </button>
          <button
            className={`rounded px-2 py-1 text-xs ${mode === "blend" ? "bg-neutral-700" : "bg-neutral-900"}`}
            onClick={() => setMode("blend")}
          >
            Custom blend
          </button>
        </div>

        {mode === "preset" ? (
          <div className="col-span-2">
            <span className={label}>Strategy</span>
            <select
              className={input}
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="Spot">Spot (uniform)</option>
              <option value="Curve">Curve (bell)</option>
              <option value="BidAsk">BidAsk (edges)</option>
            </select>
          </div>
        ) : (
          <div className="col-span-2 grid grid-cols-3 gap-2">
            {(["spot", "curve", "bidask"] as const).map((k) => (
              <div key={k}>
                <span className={label}>{k} wt</span>
                <input
                  type="number"
                  className={input}
                  value={weights[k]}
                  onChange={(e) =>
                    setWeights({ ...weights, [k]: Number(e.target.value) })
                  }
                />
              </div>
            ))}
          </div>
        )}

        <div>
          <span className={label}>Slippage %</span>
          <input
            className={input}
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
          />
        </div>
        <div className="flex items-end text-xs text-neutral-500">
          {binCount} bins {binCount > 70 && <span className="ml-1 text-amber-400">(max 70)</span>}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          disabled={busy}
          onClick={() => run(true)}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-900 disabled:opacity-50"
        >
          {busy ? "…" : "Preview"}
        </button>
        <button
          disabled={busy || !previewOk}
          onClick={execute}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm hover:bg-emerald-600 disabled:opacity-40"
        >
          Execute
        </button>
      </div>

      <ActionResult res={res} />
    </div>
  );
}
