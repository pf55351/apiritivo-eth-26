# @apiritivo/payments

USDC payments on Avalanche Fuji (chain 43113, Circle testnet USDC `0x5425…Bc65`, 6 decimals) and the `APIritivoPayments` contract, deployed at `0x4e98f464dc8c667e3b0fd3092e0f2d4585702fa3`.

- `@apiritivo/payments` — chain definition, USDC address, `usdcToUnits` / `unitsToUsdc`, Snowtrace links, `serviceKey(serviceId)` (= Solidity `keccak256`), `paymentsContractAddress()` and `isContractMode()` from `NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS`, contract ABI, `saleFromPurchasedLog` / `saleFromTransferLog` (pure log → `LiveSale` mapping), `PASS_KEY_MESSAGE` + `keyFromSignature(signature)` (the wallet-derived pass encryption key: `keccak256` of a deterministic `personal_sign`).
- `@apiritivo/payments/browser` — signers (`swarmSigner(secret)` derived from Swarm ID, `injectedSigner()` for MetaMask / Rabby / Core with `ensurePaymentChain`, `reconnectInjectedWallet()` silent reconnect, `walletChainId()`, `onWalletChange`), `signPassKeyMessage(signer)`, `payForAccess` (contract mode: `approve` + `buy`; direct mode: `transfer`), `waitForPayment`, `claimEarnings(signer, to)` (`claim(to, 0)` = everything), `transferUsdc`, `getBalances`, `readProviderStats` (`claimable`, `totalEarned`), `readServiceStats`, `readRecentPurchases`, `watchSales` (polls `Purchased` events, or USDC `Transfer` logs in direct mode, for a provider address).
- `@apiritivo/payments/server` — `verifyPayment`: checks the `Purchased` event (contract mode) or a USDC `Transfer` to the payout address (direct mode), returns the paying wallet and the amount, before an access pass is minted.

## Who holds the money

| Mode | On `buy` | Provider gets paid by |
| --- | --- | --- |
| contract (`NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS` set) | USDC moves into the contract, `claimable[payout_address] += net` | calling `claim` from the `payout_address` wallet (the Swarm wallet in the app) |
| direct (variable empty) | USDC goes straight to `payout_address` | nothing to do |

The contract ledger is keyed by EVM address only. The provider side is the deterministic Swarm wallet derivation in `@apiritivo/swarm`; the buyer side is the injected wallet, whose address is also the `buyer_id` on Arkiv.

Contract source and tests live in `/contracts`. Tests here: `bun test` (units, explorer URLs, log mapping, verification against the deployed contract).
