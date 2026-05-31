"use client";

// Auto-refresh interval state. The user picks how often read data refetches
// (Off by default). Mirrors theme-context.tsx: one persisted setting in a tiny
// context, plus a useAutoRefresh hook that drives each page's existing load().
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// [ms, label]; 0 = off. RPC is heavy, so intervals stay conservative.
export const INTERVAL_OPTIONS: [number, string][] = [
  [0, "Off"],
  [10000, "10s"],
  [30000, "30s"],
  [60000, "1m"],
  [300000, "5m"],
];

interface RefreshCtx {
  intervalMs: number;
  setIntervalMs: (ms: number) => void;
}

const Ctx = createContext<RefreshCtx | null>(null);
const STORAGE_KEY = "strata.refreshInterval";

export function RefreshProvider({ children }: { children: ReactNode }) {
  // Default 0 (Off) on first render avoids SSR/hydration mismatch; the stored
  // value is applied after mount.
  const [intervalMs, setIntervalState] = useState<number>(0);

  useEffect(() => {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    if (INTERVAL_OPTIONS.some(([ms]) => ms === stored)) setIntervalState(stored);
  }, []);

  function setIntervalMs(ms: number) {
    localStorage.setItem(STORAGE_KEY, String(ms));
    setIntervalState(ms);
  }

  return <Ctx.Provider value={{ intervalMs, setIntervalMs }}>{children}</Ctx.Provider>;
}

export function useRefreshInterval(): RefreshCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRefreshInterval must be used within RefreshProvider");
  return ctx;
}

// Calls onTick every intervalMs while a non-zero interval is selected. The ref
// keeps the latest callback so the timer doesn't reset on every render.
export function useAutoRefresh(onTick: () => void) {
  const { intervalMs } = useRefreshInterval();
  const ref = useRef(onTick);
  useEffect(() => {
    ref.current = onTick;
  });
  useEffect(() => {
    if (!intervalMs) return;
    const id = setInterval(() => ref.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
