# 🍹 APIperitivo

**A machine-readable service marketplace. Identity by Swarm ID, manifests on Swarm, registry on Arkiv, payments in USDC on Avalanche.**

Built at **ETH Rome 2026**. Providers publish APIs that machines can understand; clients (humans or agents) discover them, pay for timed access, and call them with an on-chain access pass. No accounts, no API keys to manage, no database: every listing, manifest, pass and receipt is public and verifiable.

- Repo: https://github.com/pf55351/apiritivo-eth-26
- Stack: Swarm ID · Swarm · Arkiv (Tiramisu) · Avalanche Fuji (USDC) · Next.js 15 · Bun · Foundry

---

## The problem

Agents and scripts cannot "sign up" for an API. Discovery is scattered across docs, credentials are copied around, and payment means a card and a dashboard. Providers, on their side, need a backend, a billing system and a key store before selling anything.

## The idea

Split the problem across three decentralised primitives, each doing the one thing it is good at:

| Layer | Answers | Powered by |
| --- | --- | --- |
| **Identity** | who are you? | **Swarm ID** — login without wallet or seed phrase in the app; an EVM wallet is *derived* from the identity |
| **Capability** | how does a machine call this service? | **Swarm** — immutable technical manifest (`operations`, typed inputs, endpoint) referenced by hash |
| **Registry** | what services exist, at what price, for how long? | **Arkiv** — queryable entities: listings, expiring access passes, permanent sale receipts |
| **Money** | how do I pay? | **Avalanche Fuji** — USDC straight to the provider (direct transfer today, `APIperitivoPayments` contract ready to deploy) |

The **access pass is an Arkiv entity with a TTL**. Its entity key is the API key. A service checks a call in one read: does that entity still exist, and is it for me? When it expires, Arkiv deletes it and the service stops answering. Nothing to revoke, nothing to store.

## How it works

```text
PROVIDER (Swarm ID)                               CLIENT (Swarm ID)
   │                                                  │
   ├─ form: name, category, price, duration,          ├─ browse marketplace  ── query ──▶ Arkiv
   │        payout wallet, operations                 │
   ├─ manifest ── uploadData ──▶ Swarm ── ref ──┐     ├─ open service ── downloadData(ref) ──▶ Swarm
   │                                            ▼     │
   └─ POST /api/services ── createEntity ──▶ Arkiv    ├─ buy access ── USDC ──▶ provider wallet / contract (Fuji)
                (service, permanent)                  │        └─ POST /api/access-passes: verify tx on Fuji
                                                      │           ── createEntity ──▶ Arkiv  access_pass (expires) + sale (permanent)
                                                      │
                                                      └─ call service with  Authorization: Bearer <passKey>
                                                                └─ service/gateway: getEntity(passKey) on Arkiv → answer
```

### What is real in the demo

- **Swarm ID** login, role choice, `deriveAppSecret` → per-identity EVM wallet ("Swarm wallet"), `uploadData` / `downloadData` for manifests through the public gateway (with a subsidised gateway so identities without a postage stamp can publish).
- **Arkiv (Tiramisu)**: listings, passes and receipts are live entities created by an app-owned writer; the marketplace, the dashboard and the bot read Arkiv directly, no cache.
- **Avalanche Fuji**: real USDC transfers from the Swarm wallet (or MetaMask), verified server-side from the receipt before a pass is minted.
- **Bot + gateway**: `POST /api/bot/<serviceId>` answers only to a valid pass (live prices for `getQuote`); `POST /api/gateway/<serviceId>` verifies the pass and forwards to the provider's own endpoint, so a provider needs zero auth code.
- **Contract**: `contracts/src/APIperitivoPayments.sol` — pull-payment ledger (`buy`, `claim`, per-service and per-provider revenue, events), 28 Foundry tests. Written and tested, **not deployed yet**; the app switches to contract mode the moment `NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS` is set, and the "On-chain payments" panels show address, counters and purchases with Snowtrace links.

---

## Quick start

```bash
bun install
cp .env.example apps/web/.env.local     # writer key + gateways are pre-filled for testnet
bun demo:check                          # Arkiv writer funded? gateway up? Fuji ok?
bun dev                                 # http://localhost:3000
```

Other commands: `bun typecheck · bun lint · bun test · bun build · bun test:contracts`.

### Environment

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SWARM_ID_IFRAME_ORIGIN` | browser | Swarm ID origin (`https://swarm-id.snaha.net`) |
| `NEXT_PUBLIC_SWARM_GATEWAY_URL` | browser + server | Public Bee API for manifest links, download fallback and the gateway route (`https://api.gateway.ethswarm.org`) |
| `NEXT_PUBLIC_SWARM_SUBSIDISED_GATEWAY_URL` | browser | Subsidised gateway passed to Swarm ID so identities without a stamp can upload (`off` to disable) |
| `NEXT_PUBLIC_ARKIV_RPC_URL`, `ARKIV_RPC_URL` | browser / server | Optional Arkiv RPC overrides (default: Tiramisu public RPC) |
| `ARKIV_WRITER_PRIVATE_KEY` | **server** | App-owned Arkiv writer. Needs testnet GLM: https://hub.arkiv.network/faucet |
| `AVALANCHE_FUJI_RPC_URL` | server | Optional Fuji RPC override for payment verification |
| `NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS` | browser + server | Empty = direct USDC transfers. Set after deploying `APIperitivoPayments` |

Test funds: [Arkiv GLM](https://hub.arkiv.network/faucet) for the writer, [AVAX](https://core.app/tools/testnet-faucet/) (gas) and [USDC](https://faucet.circle.com/) on Fuji for the Swarm wallets.

---

## Demo script (≈5 minutes)

Before going on stage: `bun demo:check`. Two browser profiles: one Swarm ID as **provider**, one as **client**, each with a little AVAX and USDC on Fuji in its Swarm wallet (dashboard → *Your Swarm wallet* → faucet links).

| # | Screen | Do | Say |
| --- | --- | --- | --- |
| 1 | `/` | **Enter with Swarm ID** | "Identity is Swarm ID. No wallet, no seed phrase in the app." |
| 2 | role chooser | **I'm a Provider** | "A preference per identity, not access control." |
| 3 | `/provider` | Show *Your Swarm wallet*: address, balances, **Reveal private key** | "An EVM wallet derived from the Swarm ID. Same identity, same address everywhere. Exportable to MetaMask." |
| 4 | `/provider/new` | Name, category, 0.50 USDC, 7 days, Swarm wallet as payout, operation `getQuote(symbol: string)`. Publish. | "Manifest to Swarm, listing to Arkiv, in that order. Price and payout live on Arkiv." |
| 5 | success | Open **Swarm gateway** and **Arkiv explorer** links | "Raw bytes on Swarm, entity and tx on Tiramisu." |
| 6 | `/marketplace` (client) | Open the service | "Cards are live Arkiv queries." |
| 7 | service page | **Buy access** from the Swarm wallet; watch pay → confirm → mint | "USDC on Avalanche to the provider; the server verifies the transfer and mints an expiring pass on Arkiv. The pass key is the API key." |
| 8 | same page | **Try the bot**: `getQuote` / `BTC` → *Pass verified on Arkiv ✓* | "Every answer starts with a read of the pass entity. Expired = deleted = denied." |
| 9 | `/passes` | Pass with time left | "Client side, every pass is inspectable on-chain." |
| 10 | `/provider` (provider) | Earnings, recent sales, wallet +0.50 USDC, **Withdraw** to MetaMask | "Revenue = permanent sale receipts on Arkiv; funds are in the provider's own wallet." |
| 11 | on-chain panel | Contract panel (placeholder or live) | "Foundry contract, tested: buy/claim ledger, revenue per service readable on-chain." |

Fallbacks: Swarm ID upload failing → automatic direct gateway upload; short on USDC → faucet link inside the buy panel.

---

## Architecture

```text
apps/web            Next.js UI + 4 API routes (services, access-passes, bot, gateway)
packages/shared     Zod schemas: manifest, service, access pass, sale; helpers
packages/swarm      Swarm ID adapter: login, upload/download manifests, derive wallet secret
packages/arkiv      Arkiv adapter: typed reads (browser/server) + server writer + verifyAccessPass
packages/payments   Fuji/USDC: signers (Swarm wallet, MetaMask), pay/claim/withdraw, on-chain verification, contract ABI
contracts           Foundry: APIperitivoPayments.sol + 28 tests + deploy script
tools               bun demo:check
```

Each package has its own README. Vendor SDKs never leak into React components.

### Data on Arkiv (attribute names are snake_case, the chain rejects uppercase)

```json
{ "app": "apiperitivo", "entity_type": "service", "service_id": "market-data-a81f", "category": "market-data",
  "provider_id": "<swarm id>", "provider_name": "…", "available": true, "version": 1,
  "manifest_ref": "<swarm ref>", "price_usdc": "0.50", "access_seconds": 604800, "payout_address": "0x…" }
```

`access_pass` carries `buyer_id`, `buyer_address`, `tx_hash`, `paid_usdc`, `chain_id` and **expires after `access_seconds`**; `sale` is the same, permanent, plus `pass_key`.

### Manifest on Swarm

```json
{ "v": 1, "endpoint": "https://your-bot.example/api", "operations": { "getQuote": { "input": { "symbol": "string" } } } }
```

### Trust boundary (hackathon)

The Arkiv writer is app-owned (`ARKIV_WRITER_PRIVATE_KEY`); `provider_id` / `buyer_id` come from the caller's Swarm ID session and are not signed. Payments **are** verified on-chain before a pass is minted (USDC `Transfer`, or `Purchased` event in contract mode) and a tx can be used once. Going trustless means signing publish/purchase requests with the Swarm-derived key and minting passes from the contract; the entity layout already allows it.

### Contract

`APIperitivoPayments` (Solidity 0.8.26): `buy(provider, keccak(serviceId), amount, accessSeconds)` pulls USDC and credits the provider (optional fee ≤ 10%), `claim(to, amount)` withdraws, `totalEarned` / `serviceRevenue` / `getPurchases` expose revenue, every purchase emits `Purchased`. Invariant: contract balance = Σ claimable + fees. Tests cover accounting, fees, pagination, fuzzing, `false`-returning and no-return tokens, reentrancy. See `contracts/README.md` for deploy.

---

## Lessons from the build

- Arkiv attribute names must be lowercase on the wire; the SDK's local validator is more permissive than the chain.
- Swarm ID identities without a postage stamp can still upload if the dApp passes a **subsidised gateway** (what the official demo does). `Swarm-Pin` is not on the gateway's CORS allow-list, so `pin: true` fails as "Failed to fetch".
- `deriveAppSecret` turns any Swarm ID into a deterministic EVM wallet: no wallet extension needed to pay or to get paid.
- Mount the Swarm ID iframe in a hidden container, or it renders its own login widget.

## Roadmap

- Deploy `APIperitivoPayments` on Fuji and switch to contract mode.
- Sign publish/purchase requests with the Swarm wallet; mint passes from the contract.
- Agent SDK: one `fetch` wrapper that discovers on Arkiv, pays, and calls with the pass.
- Provider analytics, categories curation, mainnet.
