# DLMM Position Manager — SOL/USDC

Personal power-tool for managing a single Meteora DLMM pool beyond what the official app exposes:
resize position width, rebalance ranges > 70 bins, granular per-bin add/remove with custom
strategies, and an integrated swap window.

Pool: `5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6` (SOL/USDC).

## Architecture

Browser UI → Next.js route handlers (`app/api/*`) → server-side `lib/*` (keypair, DLMM SDK, RPC).
**Transactions are built and signed server-side** with a local keypair that never reaches the browser.

```
lib/        constants, env, solana (keypair+conn), dlmm (cached pool), meteora-api, serialize, types
app/api/    pool, positions, analytics  (read)  + (later) liquidity/position/swap/claim (write)
components/ PoolHeader, BinChart, PositionTable
```

## Setup

1. `cp .env.example .env.local` and fill in:
   - `RPC_URL` — a premium Solana RPC (Helius/QuickNode/Triton). Public RPC will rate-limit.
   - `WALLET_SECRET` — base58 private key **or** JSON byte array. Server-side only; `.env*` is gitignored.
2. `npm run dev` → open http://localhost:3000

> Security: the keypair is loaded only in `lib/solana.ts` and never imported by client code.
> Every write action (later phases) simulates before sending.

## Status

- [x] **Phase 0** — read-only core: pool state, bin liquidity chart, position table
- [x] **Phase 1** — add (preset + custom blend) / remove liquidity, with simulate-first preview
- [x] **Phase 2** — resize width (`increase/decreasePositionLength`)
- [x] **Phase 3** — rebalance/recenter (`simulateRebalancePositionWithBalancedStrategy` + `rebalancePosition`)
- [x] **Phase 4** — claim fees/rewards + Jupiter swap window
- [x] **Phase 5** — add liquidity > 70 bins (extended positions, preset-only, ≤ 1400)

Full plan: `~/.claude/plans/i-want-to-create-jaunty-eagle.md`. Test guide: `TESTING.md`.
