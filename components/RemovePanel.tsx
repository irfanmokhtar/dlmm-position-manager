"use client";

import { useEffect, useState } from "react";
import { PositionInfo } from "@/lib/types";
import { ActionResponse, postJson } from "@/lib/client";
import { useWallet } from "@/lib/wallet-context";
import { ActionResult } from "./ActionResult";

const input =
  "w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm";
const label = "text-xs uppercase tracking-wide text-neutral-500";

export function RemovePanel({
  positions,
  onDone,
}: {
  positions: PositionInfo[];
  onDone: () => void;
}) {
  const { selected } = useWallet();
  const [target, setTarget] = useState(positions[0]?.publicKey ?? "");
  const [fromBinId, setFromBinId] = useState(0);
  const [toBinId, setToBinId] = useState(0);
  const [bps, setBps] = useState(10000);
  const [claimClose, setClaimClose] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ActionResponse | null>(null);
  const [previewOk, setPreviewOk] = useState(false);

  useEffect(() => {
    const p = positions.find((x) => x.publicKey === target);
    if (p) {
      setFromBinId(p.lowerBinId);
      setToBinId(p.upperBinId);
    }
    setPreviewOk(false);
    setRes(null);
  }, [target, positions]);

  async function run(dryRun: boolean) {
    setBusy(true);
    setRes(null);
    try {
      const r = await postJson<ActionResponse>("/api/liquidity/remove", {
        dryRun,
        wallet: selected || undefined,
        positionPubKey: target,
        fromBinId,
        toBinId,
        bps,
        shouldClaimAndClose: claimClose,
      });
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
    if (confirm("Send real transaction(s)? This withdraws liquidity."))
      run(false);
  }

  if (positions.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-500">
        No positions to remove from.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <h3 className="mb-3 text-sm font-semibold">Remove liquidity</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <span className={label}>Position</span>
          <select
            className={input}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            {positions.map((p) => (
              <option key={p.publicKey} value={p.publicKey}>
                {p.publicKey.slice(0, 6)}… ({p.lowerBinId}–{p.upperBinId})
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className={label}>From bin</span>
          <input
            type="number"
            className={input}
            value={fromBinId}
            onChange={(e) => setFromBinId(Number(e.target.value))}
          />
        </div>
        <div>
          <span className={label}>To bin</span>
          <input
            type="number"
            className={input}
            value={toBinId}
            onChange={(e) => setToBinId(Number(e.target.value))}
          />
        </div>

        <div className="col-span-2">
          <span className={label}>Amount: {(bps / 100).toFixed(0)}%</span>
          <input
            type="range"
            min={1}
            max={10000}
            value={bps}
            onChange={(e) => setBps(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <label className="col-span-2 flex items-center gap-2 text-xs text-neutral-400">
          <input
            type="checkbox"
            checked={claimClose}
            onChange={(e) => setClaimClose(e.target.checked)}
          />
          Claim fees & close position if fully emptied
        </label>
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
          className="rounded-lg bg-red-700 px-3 py-1.5 text-sm hover:bg-red-600 disabled:opacity-40"
        >
          Execute
        </button>
      </div>

      <ActionResult res={res} />
    </div>
  );
}
