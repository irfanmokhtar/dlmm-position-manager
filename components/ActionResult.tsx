"use client";

import { ActionResponse } from "@/lib/client";

function box(ok: boolean): React.CSSProperties {
  const c = ok ? "var(--success)" : "var(--danger)";
  return {
    marginTop: 4,
    borderRadius: 8,
    padding: 12,
    fontSize: "var(--text-xs)",
    color: c,
    background: `color-mix(in oklab, ${c} 10%, transparent)`,
    border: `1px solid color-mix(in oklab, ${c} 30%, transparent)`,
  };
}

export function ActionResult({ res }: { res: ActionResponse | null }) {
  if (!res) return null;

  if (res.dryRun && res.preview) {
    const p = res.preview;
    return (
      <div style={box(p.ok)}>
        <p style={{ fontWeight: 600, margin: 0 }}>
          {p.ok ? "Simulation OK" : "Simulation failed"} · {p.txCount} tx{p.txCount === 1 ? "" : "s"}
          {p.unitsConsumed ? ` · ${p.unitsConsumed} CU` : ""}
        </p>
        {p.error && <p className="mono" style={{ marginTop: 4 }}>{p.error}</p>}
        {p.logs && p.logs.length > 0 && (
          <pre style={{ marginTop: 8, maxHeight: 160, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: 10, color: "var(--text-3)" }}>
            {p.logs.join("\n")}
          </pre>
        )}
        {p.txCount > 1 && (
          <p style={{ marginTop: 4, color: "var(--text-3)" }}>
            Only the first tx is simulated; later chunks depend on earlier ones landing.
          </p>
        )}
      </div>
    );
  }

  if (res.results) {
    return (
      <div style={box(Boolean(res.ok))}>
        <p style={{ fontWeight: 600, margin: 0 }}>{res.ok ? "Sent" : "Failed"}</p>
        <ul className="mono" style={{ marginTop: 4, paddingLeft: 16 }}>
          {res.results.map((r) => (
            <li key={r.index} style={{ marginBottom: 6 }}>
              #{r.index} {r.ok ? "✓" : "✗"}{" "}
              {r.signature ? (
                <a href={`https://solscan.io/tx/${r.signature}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                  {r.signature.slice(0, 8)}…
                </a>
              ) : null}
              {r.error && <span style={{ color: "var(--danger)", marginLeft: 4 }}>{r.error}</span>}
              {r.logs && r.logs.length > 0 && (
                <pre style={{ marginTop: 4, maxHeight: 160, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: 10, color: "var(--text-3)" }}>
                  {r.logs.join("\n")}
                </pre>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return null;
}
