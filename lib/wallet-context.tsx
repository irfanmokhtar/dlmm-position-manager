"use client";

// Client-side selected-wallet state, shared across the dashboard and all action
// panels. Holds pubkey + label only — secrets stay server-side.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface WalletOption {
  pubkey: string;
  label: string;
}

interface WalletCtx {
  wallets: WalletOption[];
  selected: string; // base58 pubkey; "" until /api/wallets resolves
  setSelected: (pubkey: string) => void;
}

const Ctx = createContext<WalletCtx | null>(null);
const STORAGE_KEY = "dlmm.selectedWallet";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [selected, setSelectedState] = useState<string>("");

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
    setSelectedState(pubkey);
    localStorage.setItem(STORAGE_KEY, pubkey);
  }

  return (
    <Ctx.Provider value={{ wallets, selected, setSelected }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWallet(): WalletCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
