# @apiperitivo/payments

USDC payments on Avalanche Fuji (chain 43113, Circle testnet USDC `0x5425…Bc65`, 6 decimals).

- `@apiperitivo/payments` — chain definition, USDC address, `usdcToUnits`/`unitsToUsdc`, Snowtrace links, `serviceKey(serviceId)` (= Solidity `keccak256`), `paymentsContractAddress()` from `NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS`, contract ABI.
- `@apiperitivo/payments/browser` — signers (`swarmSigner(secret)` derived from Swarm ID, `injectedSigner()` for MetaMask/Core), `payForAccess` (contract mode: approve + `buy`; direct mode: `transfer`), `waitForPayment`, `claimEarnings`, `transferUsdc`, `getBalances`, `readProviderStats`, `readServiceStats`, `readRecentPurchases`.
- `@apiperitivo/payments/server` — `verifyPayment`: checks the `Purchased` event of `APIperitivoPayments` (contract mode) or a USDC `Transfer` to the payout address (direct mode) before an access pass is minted.

Contract source and tests live in `/contracts`.
