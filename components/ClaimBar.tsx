"use client";

import { useState } from "react";
import { ActionResponse, postJson } from "@/lib/client";
import { useWallet } from "@/lib/wallet-context";
import { ActionResult } from "./ActionResult";

export function ClaimBar({ onDone }: { onDone: () => void }) {
  const { selected } = useWallet();
  const [type, setType] = useState<"fees" | "all">("fees");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ActionResponse | null>(null);
  const [previewOk, setPreviewOk] = useState(false);

  async function run(dryRun: boolean) {
    setBusy(true);
    setRes(null);
    try {
      const r = await postJson<ActionResponse>("/api/claim", {
        type,
        dryRun,
        wallet: selected || undefined,
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

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <h3 className="mb-3 text-sm font-semibold">Claim</h3>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
          value={type}
          onChange={(e) => {
            setType(e.target.value as typeof type);
            setPreviewOk(false);
          }}
        >
          <option value="fees">Swap fees</option>
          <option value="all">Fees + LM rewards</option>
        </select>
        <button
          disabled={busy}
          onClick={() => run(true)}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-900 disabled:opacity-50"
        >
          {busy ? "…" : "Preview"}
        </button>
        <button
          disabled={busy || !previewOk}
          onClick={() => run(false)}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm hover:bg-emerald-600 disabled:opacity-40"
        >
          Claim
        </button>
      </div>
      <ActionResult res={res} />
    </div>
  );
}
