"use client";

import { useEffect } from "react";
import { SwapPanel } from "@/components/SwapPanel";
import { I, TokenPair } from "./ui";

export function SwapModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="strata-scrim" onClick={onClose}>
      <div
        className="card"
        style={{ width: 420, maxWidth: "92vw", boxShadow: "var(--shadow-elev)", display: "flex", flexDirection: "column", gap: 14 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Swap</div>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>via Jupiter</span>
          </div>
          <button className="btn btn-icon btn-ghost btn-sm" aria-label="Close" onClick={onClose}>{I.close}</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <TokenPair />
        </div>
        <SwapPanel onDone={onDone} />
      </div>
    </div>
  );
}
