# APIperitivoPayments (Foundry)

Pull-payment ledger for APIperitivo access purchases. USDC on Avalanche Fuji.

```bash
forge build
forge test -vv
```

**Not deployed yet.** When ready:

```bash
export AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
export USDC_ADDRESS=0x5425890298aed601595a70AB815c96711a31Bc65
export FEE_BPS=0
export DEPLOYER_PRIVATE_KEY=0x...   # funded with Fuji AVAX
forge script script/Deploy.s.sol:Deploy --rpc-url fuji --broadcast
# optional verification on Snowtrace: add --verify with SNOWTRACE_API_KEY
```

Put the printed address in `apps/web/.env.local` as `NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS`.

## Surface

| Function | Who | What |
| --- | --- | --- |
| `buy(provider, serviceId, amount, accessSeconds)` | client | pulls `amount` USDC (needs approve), credits provider minus fee, stores + emits `Purchased` |
| `claim(to, amount)` | provider | withdraws (`amount = 0` → all) |
| `claimable(provider)`, `totalEarned(provider)` | anyone | live and lifetime revenue |
| `serviceRevenue(key)`, `servicePurchases(key)` | anyone | per-service counters, `key = keccak256(serviceId)` |
| `getPurchases(offset, limit)` | anyone | newest-first pages of stored purchases |
| `setFee`, `withdrawFees`, `transferOwnership` | owner | platform fee ≤ 10% |

Invariant: `token.balanceOf(contract) == Σ claimable + feesAccrued`.
