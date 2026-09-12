# APIritivo technical guide

[← README](../README.md) · Detailed implementation notes and demo walkthrough.

**A machine-readable service marketplace. Everyone signs in with Swarm ID, clients pay with their browser wallet, manifests on Swarm, registry on Arkiv, payments in USDC on Avalanche.**

Built at **ETH Rome 2026**. Providers publish APIs that machines can understand; clients (humans or agents) discover them, pay for timed access, and call them with an on-chain access pass. No accounts, no API keys to manage, no database: every listing, manifest, pass and receipt is a public entity anyone can open in the Arkiv Data Explorer.

- Repo: https://github.com/pf55351/apiritivo-eth-26
- Stack: Swarm ID · Swarm · Arkiv (Tiramisu) · Avalanche Fuji (USDC) · ENS (Sepolia, read-only) · Next.js 15 · Bun · Foundry

---

## The problem

Agents and scripts cannot "sign up" for an API. Discovery is scattered across docs, credentials are copied around, and payment means a card and a dashboard. Providers, on their side, need a backend, a billing system and a key store before selling anything.

## The idea

Split the problem across three decentralised primitives, each doing the one thing it is good at:

| Layer | Answers | Powered by |
| --- | --- | --- |
| **Identity** | who are you? | **Swarm ID** for providers and clients — login without seed phrase in the app; the provider's payout EVM wallet and the client's pass encryption key are *derived* from the identity. A **browser wallet** (MetaMask, Rabby, Core) only pays for the client |
| **Capability** | how does a machine call this service? | **Swarm** — immutable technical manifest (`operations`, typed inputs, endpoint) referenced by hash |
| **Registry** | what services exist, at what price, for how long, who bought them? | **Arkiv** — queryable entities: permanent listings, expiring access passes, permanent sale receipts |
| **Money** | how do I pay, how do I get paid? | **Avalanche Fuji** — USDC through the `APIritivoPayments` contract (pull payments, `claim`), or a direct transfer when no contract is configured |

### The access pass

An access pass is an **Arkiv entity with a TTL**. When it expires, Arkiv deletes it and the service stops answering. Nothing to revoke, nothing to store.

Its entity key is public (anyone can list passes in the explorer), so the key alone is not the credential. At purchase the buyer's browser generates a random 32-byte secret:

- the pass stores `secret_hash = keccak256(secret)` as a plain attribute;
- the secret itself goes in the payload encrypted (AES-256-GCM) under a key only the buyer's Swarm ID can re-derive, `deriveAppSecret("apiritivo:pass-crypt:v1")`. The buyer recovers it on any device where that identity is signed in and nobody else can;
- the API key presented to a service is `<passKey>.<secret>`.

A service checks a call with one Arkiv read: does the entity still exist, is it for me, does `keccak256(secret)` match? Three lines in `verifyAccessPass`.

Calling a service you bought, from anywhere (copy the API key from the service page or `/passes`):

```bash
bun call:service <serviceId> "<passKey>.<secret>" getQuote '{"symbol":"BTC"}'
# or: curl -s http://localhost:3000/api/gateway/<serviceId> -H 'authorization: Bearer <passKey>.<secret>' \
#        -H 'content-type: application/json' -d '{"operation":"getQuote","input":{"symbol":"BTC"}}'
```

Without the secret the gateway answers `401`, with a wrong one `403`.

## How it works

```text
PROVIDER (Swarm ID)                                CLIENT (Swarm ID, pays with MetaMask / Rabby / Core)
   │                                                   │
   ├─ form: name, category, price, duration,           ├─ browse marketplace ── query ──▶ Arkiv
   │        payout wallet, operations                  │
   ├─ manifest ── uploadData ──▶ Swarm ── ref ──┐      ├─ open service ── downloadData(ref) ──▶ Swarm
   │                                            ▼      │
   └─ POST /api/services ── createEntity ──▶ Arkiv     ├─ buy access ── approve + buy() ──▶ APIritivoPayments (Fuji)
                (service, permanent)                   │      ├─ Swarm ID deriveAppSecret → key that seals the pass secret; wallet signs the claim
                                                       │      └─ POST /api/access-passes: verify Purchased event on Fuji
   ┌─ dashboard: API cards, sales receipts from Arkiv   │         ── createEntity ──▶ Arkiv  access_pass (expires) + sale (permanent)
   ├─ Claim USDC ── claim() ──▶ contract                └─ call service:  Authorization: Bearer <passKey>.<secret>
   └─ Send USDC ── transfer ──▶ anywhere                       └─ bot or gateway: getEntity(passKey) on Arkiv + hash check → answer
```

### What is real in the demo

- **Swarm ID** login for providers, `deriveAppSecret` → per-identity EVM wallet ("Swarm wallet", the payout address) and a separate per-identity encryption key for pass secrets; `uploadData` / `downloadData` for manifests through the public gateway, with a subsidised gateway so identities without a postage stamp can publish. If the browser blocks the Swarm ID popup, the sign-in card says so and offers a retry.
- **Browser wallet** as the client's payment method (`lib/injected-wallet.tsx`): EIP-1193 connection, silent reconnect, network switch to Fuji. It signs `approve`, `buy` and the pass claim; `buyer_address` is its address. The identity stays the Swarm ID: `buyer_id` is the Swarm identity id, its derived key seals the pass secret and its sharing key is attached to every sale so the provider can grant private files.
- **Swarm drives**: identities that own a postage stamp upload with it (`uploadMode = user-stamp`); the provider dashboard shows the drive Swarm ID resolved for the app (`getPostageBatch` → label, batch id, % used, prepaid time left, ⚠ under 7 days) with a link to Swarm ID's Storage tab. Otherwise the app falls back to the subsidised gateway.
- **Arkiv (Tiramisu)**: listings, passes and receipts are live entities created by an app-owned writer; every screen, the bot and the gateway read Arkiv directly, no cache, no database. Every entity link in the UI opens the **Arkiv Data Explorer** with the exact query. See [Live from Arkiv](#live-from-arkiv) and [Verify it yourself](#verify-it-yourself-on-arkiv).
- **Avalanche Fuji**: real USDC from the buyer's wallet, verified server-side from the transaction before a pass is minted. The provider dashboard watches Fuji logs and shows a sale the moment it lands, before Arkiv has the receipt.
- **Contract**: `contracts/src/APIritivoPayments.sol`, a pull-payment ledger (`buy`, `claim`, per-service and per-provider revenue, events), 28 Foundry tests. **Deployed on Avalanche Fuji at [`0x4e98f464dc8c667e3b0fd3092e0f2d4585702fa3`](https://testnet.snowtrace.io/address/0x4e98f464dc8c667e3b0fd3092e0f2d4585702fa3)** (fee 0 bps, USDC `0x5425890298aed601595a70AB815c96711a31Bc65`). `.env.example` ships with this address, so the app runs in contract mode out of the box. Empty the variable to fall back to direct USDC transfers.
- **Bot + gateway**: `POST /api/bot/<serviceId>` answers only to a valid pass (live prices for `getQuote`); `POST /api/gateway/<serviceId>` verifies the pass and forwards to the `endpoint` in the provider's manifest, so a provider needs zero auth code. The publish form does not expose `endpoint` yet, so gateway calls fall back to the demo bot.

---

## Quick start

```bash
bun install
cp .env.example apps/web/.env.local     # writer key, gateways and contract address are pre-filled for testnet
bun demo:check                          # Arkiv writer funded? gateway up? Fuji + contract ok?
bun dev                                 # http://localhost:3000
```

Other commands: `bun typecheck · bun lint · bun check:fix · bun test · bun run build · bun test:contracts · bun build:contracts · bun call:service`. `bun lint` runs Biome (`biome.json` at the root) before ESLint; `bun check:fix` formats and applies safe fixes. (`bun build` alone invokes Bun's bundler, use `bun run build`.) Do not run `bun run build` while `bun dev` is open: both write to `apps/web/.next`. If the dev server starts throwing `ENOENT … .next/…`, stop it, delete `apps/web/.next` and start it again.

### Environment

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SWARM_ID_IFRAME_ORIGIN` | browser | Swarm ID origin (`https://swarm-id.snaha.net`) |
| `NEXT_PUBLIC_SWARM_ID_APP_NAME` | browser | App name shown in the Swarm ID popup (`APIritivo`) |
| `NEXT_PUBLIC_SWARM_GATEWAY_URL` | browser + server | Public Bee API for manifest links, download fallback and the gateway route (`https://api.gateway.ethswarm.org`) |
| `NEXT_PUBLIC_SWARM_SUBSIDISED_GATEWAY_URL` | browser | Subsidised gateway passed to Swarm ID so identities without a stamp can upload (`off` to disable) |
| `NEXT_PUBLIC_ARKIV_RPC_URL`, `ARKIV_RPC_URL` | browser / server | Optional Arkiv RPC overrides (default: Tiramisu public RPC) |
| `NEXT_PUBLIC_ARKIV_WRITER_ADDRESS` | browser + server | The only Arkiv owner the app trusts when reading. Defaults to the shipped writer; must match `ARKIV_WRITER_PRIVATE_KEY` |
| `ARKIV_WRITER_PRIVATE_KEY` | **server** | App-owned Arkiv writer. Needs testnet GLM: https://hub.arkiv.network/faucet |
| `AVALANCHE_FUJI_RPC_URL` | server | Optional Fuji RPC override for payment verification |
| `NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS` | browser + server | `APIritivoPayments` on Fuji. Empty = direct USDC transfers. Changing it needs a `bun dev` restart |
| `NEXT_PUBLIC_ENS_CHAIN` | browser + server | ENS chain for linked names: `sepolia` (default) or `mainnet` |
| `NEXT_PUBLIC_ENS_RPC_URL`, `ENS_RPC_URL` | browser / server | Optional ENS RPC overrides (default: the chain's public RPC) |

Test funds: [Arkiv GLM](https://hub.arkiv.network/faucet) for the writer, [AVAX](https://core.app/tools/testnet-faucet/) (gas) and [USDC](https://faucet.circle.com/) on Fuji for the buyer's wallet and for the provider's Swarm wallet (claim gas).

---

Testing from scratch as a judge? Follow [docs/JUDGE-WALKTHROUGH.txt](../docs/JUDGE-WALKTHROUGH.txt): identities, faucets, creator flow, buyer flow, verification, claim.

## Demo script (≈5 minutes)

Before going on stage: `bun demo:check`. One browser and one Swarm ID are enough: the header switch moves between **provider** and **client** (it signs out and asks for Swarm ID again, so count one extra login per switch), and MetaMask or Rabby on Fuji pays as the client. Marketplace and service pages need a signed-in Swarm ID. The provider's Swarm wallet needs a little AVAX for the claim; the client's browser wallet needs AVAX and USDC (service page → *Fund wallet* → faucet links). The readiness pill in the bottom right corner says what is missing for the active account.

| # | Screen | Do | Say |
| --- | --- | --- | --- |
| 1 | `/` (provider view) | **Enter with Swarm ID** | "Provider identity is Swarm ID. No wallet, no seed phrase in the app." |
| 2 | header switch | **Provider**, then **Enter with Swarm ID** again | "Two workspaces, one identity: every workspace starts with a Swarm ID login. Swarm ID publishes and buys; a browser wallet only pays." |
| 3 | `/provider` | Show the API cards and, in the account menu, the wallet (address, balances) and connection rows (Swarm ID, **drive** with % used and time left, Arkiv writer + GLM). *Sales → Payment activity* holds Claim, Send USDC and **Reveal private key** | "Storage is the user's own Swarm drive, or a subsidised gateway. The wallet is derived from the Swarm ID: same identity, same address everywhere. Exportable to MetaMask." |
| 4 | `/provider/new` | Name, category, 0.50 USDC, 7 days, operation `getQuote(symbol: string)`; payout is your Swarm wallet. Publish. | "Manifest to Swarm, listing to Arkiv, in that order. Price and payout live on Arkiv; payout is the wallet derived from my Swarm ID." |
| 5 | success | Open **Swarm gateway** and **Arkiv** links | "Raw bytes on Swarm. The listing opens in the Arkiv Data Explorer with its `$key = key(…)` query, the tx on the Tiramisu block explorer." |
| 6 | header switch → `/marketplace` | **Client**, sign in with Swarm ID again, open the service, **Connect wallet to pay** | "Same Swarm ID, now as a client. The wallet appears only at checkout: it is my everyday wallet, it just pays. Cards are live Arkiv queries." |
| 7 | service page | **Buy access**; watch approve → buy → confirm → mint, plus one signature | "USDC into the payments contract on Avalanche; the server verifies the `Purchased` event and mints an expiring pass on Arkiv. The API key is the pass key plus a secret sealed under a key only this wallet can re-derive." |
| 8 | `/passes` | Under the pass, **Try API**: `getQuote` / `BTC` → *Pass verified on Arkiv ✓* | "The service page only describes the API. Every answer starts with a read of the pass entity and a hash check. Expired = deleted = denied." |
| 9 | `/passes` | Pass with time left, **Show credentials**, **Arkiv** link | "Client side, every pass is inspectable on-chain, secret excluded." |
| 10 | `/provider` (provider) | The sale toast, recorded sales and revenue, **Sales receipts** with **Sale receipt on Arkiv** | "The sale shows up from Fuji logs first, then Arkiv has the permanent receipt with `buyer_id`, `buyer_address` and `tx_hash`. That is how you prove who bought what." |
| 11 | wallet section | **Claim USDC**, then **Send USDC** to any address | "Two steps, two signatures from the Swarm wallet key: pull earnings out of the contract, then move them wherever you like." |

Fallbacks: Swarm ID upload failing → automatic direct gateway upload; short on USDC → faucet links inside *Fund wallet*; wrong network → the wallet menu offers **Switch**; contract mode off → purchases become direct transfers and the claim block disappears.

---

## Money flow

The contract knows nothing about Swarm IDs. It keeps a ledger **by EVM address**:

```solidity
mapping(address => uint256) public claimable;      // provider address => USDC withdrawable now
mapping(address => uint256) public totalEarned;    // provider address => lifetime net revenue
mapping(bytes32 => uint256) public serviceRevenue; // keccak256(serviceId) => net revenue
```

1. **Publish.** The payout wallet is the address derived from the provider's Swarm ID. It is shown in the form, not editable, and stored on Arkiv as `payout_address`.
2. **Buy.** The client's browser wallet (MetaMask, Rabby, Core) calls `approve` then `buy(payout_address, keccak256(serviceId), amount, accessSeconds)`. USDC moves from the buyer into the contract; `claimable[payout_address]` grows by the net amount. `Purchased` is emitted.
3. **Claim.** In the provider dashboard, *Claim USDC* sends `claim(swarmWallet, 0)` signed by the Swarm wallet key (the key is in memory, no extension, no popup). The contract checks `msg.sender`, zeroes the balance and transfers USDC to the Swarm wallet. Gas is paid in AVAX by the Swarm wallet.
4. **Send.** *Send USDC* is a plain USDC `transfer`, again signed by the Swarm wallet, to MetaMask or any address.

Because the derivation is deterministic (same identity, same label, same origin → same key), the identity that published is the only one that can claim, on any device. The wallet panel can also reveal the private key for use outside APIritivo.

Without a contract address the app runs in **direct mode**: `buy` becomes a USDC `transfer` straight to `payout_address`, the server verifies the `Transfer` log instead of the event, and step 3 does not exist.

---

## Architecture

[Client workflow](../docs/architecture/client.html) · [Provider workflow](../docs/architecture/provider.html) · [Role responsibilities](../docs/architecture/role-workflows.md)

[Open the interactive backend architecture view](../docs/architecture/backend.html) · [Backend routes, data flows and trust model](../docs/backend-architecture.md)

[Technical contract map](../docs/architecture/contracts.html) · [Purchase sequence](../docs/architecture/purchase.html) · [Claim sequence](../docs/architecture/claim.html) · [Contract addresses and call reference](../docs/architecture/technical-reference.md)

```text
apps/web            Next.js UI + 5 API routes (services, access-passes, grants, bot, gateway); lib/injected-wallet.tsx (client payment wallet), lib/identity.ts (Swarm ID plus paying account per view), lib/readiness.ts (account checks)
packages/shared     Zod schemas: manifest, service, access pass, sale, grant; role helpers
packages/swarm      Swarm ID adapter: login, upload/download manifests, derive wallet + pass-encryption keys, ACT private files, read the drive
packages/arkiv      Arkiv adapter: typed reads (browser/server), block timing, pass secrets, Data Explorer links, server writer (service, pass, sale, grant), verifyAccessPass
packages/payments   Fuji/USDC: signers (Swarm wallet, injected wallet), pass key message + signature-derived key, pay/claim/send, on-chain verification, contract ABI
packages/ens        Read-only ENS: resolve addr / text / contenthash, verify a linked name against a service
contracts           Foundry: src/APIritivoPayments.sol + 28 tests + deploy script (deployed on Fuji)
tools               bun demo:check (readiness), bun call:service (call a bought API by service id or ENS name)
```

Each package has its own README. Vendor SDKs never leak into React components.

### Data on Arkiv

Attribute names are snake_case: the Tiramisu engine rejects uppercase letters even though the SDK's local validator accepts them.

```json
{ "app": "apiritivo", "entity_type": "service", "service_id": "market-data-a81f", "category": "market-data",
  "provider_id": "<swarm id>", "provider_name": "…", "available": true, "version": 1,
  "manifest_ref": "<swarm ref>", "price_usdc": "0.50", "access_seconds": 604800, "payout_address": "0x…" }
```

| Entity | Attributes | Payload | Lifetime |
| --- | --- | --- | --- |
| `service` | above | `name`, `description` | permanent |
| `access_pass` | `service_id`, `provider_id`, `buyer_id`, `buyer_address`, `tx_hash`, `paid_usdc`, `chain_id`, `secret_hash` | `serviceName`, `purchasedAt`, `encryptedSecret` | expires after `access_seconds` |
| `sale` | same as the pass minus `secret_hash`, plus `pass_key` | `serviceName`, `purchasedAt` | permanent |
| `grant` | `service_id`, `provider_id`, `buyer_id`, `buyer_pubkey`, `act_history_ref`, `act_enc_ref`, `act_pubkey` | `grantedAt` | permanent |

`buyer_id` is the lowercase wallet address for wallet buyers (a Swarm ID id for Swarm buyers). Passes and sales also carry `buyer_pubkey` (the buyer's Swarm sharing key, only when Swarm ID was signed in at purchase) and a service may carry `private_name`, `private_bytes`, `private_type`, `private_enc_ref`, `private_history_ref`, `private_pubkey` when it has a private file (next section).

### Private files with Swarm ACT (optional)

A provider can attach one file (docs, examples, a data sample, up to 512 KB) when publishing. It is uploaded with Swarm's **Access Control Trie** (`actUploadData`): encrypted, readable only by the publisher and the keys it grants. The references on Arkiv are public and harmless: without being a grantee they decrypt nothing. A purchase records the buyer's Swarm sharing key on the pass and the sale when the buyer is also signed in with Swarm ID (the wallet menu offers the sign-in; it is the only client feature that needs it). In the provider dashboard, **File access → Grant access** runs `actAddGrantees` in the provider's browser (only the publisher can) and posts the resulting history reference to `POST /api/grants`, which writes a permanent `grant` entity; the newest grant is the live access list. On the service page a granted buyer with an active pass downloads and decrypts the file with their own Swarm ID (`actDownloadData`). No shared key ever travels; access is per identity. Revocation (`actRevokeGrantees`) is not wired yet.

### Manifest on Swarm

```json
{ "v": 1, "endpoint": "https://your-bot.example/api", "operations": { "getQuote": { "input": { "symbol": "string" } } } }
```

`endpoint` is optional. The publish form only builds `operations` today; without an endpoint the gateway answers with the demo bot.

### Live from Arkiv

There is no database and no cache: every number on screen is an Arkiv query made when the page opens (and on **Refresh**). Reads go through the public Tiramisu RPC with `createPublicClient`; only writes need the server. All queries are scoped with `app = "apiritivo"` and an `entity_type`, paginated 100 entities per page (max 20 pages).

| Where | Arkiv read | Shown as |
| --- | --- | --- |
| `/marketplace` | `service` where `available = true`, newest creation block first, one entry per `service_id` (highest `version` wins) | Service cards: name, category, price, duration, provider, manifest link |
| `/services/<id>` | `service` where `service_id = <id>`, then `downloadData(manifest_ref)` on Swarm | Listing + decoded manifest (operations, typed inputs, endpoint) |
| `/services/<id>` (signed in) | `access_pass` where `service_id` and `buyer_id` match, plus `getBlockTiming()` | Your live pass for this service with a countdown; the page stays descriptive (no Try API, no file download) |
| `/passes` | `access_pass` where `buyer_id = you`, sorted by expiry block, plus `getBlockTiming()`; per pass the `service` and its manifest, and the `grant` for your Swarm ID key | Time left per pass (`(expires_at_block − current_block) × block_duration`), API key, **Try API**, private file download once granted, explorer and payment-tx links |
| `/provider` | `service` where `provider_id = you` (available or not) and `sale` where `provider_id = you`; refreshed when the Fuji watcher sees a new `Purchased` / `Transfer` | Published services, revenue = Σ `paid_usdc` of the permanent receipts, earnings per service, recent sales with buyer and tx |
| `/provider` connection details, readiness pill | `GET /api/services` → writer address and native GLM balance from the Tiramisu RPC | "Arkiv writer ✓ / unfunded / not configured" with faucet, balance and Data Explorer links |
| `POST /api/bot/<id>`, `POST /api/gateway/<id>` | `getEntity(<passKey>)` + `getBlockTiming()` + `keccak256(secret)` vs `secret_hash` | **Pass verified on Arkiv ✓** with expiry block and seconds left, or `401` / `403`. Expired passes are gone from Arkiv, so "not found" is "no access" |
| `POST /api/access-passes` | `sale` where `tx_hash = <payment tx>` before minting | Replay protection: one payment, one pass |
| `bun demo:check` | counts of `service` and `access_pass` entities, services missing `payout_address`, writer balance | Pre-stage report |

Expiry is block-based: a pass is written with `ExpirationTime` = `access_seconds`, Arkiv converts it to a block and deletes the entity when the chain passes it. The UI never stores an expiry timestamp; it derives the countdown from the chain's current block and block duration at read time, so what you see is what the bot enforces.

### Verify it yourself on Arkiv

Every Arkiv link in the app opens the [Arkiv Data Explorer](https://data.arkiv.network/?chain=tiramisu) with a query, pinned to Tiramisu:

| Question | Query in the explorer |
| --- | --- |
| Is this listing / pass / receipt real? | `$key = key(0x<entity key>)` |
| Everything APIritivo ever wrote | `$owner = addr(0x401629d4c1A4C1A0Ffd14A089f798Dd29A94c09C)` (the app writer) |

To answer **"who bought this service?"** open a `sale` receipt: `buyer_id` is the buyer's identity (the wallet address, or a Swarm ID id for older Swarm purchases), `buyer_address` the wallet that paid, `tx_hash` the Fuji transaction (linked to Snowtrace), `pass_key` the pass that was minted. Receipts are permanent, so revenue history survives pass expiry. Transactions and address balances on Tiramisu itself live on the [block explorer](https://tiramisu.explorer.arkiv.network); the app links there for Arkiv tx hashes and the writer's GLM balance.

Note: Tiramisu is a testnet and has been reset before. If `bun demo:check` reports 0 services while the marketplace used to be full, publish again; nothing in the app assumes old entities exist.

### Trust boundary (hackathon)

The Arkiv writer is app-owned (`ARKIV_WRITER_PRIVATE_KEY`) and it is the only owner the app reads: every query filters by that address and every parser refuses entities from another owner, so forged listings, passes or receipts written by someone else with faucet GLM are invisible. `provider_id` comes from the caller's Swarm ID session and is not signed. The buyer **is** proven: the paying wallet signs the pass claim (tx hash + secret hash + optional file key) and the server verifies that signature, then the payment on-chain (`Purchased` event in contract mode, USDC `Transfer` in direct mode, one purchase per tx, duration matching the listing), the paying wallet must match `buyer_address`, and a tx can be used once because pass and receipt land in one Arkiv transaction. The pass secret is generated and encrypted in the buyer's browser: the server stores `secret_hash` and the ciphertext and never sees the secret. Write routes are rate limited per IP, publishing checks the manifest on Swarm first, and the gateway only calls public https endpoints. Going fully trustless means signing publish requests with the Swarm-derived key and minting passes from the contract; the entity layout already allows it.

### Contract

`APIritivoPayments` (Solidity 0.8.26): `buy(provider, keccak(serviceId), amount, accessSeconds)` pulls USDC and credits the provider (optional fee ≤ 10%), `claim(to, amount)` withdraws (`0` = everything), `claimable` / `totalEarned` / `serviceRevenue` / `getPurchases` expose revenue, every purchase emits `Purchased` and every withdrawal `Claimed`. No pause, no upgrade: what is deposited can always be claimed. Invariant: contract balance = Σ claimable + fees. Tests cover accounting, fees, pagination, fuzzing, `false`-returning and no-return tokens, reentrancy. See `contracts/README.md`.

---

## Lessons from the build

- Arkiv attribute names must be lowercase on the wire; the SDK's local validator is more permissive than the chain.
- An Arkiv entity key is public. Anything that acts as a credential needs a secret next to it; store the hash on-chain and encrypt the secret for its owner.
- Swarm ID identities without a postage stamp can still upload if the dApp passes a **subsidised gateway** (what the official demo does). `Swarm-Pin` is not on the gateway's CORS allow-list, so `pin: true` fails as "Failed to fetch".
- `deriveAppSecret` turns any Swarm ID into deterministic key material: one label for the EVM wallet, a different label for encryption, so the wallet key never doubles as a cipher key. The wallet label stays `apiperitivo:wallet:v1` after the rename so existing addresses do not move.
- The pass secret is sealed with the Swarm ID's derived key, never with the paying wallet, so a buyer can change wallets and keep the passes. Swarm ID secrets are scoped to the page origin, so the derived wallet and pass key differ per domain; a MetaMask address does not.
- A payments contract only needs addresses. The Swarm ID ↔ wallet link lives entirely in the deterministic derivation, which is why the same identity can claim from any device.
- Mount the Swarm ID iframe once in a hidden container and let the user click the SDK's own button: the popup must keep the iframe as opener, or session handover breaks in browsers with partitioned storage.
- A dApp cannot pick a postage stamp: Swarm ID resolves one drive per app and `getPostageBatch` only reads it. Show it (label, % used, TTL) and send users to Swarm ID → Storage to add or renew drives.
- Bee's stamp usage is `utilization / 2^(depth − bucketDepth)`, not `utilization / 2^depth`.
- Block-based expiry means "time left" must be computed from `getBlockTiming()` at read time, never stored.
- The Data Explorer's own "copy link" format is `/?q=<query>&chain=<name>`; generating the same URL makes every proof chip a reproducible query rather than a page that may move.
- Next.js `dev` and `build` share `.next`. Running both at once corrupts the manifests.

## Roadmap

- Sign publish requests with the Swarm wallet and purchase requests with the buyer wallet; mint passes from the contract.
- Attach a Swarm ID key to a wallet-bought pass after purchase, so private files can be granted later.
- Agent SDK: one `fetch` wrapper that discovers on Arkiv, pays, and calls with `<passKey>.<secret>`.
- Per-service payout addresses and platform fee > 0 on a mainnet deployment.
- Provider analytics, categories curation.
