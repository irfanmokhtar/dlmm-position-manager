"use client";

// STRATA shared design-system primitives, ported from the design handoff bundle
// (components.jsx). Presentational only — no data fetching.
import type { ReactNode } from "react";

// ── ICONS ────────────────────────────────────────────────────────────────
function Icon({
  d,
  size = 14,
  sw = 1.6,
  fill,
  stroke = "currentColor",
}: {
  d: string | ReactNode;
  size?: number;
  sw?: number;
  fill?: string;
  stroke?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill || "none"}
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "none", display: "block" }}
    >
      {typeof d === "string" ? <path d={d} /> : d}
    </svg>
  );
}

export const I = {
  refresh: <Icon d="M21 12a9 9 0 1 1-3.5-7.1M21 4v5h-5" />,
  plus: <Icon d="M12 5v14M5 12h14" />,
  minus: <Icon d="M5 12h14" />,
  arrowL: <Icon d="M19 12H5M11 18l-6-6 6-6" />,
  swap: <Icon d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" />,
  wallet: <Icon d="M3 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 0V6a2 2 0 0 1 2-2h11M16 13h2" />,
  close: <Icon d="M6 6l12 12M18 6L6 18" />,
  copy: <Icon d="M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2Z M5 15V5a2 2 0 0 1 2-2h10" />,
  ext: <Icon d="M14 4h6v6M20 4l-9 9M9 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />,
  chevron: <Icon d="M6 9l6 6 6-6" />,
  chevR: <Icon d="M9 6l6 6-6 6" />,
  bolt: <Icon d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  more: <Icon d="M12 6h.01M12 12h.01M12 18h.01" sw={3} />,
  warn: <Icon d="M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />,
  check: <Icon d="M20 6 9 17l-5-5" />,
  range: <Icon d="M4 12h16M7 8l-3 4 3 4M17 8l3 4-3 4" />,
  search: <Icon d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM21 21l-4.3-4.3" />,
  layers: <Icon d="m12 2 10 6-10 6L2 8l10-6ZM2 16l10 6 10-6M2 12l10 6 10-6" />,
  target: <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />,
  expand: <Icon d="M4 9V4h5M15 4h5v5M4 15v5h5M20 15v5h-5" />,
  sun: <Icon d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />,
  moon: <Icon d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
};

// ── BRAND ────────────────────────────────────────────────────────────────
export function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width={22} height={22} viewBox="0 0 24 24" style={{ flex: "none" }}>
        <defs>
          <linearGradient id="strata-g" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--accent-1)" />
            <stop offset="1" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <rect x="2" y="14" width="20" height="3" rx="1" fill="url(#strata-g)" opacity="0.45" />
        <rect x="4" y="9" width="16" height="3" rx="1" fill="url(#strata-g)" opacity="0.7" />
        <rect x="7" y="4" width="10" height="3" rx="1" fill="url(#strata-g)" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.16em" }}>STRATA</span>
        {subtitle && (
          <span style={{ fontSize: 9.5, color: "var(--text-3)", letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 2 }}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

// ── TOKEN CHIPS ──────────────────────────────────────────────────────────
export function TokenMark({ sym }: { sym: "SOL" | "USDC" }) {
  const cls = sym === "SOL" ? "token-mark token-sol" : "token-mark token-usdc";
  return <span className={cls}>{sym === "SOL" ? "◎" : "$"}</span>;
}

export function TokenPair({ x = "SOL", y = "USDC" }: { x?: "SOL" | "USDC"; y?: "SOL" | "USDC" }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center" }}>
      <span style={{ position: "relative", display: "inline-flex" }}>
        <TokenMark sym={x} />
        <span style={{ marginLeft: -7 }}>
          <TokenMark sym={y} />
        </span>
      </span>
      <span style={{ marginLeft: 10, fontWeight: 600 }}>
        {x} <span style={{ color: "var(--text-3)" }}>/</span> {y}
      </span>
    </div>
  );
}

// ── STATS ────────────────────────────────────────────────────────────────
export function Stat({
  label,
  value,
  sub,
  accent,
  mono = true,
  size = "md",
  trend,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  mono?: boolean;
  size?: "md" | "lg";
  trend?: string;
}) {
  const valSize = size === "lg" ? "var(--text-stat-lg)" : "var(--text-stat)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>{label}</div>
      <div
        className={mono ? "mono num" : "num"}
        style={{ fontSize: valSize, fontWeight: 600, lineHeight: 1.1, color: accent || "var(--text-1)", letterSpacing: "-0.01em" }}
      >
        {value}
      </div>
      {(sub || trend) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
          {trend && <span style={{ color: trend.startsWith("+") ? "var(--success)" : "var(--danger)" }}>{trend}</span>}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  );
}

export function Pill({
  children,
  kind,
  dot,
}: {
  children: ReactNode;
  kind?: "in" | "out" | "accent";
  dot?: boolean | "pulse";
}) {
  const k =
    kind === "in" ? "pill pill-in" : kind === "out" ? "pill pill-out" : kind === "accent" ? "pill pill-accent" : "pill";
  return (
    <span className={k}>
      {dot && <span className={`dot ${dot === "pulse" ? "pulse" : ""}`} />}
      {children}
    </span>
  );
}

// ── shared helpers ─────────────────────────────────────────────────────────
export const shortKey = (k: string, n = 4) => `${k.slice(0, n)}…${k.slice(-n)}`;

export function fmtUsd(v: number, opts: { dec?: number; compact?: boolean } = {}): string {
  const { dec = 0, compact = false } = opts;
  if (compact && v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (compact && v >= 1e3) return `$${(v / 1e3).toFixed(1)}k`;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}

// shared class strings used by the action panels so they all share one look
export const sx = {
  input: "input mono num",
  inputText: "input",
  label: "label",
};

// ── PANEL SCAFFOLDING ──────────────────────────────────────────────────────
export function PanelCard({
  icon,
  title,
  accent,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  accent?: string;
  children: ReactNode;
}) {
  const c = accent || "var(--accent-1)";
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            color: c,
            background: `color-mix(in oklab, ${c} 14%, transparent)`,
            border: `1px solid color-mix(in oklab, ${c} 30%, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

// Segmented control bound to a value. Options are [value, label] pairs.
export function Seg<T extends string>({
  value,
  options,
  onChange,
  disabledValues,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  disabledValues?: T[];
}) {
  return (
    <div className="seg" style={{ flexWrap: "wrap" }}>
      {options.map(([v, l]) => (
        <button
          key={v}
          aria-pressed={value === v}
          disabled={disabledValues?.includes(v)}
          onClick={() => onChange(v)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

// Label + (optional suffix) input field — controlled.
export function Field({
  label,
  suffix,
  value,
  onChange,
  type = "text",
  mono = true,
}: {
  label: ReactNode;
  suffix?: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ position: "relative" }}>
        <input
          type={type}
          className={mono ? "input mono num" : "input"}
          style={suffix ? { paddingRight: 46 } : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && (
          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text-3)" }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
