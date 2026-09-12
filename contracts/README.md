# APIritivoPayments (Foundry)

Pull-payment ledger for APIritivo access purchases. USDC on Avalanche Fuji. Nothing is pushed to providers: funds sit in the contract until the credited address calls `claim`.

```bash
forge build
forge test -vv
```

**Deployed on Avalanche Fuji (2026-09-12):** [`0x4e98f464dc8c667e3b0fd3092e0f2d4585702fa3`](https://testnet.snowtrace.io/address/0x4e98f464dc8c667e3b0fd3092e0f2d4585702fa3), owner `0x401629d4c1A4C1A0Ffd14A089f798Dd29A94c09C`, fee 0 bps, deploy tx [`0x39122be542379825ac8e14e3cbc759230ae094822125927b9da219f70ae14307`](https://testnet.snowtrace.io/tx/0x39122be542379825ac8e14e3cbc759230ae094822125927b9da219f70ae14307).

To redeploy, run `./deploy-fuji.sh` (reads the writer key from `apps/web/.env.local`, needs Fuji AVAX) or by hand:

```bash
export AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
export USDC_ADDRESS=0x5425890298aed601595a70AB815c96711a31Bc65
export FEE_BPS=0
export DEPLOYER_PRIVATE_KEY=0x...   # funded with Fuji AVAX
forge script script/Deploy.s.sol:Deploy --rpc-url fuji --broadcast
# optional verification on Snowtrace: add --verify with SNOWTRACE_API_KEY
```

Put the printed address in `apps/web/.env.local` as `NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS` and restart `bun dev`.

## Surface

| Function | Who | What |
| --- | --- | --- |
| `buy(provider, serviceId, amount, accessSeconds)` | client | pulls `amount` USDC (needs approve), credits `claimable[provider]` minus fee, stores + emits `Purchased` |
| `claim(to, amount)` | provider (`msg.sender` = credited address) | transfers to `to` (`amount = 0` → all), emits `Claimed` |
| `claimable(provider)`, `totalEarned(provider)` | anyone | live and lifetime revenue |
| `serviceRevenue(key)`, `servicePurchases(key)` | anyone | per-service counters, `key = keccak256(serviceId)` |
| `getPurchases(offset, limit)`, `getPurchase(id)`, `purchaseCount()` | anyone | newest-first pages of stored purchases |
| `setFee`, `withdrawFees`, `transferOwnership` | owner | platform fee ≤ 10% |

The ledger is keyed by EVM address. `provider` is the listing's `payout_address` on Arkiv, which the app always sets to the wallet derived from the provider's Swarm ID, so the same identity claims from any device. Swarm IDs never appear on-chain.

Invariant: `token.balanceOf(contract) == Σ claimable + feesAccrued`. No pause, no upgrade path. 28 tests: accounting, fees, pagination, fuzzing, `false`-returning and no-return tokens, reentrancy.
