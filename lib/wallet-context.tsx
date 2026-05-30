"use client";

// Client-side selected-wallet state, shared across the dashboard and all action
// panels. Holds pubkey + label only — secrets stay server-side.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { WalletBalanceResponse } from "@/lib/types";

export interface WalletOption {
  pubkey: string;
  label: string;
}

interface WalletCtx {
  wallets: WalletOption[];
  selected: string; // base58 pubkey; "" until /api/wallets resolves
  setSelected: (pubkey: string) => void;
  balances: WalletBalanceResponse | null; // available SOL/USDC for the active wallet
  refreshBalances: () => void;
}

const Ctx = createContext<WalletCtx | null>(null);
const STORAGE_KEY = "dlmm.selectedWallet";

export function WalletProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [selected, setSelectedState] = useState<string>("");
  const [balances, setBalances] = useState<WalletBalanceResponse | null>(null);

  const refreshBalances = useCallback(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = selected ? `?wallet=${selected}` : "";
        const res = await fetch(`/api/wallet/balance${qs}`, { cache: "no-store" });
        const json = await res.json();
        if (cancelled || !res.ok) return;
        setBalances({ sol: json.sol, usdc: json.usdc });
      } catch {
        // ignore — buttons stay disabled until balances load
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  // Re-fetch balances whenever the active wallet changes.
  useEffect(() => {
    setBalances(null);
    const cleanup = refreshBalances();
    return cleanup;
  }, [refreshBalances]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wallets", { cache: "no-store" });
        const json = await res.json();
        if (cancelled || !res.ok) return;
        const list: WalletOption[] = json.wallets ?? [];
        setWallets(list);
        const stored = localStorage.getItem(STORAGE_KEY);
        const valid = stored && list.some((w) => w.pubkey === stored);
        setSelectedState(valid ? stored! : json.default ?? list[0]?.pubkey ?? "");
      } catch {
        // ignore — selector stays empty; API calls fall back to the server default
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function setSelected(pubkey: string) {
    const changed = pubkey !== selected;
    setSelectedState(pubkey);
    localStorage.setItem(STORAGE_KEY, pubkey);
    // Switching wallet invalidates the current per-position view (positions are
    // wallet-scoped) — send the user back to the dashboard.
    if (changed) router.push("/");
  }

  return (
    <Ctx.Provider value={{ wallets, selected, setSelected, balances, refreshBalances }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWallet(): WalletCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
