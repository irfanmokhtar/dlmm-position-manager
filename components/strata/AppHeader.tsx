"use client";

import { WalletSelector } from "@/components/WalletSelector";
import { useTheme } from "@/lib/theme-context";
import { INTERVAL_OPTIONS, useRefreshInterval } from "@/lib/refresh-context";
import { I, Logo } from "./ui";

export function AppHeader({
  onSwap,
  onRefresh,
  loading,
}: {
  onSwap: () => void;
  onRefresh: () => void;
  loading?: boolean;
}) {
  const { theme, toggle } = useTheme();
  const { intervalMs, setIntervalMs } = useRefreshInterval();
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 24px",
        borderBottom: "1px solid var(--border-1)",
        background: "var(--bg-0)",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <Logo subtitle="DLMM CONTROL" />
        <nav style={{ display: "flex", gap: 4 }}>
          <span className="seg">
            <button aria-pressed="true">Pool</button>
            <button>Positions</button>
            <button>Analytics</button>
          </span>
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "0 10px",
            height: "var(--ctrl-h)",
            border: "1px solid var(--border-1)",
            borderRadius: "var(--r-md)",
            fontSize: "var(--text-xs)",
            color: "var(--text-2)",
          }}
        >
          <span className="live-dot" /> Mainnet
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onSwap}>{I.swap} Swap</button>
        <WalletSelector />
        <select
          className="input"
          style={{ width: "auto" }}
          value={intervalMs}
          onChange={(e) => setIntervalMs(Number(e.target.value))}
          title="Auto-refresh interval"
          aria-label="Auto-refresh interval"
        >
          {INTERVAL_OPTIONS.map(([ms, label]) => (
            <option key={ms} value={ms}>
              {label}
            </option>
          ))}
        </select>
        <button className="btn btn-icon" aria-label="Refresh" onClick={onRefresh} disabled={loading}>
          {I.refresh}
        </button>
        <button className="btn btn-icon" aria-label="Toggle theme" onClick={toggle} title={theme === "dark" ? "Switch to light" : "Switch to dark"}>
          {theme === "dark" ? I.sun : I.moon}
        </button>
      </div>
    </header>
  );
}
