# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> Next.js 16 + React 19. APIs differ from older versions — when unsure, read `node_modules/next/dist/docs/` before writing.

## Commands

```bash
npm run dev      # dev server (Turbopack) at http://localhost:3000
npm run build    # production build — also runs full typecheck
npm run lint     # eslint
npx tsc --noEmit # typecheck only (fast iteration)
```

No test framework is set up. Verification is done live against the configured pool/wallet (see README), or via the in-app **Preview** (dry-run simulation) on each write action.

## What this is

A single-pool Meteora DLMM (SOL/USDC) management app exposing SDK power beyond the official UI: granular per-bin add/remove, custom strategy blends, position resize, >70-bin rebalance, and a swap window. Pool address is effectively fixed via `POOL_ADDRESS` (defaults to the SOL/USDC pool in `lib/constants.ts`).

## Architecture

**Signing model — the load-bearing constraint.** The wallet is a *local keypair*, loaded only in `lib/solana.ts` (`getWallet`). All transaction building/signing/sending happens **server-side in `app/api/*` route handlers**. The keypair must never reach the browser: `lib/{env,solana,dlmm,tx,strategies}.ts` each throw if `window` is defined, and must not be imported from any `"use client"` component. The client only renders data and POSTs action requests.

**Read path.** `lib/dlmm.ts#getDlmm()` returns a cached `DLMM` instance and calls `refetchStates()` on every access so reads are fresh. SDK objects contain `BN`, `PublicKey`, and `Decimal` values that are not JSON-safe — route handlers pass responses through `lib/serialize.ts#serialize()` (BN/bigint→string, PublicKey→base58, Decimal→string) before returning. Client-side response shapes live in `lib/types.ts` (no SDK imports).

**Write path.** Every write route accepts `dryRun` and routes through `lib/tx.ts`:
- `previewTransactions` simulates **only the first** tx (later chunks depend on earlier ones — e.g. bin-array init — having already landed).
- `sendTransactions` sends sequentially, confirming each before the next, stopping on first failure.
- `signRequired` signs each tx with **only** the signers it declares as required. This is why creating a new position works: a fresh position `Keypair` is passed as an extra signer but only co-signs the creation tx; `partialSign` with a non-required signer throws.

The UI mirrors this with a **Preview → Execute** flow (Execute is gated behind a successful sim + `confirm()`), see `components/{AddLiquidityPanel,RemovePanel,ActionResult}.tsx`.

**Strategy / distribution (`lib/strategies.ts`).** Two deposit paths:
- *Preset* → `StrategyParameters {minBinId, maxBinId, strategyType}` for `addLiquidityByStrategy` / `initializePositionAndAddLiquidityByStrategy`.
- *Custom blend* → weighted sum of per-bin bps from `calculate{Spot,Normal,BidAsk}Distribution`, largest-remainder normalized to 10000 bps **per side**, producing `BinAndAmount[]` for `addLiquidityByWeight` / `initializePositionAndAddLiquidityByWeight`. This is how arbitrary Spot+BidAsk mixes are expressed (the SDK has no single blended strategy type).

## DLMM SDK facts that shape the code

- **Always confirm exact signatures from `node_modules/@meteora-ag/dlmm/dist/index.d.ts`** before calling a method — it is the source of truth (large single bundled `.d.ts`).
- A position is **one account** holding up to **1400 bins** (extended positions). The 70-bin number is the per-*bin-array* size, not the position cap. Widen/narrow via `increasePositionLength`/`decreasePositionLength(position, side: ResizeSide, length, ...)` → `Transaction[]`. Rebalance via `simulateRebalancePositionWithBalancedStrategy(...)` (preview) then `rebalancePosition(simResponse, ...)`.
- Decreasing position length does **not** refund rent — only full `closePosition` does. Surface this in UI.
- `removeLiquidity` takes a single `bps` over `[fromBinId, toBinId]`, **not** a per-bin array.
- On-chain, deposits and rebalances both emit the `RebalanceLiquidity` instruction; wide ranges split across multiple txns (≈26 bins/tx, `MAX_BIN_LENGTH_PER_TX`).
- The SDK has native limit-order support (`PlaceLimitOrderParams`, `getLimitOrderLiquidity`, `isSupportLimitOrder`) — relevant to the planned limit-orders feature.

## Config / gotchas

- `next.config.ts` uses `transpilePackages: ["@meteora-ag/dlmm", "@coral-xyz/anchor"]`. Do **not** switch to `serverExternalPackages` — the SDK's ESM build directory-imports anchor subpaths, which Node's native ESM loader rejects, breaking the build.
- Env (`.env.local`, gitignored): `RPC_URL` (premium — the SDK is RPC-heavy), `WALLET_SECRET` (base58 **or** JSON byte array), optional `POOL_ADDRESS`.
- Read data also comes from Meteora's data API via `lib/meteora-api.ts` (PnL, portfolio, OHLCV, TVL) — separate from on-chain SDK reads.
