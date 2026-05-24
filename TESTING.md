# Testing Guide

How to verify every phase of the DLMM Position Manager end-to-end against the live SOL/USDC pool.

> **Safety model.** Every write action has two steps: **Preview** (local + RPC *simulation* — signs locally, never broadcasts) and **Execute** (broadcasts a real, fund-moving transaction, gated behind a `confirm()` dialog). Always Preview first. Test with **tiny amounts** (e.g. 0.01 SOL). This is mainnet — there is no devnet for this pool.

---

## 0. Prerequisites

1. `cp .env.example .env.local`, then set:
   - `RPC_URL` — premium RPC (public RPC will rate-limit and many calls will fail).
   - `WALLET_SECRET` — base58 key **or** JSON byte array. Use a wallet holding a small amount of **SOL and USDC**.
2. Fund the wallet: ~0.1 SOL (gas + rent + test liquidity) and a few USDC.
3. `npm run dev` → open http://localhost:3000.

Sanity check the toolchain (no env needed):

```bash
npx tsc --noEmit && npm run build   # both should exit 0
```

If the dashboard shows a red error banner, the message is the raw RPC/SDK error — usually a bad `RPC_URL` or `WALLET_SECRET`.

You can drive every endpoint without the UI. Example dry-run (simulation only, safe):

```bash
curl -s localhost:3000/api/pool | jq '.activeBin, .fees'
```

---

## Phase 0 — Read-only core

**UI:** load the dashboard.

- [ ] **Pool header** shows price, active bin id, bin step (4), base + dynamic fee, TVL.
- [ ] **Liquidity by bin** chart renders bars around the active bin; the active bin is gold; bins you own are green.
- [ ] **Position table** lists your open positions: range, width (bins), SOL/USDC amounts, unclaimed fees, in/out of range.
- [ ] **Per-position liquidity**: one chart per position (only if you have ≥1 position).

**Cross-check:** open the same pool + wallet in the Meteora app — price, position ranges, and amounts should match.

```bash
curl -s localhost:3000/api/positions | jq '.positions[] | {publicKey, lowerBinId, upperBinId}'
curl -s localhost:3000/api/analytics | jq '.portfolioTotal'
```

---

## Phase 1 — Add / remove liquidity

### Add (preset)
1. Add panel → Target **New position**, set a small range around active (default ±10), enter e.g. `0.02` SOL / `1` USDC, Strategy **Spot**.
2. **Preview** → expect "Simulation OK · 1 tx · N CU".
3. **Execute** → confirm. Result shows a tx signature linking to Solscan.
- [ ] New position appears in the table after the auto-refresh.
- [ ] On Solscan the tx contains `InitializePosition` + `RebalanceLiquidity`.

### Add (custom blend)
- [ ] Switch to **Custom blend**, set weights e.g. spot `50`, bidask `50`, curve `0`. Preview → OK. The resulting per-position chart should show liquidity weighted toward the middle *and* edges.

### Remove
1. Remove panel → pick the position, keep the full range, set the slider to **50%**, Preview → OK.
2. Execute → confirm.
- [ ] Position amounts drop ~50% after refresh.
- [ ] Tick **Claim fees & close** + slider 100% to fully exit and close (rent returned).

```bash
# dry-run add (safe)
curl -s localhost:3000/api/liquidity/add -H 'content-type: application/json' -d '{
  "dryRun": true, "minBinId": -10, "maxBinId": 10, "xAmount": "0.02", "yAmount": "1",
  "strategy": { "type": "preset", "kind": "Spot" } }' | jq '.preview'
```

> Note: a range > 70 bins is rejected here — use **Resize** (Phase 2) or **Rebalance** (Phase 3) for wider/extended positions.

---

## Phase 2 — Resize width

1. Resize panel → pick a position, **Increase (widen)**, Side **Upper**, Bins `10`.
2. **Preview** → OK. **Execute** → confirm.
- [ ] Position `upperBinId` grows by 10 in the table; rent is paid.
- [ ] Seed the new bins via the **Add** panel targeting the same position over the new range.
3. **Decrease (narrow)**, Side **Upper**, Bins `10` → Preview → Execute.
- [ ] `upperBinId` shrinks by 10. Note the in-UI reminder: **rent from a decrease is refunded only on full close**, not on shrink.

```bash
curl -s localhost:3000/api/position/resize -H 'content-type: application/json' -d '{
  "dryRun": true, "positionPubKey": "<POSITION>", "action": "increase", "side": "Upper", "length": 10 }' | jq
```

- [ ] Increasing beyond the **1400-bin** cap is rejected with a clear error.

---

## Phase 3 — Rebalance (recenter)

1. Rebalance panel → pick a position, Shape **Spot**, Withdraw SOL/USDC **100%**, Top-ups `0`, active-bin slippage `5`.
2. **Preview (simulate)** → runs `simulateRebalancePositionWithBalancedStrategy` locally, then packages instructions. Expect a summary line: `N tx · X bin-array init · Y rebalance ix` and "Simulation OK".
3. **Execute** → confirm. Multiple txns send **in order** (bin-array inits first, then rebalance), each confirmed before the next.
- [ ] After refresh the position is recentered on the active bin with the chosen shape.
- [ ] If a middle tx fails, results show which step (`#index`) failed; re-run Preview/Execute to resume.

```bash
curl -s localhost:3000/api/position/rebalance -H 'content-type: application/json' -d '{
  "dryRun": true, "positionPubKey": "<POSITION>", "strategy": "Spot",
  "withdrawXBps": 10000, "withdrawYBps": 10000, "maxActiveBinSlippage": 5 }' | jq '.summary, .preview.ok'
```

> This is the path that handles ranges **> 70 bins** — a single extended position (up to 1400 bins). Test with a wide position to exercise the multi-tx chunking.

---

## Phase 4 — Claim + Swap

### Claim
- [ ] Claim panel → **Swap fees** → Preview → OK (only works if there are unclaimed fees; otherwise "Nothing to claim"). Execute → wallet SOL/USDC increases by the fee amounts.
- [ ] **Fees + LM rewards** claims both.

### Swap (Jupiter)
1. Swap panel → **SOL → USDC**, amount `0.01`, slippage `50` bps → **Get quote**.
- [ ] Shows `≈ <out> USDC` and price impact %.
2. **Swap** → confirm.
- [ ] Returns a signature; wallet balances change accordingly.
- [ ] Reverse **USDC → SOL** works too.

```bash
curl -s localhost:3000/api/swap/quote -H 'content-type: application/json' -d '{
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amount": "0.01", "slippageBps": 50 }' | jq '.uiOutAmount, .priceImpactPct'
```

> Set `JUPITER_API` in `.env.local` to override the default Jupiter endpoint if you have a paid host.

---

## Suggested full run order

1. Phase 0 read checks.
2. Add a small **new position** (Phase 1).
3. **Resize** widen + seed, then narrow (Phase 2).
4. **Rebalance** recenter (Phase 3).
5. **Claim** any fees, **Swap** to rebalance wallet inventory (Phase 4).
6. **Remove** 100% + close to exit cleanly (Phase 1).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Red banner / `Missing required env var` | `RPC_URL` or `WALLET_SECRET` not set in `.env.local`. |
| `429` / timeouts / flaky reads | Public/weak RPC — use a premium endpoint. |
| Simulation fails with `insufficient funds` | Wallet lacks SOL (rent/gas) or the input token. |
| Preview OK but later chunk fails on Execute | Expected for multi-tx flows if state shifted; re-run — `InitializeBinArray` is idempotent so resends are safe. |
| Swap quote 4xx | Amount too small/illiquid, or Jupiter endpoint down. |
