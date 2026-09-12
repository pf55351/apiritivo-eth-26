# Contract and backend reference

[Client workflow](client.html) · [Provider workflow](provider.html) · [Role comparison](role-workflows.md)

[Contract integration map](contracts.html) · [Purchase sequence](purchase.html) · [Claim sequence](claim.html) · [Full backend overview](backend.html) · [Backend route reference](../backend-architecture.md)

The diagrams describe the current implementation. The integration map expands the wallet, payments contract, token, receipt verifier, Arkiv writer and access guard. The sequence views show transaction order and the handoff between the two chains. Existing service publication, Swarm ACT grants and gateway forwarding are documented in the linked backend reference.

## Verified contracts

Read-only Fuji RPC observation at **2026-09-12 16:18:09 UTC**, block **58,334,879**, chain **43113**. This is a point-in-time snapshot, not a live status display. Full results: [contracts.chain-observation.json](contracts.chain-observation.json).

| Component | Address | Observed state |
| --- | --- | --- |
| APIritivoPayments | [`0x4e98f464dc8c667e3b0fd3092e0f2d4585702fa3`](https://testnet.snowtrace.io/address/0x4e98f464dc8c667e3b0fd3092e0f2d4585702fa3) | Runtime bytecode present; `token()` is the USDC address below; `feeBps() = 0`; `purchaseCount() = 3` |
| USDC token | [`0x5425890298aed601595a70AB815c96711a31Bc65`](https://testnet.snowtrace.io/address/0x5425890298aed601595a70AB815c96711a31Bc65) | Runtime bytecode present; `symbol() = USDC`; `decimals() = 6` |
| Payments owner / fee recipient | [`0x401629d4c1A4C1A0Ffd14A089f798Dd29A94c09C`](https://testnet.snowtrace.io/address/0x401629d4c1A4C1A0Ffd14A089f798Dd29A94c09C) | Both `owner()` and `feeRecipient()` returned this address; it is an administrative account, not another contract dependency |

`apps/web/.env.local` and `.env.example` both configure that payments address. The observation verifies code presence and public getter values; it does not compare deployed bytecode against a reproducible Solidity build.

## Who signs each operation

| Actor | Signing material / responsibility | Where it runs |
| --- | --- | --- |
| Buyer | Injected wallet (MetaMask, Rabby, Core); signs token approval, purchase and one `personal_sign` of `PASS_KEY_MESSAGE` that derives the pass encryption key | Browser, `packages/payments/src/browser.ts`, `apps/web/lib/injected-wallet.tsx` |
| Provider | Swarm-derived payout account; signs `claim` and optional token transfer | Browser, same payment adapter |
| Arkiv writer | `ARKIV_WRITER_PRIVATE_KEY`; signs service, pass, sale and grant creation | Next.js server, `packages/arkiv/src/server.ts` |
| Payment verifier | Public RPC reads only; holds no buyer signing key | Next.js server, `packages/payments/src/server.ts` |
| Swarm identity | Derives app-specific key material and performs manifest / ACT operations through the Swarm SDK | Browser, `packages/swarm/src/index.ts` |

Provider wallet derivation uses `deriveAppSecret("apiperitivo:wallet:v1")`; pass encryption for a Swarm ID buyer uses the separate `"apiritivo:pass-crypt:v1"` label, for a wallet buyer `keccak256(personal_sign(PASS_KEY_MESSAGE))` (`keyFromSignature`). The identity and app origin affect Swarm derivation. The pre-rename wallet label is deliberate. A local role selection is a UI preference, not authorization.

## Direct contract interactions

| Target | Caller | Function / event | Actual purpose |
| --- | --- | --- | --- |
| USDC | Buyer browser | `balanceOf(buyer)` | Check token balance; AVAX gas balance is read separately with RPC |
| USDC | Buyer browser | `allowance(buyer, payments)` | Determine whether approval is needed |
| USDC | Buyer signer | `approve(payments, amount)` | Set allowance to the purchase amount when current allowance is insufficient; wait for successful mining before buying |
| APIritivoPayments | Buyer signer | `buy(provider, serviceKey, amount, accessSeconds)` | Pull USDC into the ledger, credit provider revenue, store purchase, emit `Purchased` |
| USDC | APIritivoPayments | `transferFrom(buyer, address(this), amount)` | The contract spends the approved tokens; the app does not send a separate transfer transaction for contract-mode purchases |
| APIritivoPayments | Provider signer | `claim(to, amount)` | Withdraw only the signer's credited balance; `amount = 0` means all |
| USDC | APIritivoPayments | `transfer(to, withdrawn)` | Deliver the claim to its recipient |
| USDC | Provider signer | `transfer(destination, amount)` | Optional later “Send USDC” operation from the provider wallet |
| APIritivoPayments | Browser public client | `claimable`, `totalEarned` | Current claimable balance and lifetime provider revenue |
| APIritivoPayments | Browser public client | `serviceRevenue`, `servicePurchases` | Per-service net revenue and purchase count |
| APIritivoPayments | Browser public client | `getPurchases(0, limit)`, `purchaseCount()` | Recent purchase history, newest first |
| APIritivoPayments logs | Browser watcher | `Purchased` filtered by provider | Poll every 4 seconds by default and refresh sales views; this does not mint a pass |
| Fuji transaction receipt | Server public client | `getTransactionReceipt(txHash)` | Verify payment logs before issuing a pass; the server does not call `buy` |

`serviceKey = keccak256(bytes(serviceId))`. Amounts are integer USDC units: for example, **0.50 USDC = 500,000 units**. `accessSeconds` is a `uint64` in the contract and is informational there; the contract does not track access expiry.

Sources: [`browser payment adapter`](../../packages/payments/src/browser.ts), [`app ABI`](../../packages/payments/src/contract.ts), [`payment verifier`](../../packages/payments/src/server.ts), [`Solidity`](../../contracts/src/APIritivoPayments.sol).

### Purchase event and accounting

```solidity
buy(address provider, bytes32 serviceId, uint256 amount, uint64 accessSeconds)
    returns (uint256 purchaseId)

Purchased(
    uint256 indexed purchaseId,
    address indexed buyer,
    address indexed provider,
    bytes32 serviceId,
    uint256 amount,
    uint256 fee,
    uint64 accessSeconds
)
```

For each successful `buy`, the contract computes `fee = amount * feeBps / 10_000` and `net = amount - fee`, transfers the gross amount in, then performs:

```text
claimable[provider]       += net
totalEarned[provider]    += net
serviceRevenue[key]     += net
servicePurchases[key]   += 1
feesAccrued             += fee
_purchases.push(buyer, provider, key, amount, fee, accessSeconds, timestamp)
```

At the observed 0 bps fee, gross equals net. Claiming reduces `claimable[msg.sender]` before transferring tokens and emits `Claimed(provider, to, amount)`; lifetime revenue counters are unchanged. A failed token transfer reverts the whole transaction. `buy`, `claim` and fee withdrawal use the contract's `nonReentrant` modifier. Token calls accept a successful empty return or a returned `true` and otherwise revert.

The intended accounting relationship for ordinary purchases and withdrawals is token balance = total outstanding provider claims + unwithdrawn fees. A direct unsolicited token transfer into the ledger can increase its balance without increasing those accounting counters.

### Administrative surface

The Solidity contract also exposes `setFee(uint16,address)`, `withdrawFees()` and `transferOwnership(address)` guarded by `onlyOwner`. The fee cap is 1,000 bps (10%). These are contract capabilities, not calls wired into the current browser payment adapter; its ABI does not include those write methods. No pause or upgrade mechanism is implemented in this payments contract source. The USDC contract's own administrative behavior is outside this repository's implementation.

## Receipt-to-pass handoff

The browser waits for a successful buy receipt, generates a fresh random 32-byte secret and sends this request:

```text
POST /api/access-passes
{
  serviceId, buyerId, buyerAddress, txHash,
  secretHash, encryptedSecret,
  buyerPublicKey?              // optional Swarm ACT sharing key
}
```

The API loads current Arkiv listing terms and queries permanent `sale` entities by the normalized transaction hash. An existing sale returns `409`. In contract mode it verifies the receipt's success, emitting payments address, provider payout address, service hash and sufficient payment amount. It then compares the event buyer against the caller-supplied `buyerAddress`.

The verifier does **not** compare the event's `accessSeconds` to the current listing, authenticate `buyerId` with a signature, or enforce additional confirmation depth. It chooses the first matching `Purchased` event. The route's replay key is the transaction hash, not the purchase ID or log index.

After verification, `issueAccessPass` signs two separate Arkiv transactions:

| Write | Attributes and payload | Lifetime |
| --- | --- | --- |
| `createEntity(access_pass)` | Service/provider/buyer fields, payment hash, paid amount, Fuji chain ID, `secret_hash`; payload contains service name, purchase time and `encryptedSecret` | `ExpirationTime.fromSeconds(service.accessSeconds)` |
| `createEntity(sale)` | Payment and buyer fields plus the new `pass_key`; payload contains service name and purchase time | `ExpirationTime.permanent()` |

The route reads Arkiv block timing and returns `201` with `passKey`, `saleKey`, expiry block, estimated expiry time and both Arkiv transaction hashes. Fuji payment, pass creation and sale creation are separate commits; there is no atomic cross-chain transaction or durable retry queue. A failure between pass and sale creation can leave a pass without its replay receipt.

Source: [`access-passes route`](../../apps/web/app/api/access-passes/route.ts), [`entity writer`](../../packages/arkiv/src/server.ts).

## API execution after purchase

```text
Client -> POST /api/gateway/{serviceId}
          Authorization: Bearer <passKey>.<secret>
          { operation, input }

requireAccessPass -> verifyAccessPass
  -> parallel: Arkiv getEntity(passKey) + getBlockTiming()
  -> check serviceId, future expiry block, keccak256(secret) == secret_hash

Gateway -> Arkiv getService(serviceId)
        -> Bee GET /bytes/{manifestRef}, cache: no-store
        -> manifestFromBytes (Zod)
        -> endpoint present: POST endpoint, 20-second timeout
        -> no usable endpoint: runDemoOperation
```

The forwarded provider headers are `x-apiritivo-service`, `x-apiritivo-pass`, `x-apiritivo-buyer` and `x-apiritivo-expires-block`. The raw secret is received by the guard but is not forwarded upstream. `POST /api/bot/{serviceId}` uses the same guard and calls the demo directly. Demo `getQuote` reads CoinGecko; other operations echo. Manifest input types are descriptive; runtime route validation checks the generic call envelope, not each declared operation schema.

Missing or malformed credentials return `401`; expired, wrong-service or wrong-secret passes return `403`. Upstream gateway failures return `502`. No new payment transaction happens during a normal authorized API call.

Sources: [`pass guard`](../../packages/arkiv/src/index.ts), [`gateway`](../../apps/web/app/api/gateway/%5BserviceId%5D/route.ts), [`demo`](../../apps/web/lib/server/access.ts).

## Other backend and storage interactions

| Operation | Actual path |
| --- | --- |
| Publish listing | Browser builds manifest -> Swarm `uploadData` / gateway fallback -> `POST /api/services` -> Arkiv `createEntity(service)`, permanent |
| Discover services | Browser -> Arkiv public queries; `GET /api/services` only reports writer health |
| Private file upload | Browser -> `actUploadData`; encrypted references are stored on the service listing |
| Grant private access | Provider browser -> `actAddGrantees` -> `POST /api/grants` -> permanent Arkiv `grant` |
| Download private file | Buyer browser -> `actDownloadData` with the recorded references and its own identity |
| Expire API access | Arkiv TTL and the guard's block check; no Solidity expiry transaction or server cron |

Swarm access uses SDK and Bee gateway APIs. The app source does not directly invoke a Swarm BZZ or postage smart contract. Likewise, Arkiv entity creation uses the Arkiv SDK's native entity operations; the app does not configure a separate “access-pass Solidity contract” address. ACT grants are independent of API pass TTL, and automatic ACT revocation at expiry is not implemented.

## Networks and transport

| Network / service | Configuration and transport |
| --- | --- |
| Avalanche Fuji | Chain `43113`, AVAX gas; default HTTP RPC `https://api.avax-test.network/ext/bc/C/rpc`; server verifier accepts `AVALANCHE_FUJI_RPC_URL` |
| Arkiv Tiramisu | Chain `7738577`, GLM gas; SDK default `https://rpc.tiramisu.db-chain.testnet.arkiv.network`; public reads use `NEXT_PUBLIC_ARKIV_RPC_URL`, writer prefers `ARKIV_RPC_URL` then the public override |
| Swarm gateway | Default `https://api.gateway.ethswarm.org`; overridden with `NEXT_PUBLIC_SWARM_GATEWAY_URL` |
| Swarm ID | Default iframe origin `https://swarm-id.snaha.net`; overridden with `NEXT_PUBLIC_SWARM_ID_IFRAME_ORIGIN` |

With no valid `NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS`, the adapter switches to direct mode: the buyer signs USDC `transfer(provider, amount)`, the verifier checks matching USDC `Transfer` logs, and there is no payments-ledger claim. Those transfer logs do not encode a service ID or access duration. This fallback exists in code; the inspected local configuration uses contract mode.

## Artifact evidence

The architecture sources are pinned to commit `d7c00fcf0cb0537a478369d01f84b89eac3f3c56`; the chain snapshot above is independent evidence with its own block and observation time.

| Diagram | Editable input |
| --- | --- |
| Contract integration | [contracts.architecture.json](contracts.architecture.json) |
| Purchase sequence | [purchase.sequence.json](purchase.sequence.json) |
| Claim sequence | [claim.sequence.json](claim.sequence.json) |

The HTML views are regenerated from these files with the `archify` skill. Chain reads were read-only; no wallet signatures, contract writes or deployments were performed.
