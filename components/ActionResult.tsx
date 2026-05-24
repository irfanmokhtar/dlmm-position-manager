"use client";

import { ActionResponse } from "@/lib/client";

export function ActionResult({ res }: { res: ActionResponse | null }) {
  if (!res) return null;

  if (res.dryRun && res.preview) {
    const p = res.preview;
    return (
      <div
        className={`mt-3 rounded-lg border p-3 text-xs ${
          p.ok
            ? "border-emerald-900 bg-emerald-950/40 text-emerald-300"
            : "border-red-900 bg-red-950/40 text-red-300"
        }`}
      >
        <p className="font-semibold">
          {p.ok ? "Simulation OK" : "Simulation failed"} · {p.txCount} tx
          {p.txCount === 1 ? "" : "s"}
          {p.unitsConsumed ? ` · ${p.unitsConsumed} CU` : ""}
        </p>
        {p.error && <p className="mt-1 font-mono">{p.error}</p>}
        {p.logs && p.logs.length > 0 && (
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[10px] text-neutral-400">
            {p.logs.join("\n")}
          </pre>
        )}
        {p.txCount > 1 && (
          <p className="mt-1 text-neutral-500">
            Only the first tx is simulated; later chunks depend on earlier ones
            landing.
          </p>
        )}
      </div>
    );
  }

  if (res.results) {
    return (
      <div
        className={`mt-3 rounded-lg border p-3 text-xs ${
          res.ok
            ? "border-emerald-900 bg-emerald-950/40 text-emerald-300"
            : "border-red-900 bg-red-950/40 text-red-300"
        }`}
      >
        <p className="font-semibold">{res.ok ? "Sent" : "Failed"}</p>
        <ul className="mt-1 space-y-0.5 font-mono">
          {res.results.map((r) => (
            <li key={r.index}>
              #{r.index} {r.ok ? "✓" : "✗"}{" "}
              {r.signature ? (
                <a
                  href={`https://solscan.io/tx/${r.signature}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {r.signature.slice(0, 8)}…
                </a>
              ) : (
                r.error
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return null;
}
