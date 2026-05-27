"use client";

import { useState } from "react";
import { ActionResponse, postJson } from "@/lib/client";
import { useWallet } from "@/lib/wallet-context";
import { I, sx } from "@/components/strata/ui";
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
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <select
        className={sx.inputText}
        value={type}
        onChange={(e) => {
          setType(e.target.value as typeof type);
          setPreviewOk(false);
        }}
      >
        <option value="fees">Swap fees</option>
        <option value="all">Fees + LM rewards</option>
      </select>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={busy} onClick={() => run(true)}>
          {busy ? "…" : "Preview"}
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy || !previewOk} onClick={() => run(false)}>
          {I.bolt} Claim all
        </button>
      </div>
      <ActionResult res={res} />
    </div>
  );
}
