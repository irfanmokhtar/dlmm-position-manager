"use client";

import { useEffect, useState } from "react";
import { PositionInfo } from "@/lib/types";
import { ActionResponse, postJson } from "@/lib/client";
import { useWallet } from "@/lib/wallet-context";
import { ActionResult } from "./ActionResult";

const input =
  "w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm";
const label = "text-xs uppercase tracking-wide text-neutral-500";

export function ResizePanel({
  positions,
  onDone,
}: {
  positions: PositionInfo[];
  onDone: () => void;
}) {
  const { selected } = useWallet();
  const [target, setTarget] = useState(positions[0]?.publicKey ?? "");
  const [action, setAction] = useState<"increase" | "decrease">("increase");
  const [side, setSide] = useState<"Lower" | "Upper">("Upper");
  const [length, setLength] = useState(10);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ActionResponse | null>(null);
  const [previewOk, setPreviewOk] = useState(false);

  const pos = positions.find((p) => p.publicKey === target);
  const width = pos ? pos.upperBinId - pos.lowerBinId + 1 : 0;

  useEffect(() => {
    setPreviewOk(false);
    setRes(null);
  }, [target, action, side, length]);

  async function run(dryRun: boolean) {
    setBusy(true);
    setRes(null);
    try {
      const r = await postJson<ActionResponse>("/api/position/resize", {
        dryRun,
        wallet: selected || undefined,
        positionPubKey: target,
        action,
        side,
        length,
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
    const msg =
      action === "decrease"
        ? "Shrink position? Rent is refunded only on full close, not on shrink."
        : "Expand position? This pays rent for new bins.";
    if (confirm(msg)) run(false);
  }

  if (positions.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-500">
        No positions to resize.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <h3 className="mb-3 text-sm font-semibold">Resize width</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <span className={label}>Position {pos ? `(${width} bins)` : ""}</span>
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
          <span className={label}>Action</span>
          <select
            className={input}
            value={action}
            onChange={(e) => setAction(e.target.value as typeof action)}
          >
            <option value="increase">Increase (widen)</option>
            <option value="decrease">Decrease (narrow)</option>
          </select>
        </div>
        <div>
          <span className={label}>Side</span>
          <select
            className={input}
            value={side}
            onChange={(e) => setSide(e.target.value as typeof side)}
          >
            <option value="Upper">Upper (price up)</option>
            <option value="Lower">Lower (price down)</option>
          </select>
        </div>

        <div className="col-span-2">
          <span className={label}>Bins to {action === "increase" ? "add" : "remove"}</span>
          <input
            type="number"
            className={input}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
          />
        </div>
      </div>

      <p className="mt-2 text-xs text-neutral-500">
        Widening only changes the range. Seed the new bins with the Add panel.
        Decreasing does not refund rent until full close.
      </p>

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
          className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm hover:bg-sky-600 disabled:opacity-40"
        >
          Execute
        </button>
      </div>

      <ActionResult res={res} />
    </div>
  );
}
