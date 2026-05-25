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

A single-pool Meteora DLMM (SOL/USDC) management app exposing SDK power beyond the official UI: granular per-bin add/remove, custom strategy blends, add/rebalance/resize across **>70-bin extended positions**, fee/reward claims, and a Jupiter swap window. Multiple local wallets can be configured and switched live in the UI. Pool address is effectively fixed via `POOL_ADDRESS` (defaults to `DEFAULT_POOL_ADDRESS`, the SOL/USDC pool in `lib/constants.ts`).

## Architecture

**Signing model — the load-bearing constraint.** Wallets are *local keypairs*, held only in `lib/solana.ts` as a lazy registry built from `env.WALLETS` (insertion order; first = default). `getWallet(pubkey?)` resolves one (no arg → default); `listWallets()` / `getDefaultWalletPubkey()` expose pubkey+label only. All transaction building/signing/sending happens **server-side in `app/api/*` route handlers**. Keypairs must never reach the browser: `lib/{env,solana,dlmm,tx,strategies}.ts` each throw if `window` is defined, and must not be imported from any `"use client"` component. The client only renders data and POSTs action requests.

**Wallet selection.** Each write route takes an optional `wallet` (base58 pubkey) in its body; read routes take `?wallet=` query. Both pass it to `getWallet(body.wallet)` — unknown pubkey throws, omitted falls back to default. Client picks via `components/WalletSelector.tsx` backed by `lib/wallet-context.tsx` (`WalletProvider` in `app/layout.tsx`), which fetches `/api/wallets` and persists the choice in `localStorage`. The context holds pubkey+label only — secrets stay server-side.

**Read path.** `lib/dlmm.ts#getDlmm()` returns a cached `DLMM` instance and calls `refetchStates()` on every access so reads are fresh. SDK objects contain `BN`, `PublicKey`, and `Decimal` values that are not JSON-safe — route handlers pass responses through `lib/serialize.ts#serialize()` (BN/bigint→string, PublicKey→base58, Decimal→string) before returning. Client-side response shapes live in `lib/types.ts` (no SDK imports).

**Write path.** Every write route accepts `dryRun` and routes through `lib/tx.ts`. `previewTransactions`/`sendTransactions` take `(txs, wallet, extraSigners[])`:
- `previewTransactions` simulates **only the first** tx (later chunks depend on earlier ones — e.g. bin-array init — having already landed).
- `sendTransactions` sends sequentially, confirming each before the next, stopping on first failure.
- `signRequired` derives the required-signer set from the **compiled message** (`tx.compileMessage()`), then `partialSign`s only the signers it holds. Critical: SDK-returned legacy `Transaction`s have an **empty `tx.signatures` until compile**, so reading that array directly signs nothing (and `simulateTransaction` defaults to `sigVerify=false`, so a dry-run won't catch it). This is why a fresh position `Keypair` passed as an extra signer co-signs the creation tx without `partialSign` throwing "unknown signer" on the deposit txs.

**Swap is the exception.** `app/api/swap/{quote,execute}` (via `lib/jupiter.ts`, Jupiter v6, override base with `JUPITER_API`) does **not** route through `lib/tx.ts`: Jupiter returns a base64 **`VersionedTransaction`**, signed directly with `tx.sign([wallet])` and sent — no `dryRun`/preview. `lib/tx.ts` only handles legacy `Transaction`.

The UI mirrors this with a **Preview → Execute** flow (Execute is gated behind a successful sim + `confirm()`), see `components/{AddLiquidityPanel,RemovePanel,ActionResult}.tsx`.

**UI routing.** Two client routes. Dashboard `app/page.tsx` holds pool-wide context (`PoolHeader`, `BinChart`), the clickable `PositionTable`, and wallet-wide actions (`SwapPanel`, `ClaimBar`) plus `AddLiquidityPanel` in create-new mode. Each `PositionTable` row routes (`useRouter().push`) to the per-position page `app/positions/[id]/page.tsx`, where `[id]` is the position base58 pubkey (URL-safe, read via `useParams`). That page re-fetches `/api/{pool,positions}`, finds the matching position, and renders its `PositionChart` + the four per-position panels (`Add/Remove/Resize/Rebalance`) **locked** to it. Each panel takes an optional `lockedPosition?: PositionInfo` prop: when set it pins `target` and hides the position dropdown (and the `＋ New position` option in Add); when absent the dropdown behaves as before.

**Strategy / distribution (`lib/strategies.ts`).** Two deposit paths:
- *Preset* → `StrategyParameters {minBinId, maxBinId, strategyType}` for `addLiquidityByStrategy` / `initializePositionAndAddLiquidityByStrategy`.
- *Custom blend* → weighted sum of per-bin bps from `calculate{Spot,Normal,BidAsk}Distribution`, largest-remainder normalized to 10000 bps **per side**, producing `BinAndAmount[]` for `addLiquidityByWeight` / `initializePositionAndAddLiquidityByWeight`. This is how arbitrary Spot+BidAsk mixes are expressed (the SDK has no single blended strategy type). Blend is **≤70 bins only**.

**Add liquidity by bin count (`app/api/liquidity/add`).** Branches on range width:
- **≤70 bins**: the strategy/blend paths above.
- **>70 and ≤1400 bins (preset only)**: extended-position flow matching the on-chain Solscan reference — `createExtendedEmptyPosition` (the `InitializePosition`) + `chunkDepositWithRebalanceEndpoint` (chunked `InitializeBinArray` + `RebalanceLiquidity` deposits), with `liquidityStrategyParameters` from `buildLiquidityStrategyParameters` + `getLiquidityStrategyParameterBuilder`. **Not** `addLiquidityByStrategyChunkable` — that method is itself 70-bin-limited per its own doc.
- **>1400 bins**, or **blend + >70**: rejected with a 400.

Bin↔price conversion for the by-price range UI is `lib/binmath.ts` (geometric spacing); human→raw `BN` amounts via `lib/amount.ts#toRaw`.

## DLMM SDK facts that shape the code

- **Always confirm exact signatures from `node_modules/@meteora-ag/dlmm/dist/index.d.ts`** before calling a method — it is the source of truth (large single bundled `.d.ts`).
- A position is **one account** holding up to **1400 bins** (extended positions). The 70-bin number is the per-*bin-array* size, not the position cap. Widen/narrow via `increasePositionLength`/`decreasePositionLength(position, side: ResizeSide, length, ...)` → `Transaction[]`. Rebalance via `simulateRebalancePositionWithBalancedStrategy(...)` (preview) then `rebalancePosition(simResponse, ...)`.
- Decreasing position length does **not** refund rent — only full `closePosition` does. Surface this in UI.
- `removeLiquidity` takes a single `bps` over `[fromBinId, toBinId]`, **not** a per-bin array.
- On-chain, deposits and rebalances both emit the `RebalanceLiquidity` instruction; wide ranges split across multiple txns (≈26 bins/tx, `MAX_BIN_LENGTH_PER_TX`).
- The SDK has native limit-order support (`PlaceLimitOrderParams`, `getLimitOrderLiquidity`, `isSupportLimitOrder`) — relevant to the planned limit-orders feature.

## Config / gotchas

- `next.config.ts` uses `transpilePackages: ["@meteora-ag/dlmm", "@coral-xyz/anchor"]`. Do **not** switch to `serverExternalPackages` — the SDK's ESM build directory-imports anchor subpaths, which Node's native ESM loader rejects, breaking the build.
- Env (`.env.local`, gitignored): `RPC_URL` (premium — the SDK is RPC-heavy), `WALLETS` (JSON array of `{ secret, label? }`; each `secret` is base58 **or** JSON byte array — see `lib/env.ts#parseWallets`). Legacy single `WALLET_SECRET` still works as one wallet (migration fallback). Optional `POOL_ADDRESS`, optional `JUPITER_API`.
- Read data also comes from Meteora's data API via `lib/meteora-api.ts` (PnL, portfolio, OHLCV, TVL) — separate from on-chain SDK reads.
