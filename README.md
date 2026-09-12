# APIperitivo — Phase 1

APIperitivo is a machine-readable service marketplace.

> **Status:** Phase 1 done, Phase 2 (paid access) implemented: clients pay USDC on Avalanche Fuji straight to the provider's wallet, the server verifies the transfer on-chain and mints an expiring **access pass** entity on Arkiv. A demo bot answers only to a valid, non-expired pass. No smart contract yet.

## Phase 2 — paid access (implemented)

```text
Client (Swarm ID) → picks service → Connect wallet (MetaMask/Core) → USDC transfer to provider payout_address on Fuji
   → POST /api/access-passes { serviceId, buyerId, buyerAddress, txHash }
   → server verifies receipt + USDC Transfer log (to = payout, amount ≥ price, tx unused)
   → Arkiv: create `access_pass` (expires after access_seconds) + permanent `sale` receipt
   → pass entity key = the client's API key
Bot: POST /api/bot/<serviceId>  Authorization: Bearer <passKey>
   → getEntity(passKey) on Arkiv: must exist (Arkiv deletes expired entities), entity_type=access_pass,
     service_id matches, expiry block in the future → answers (getQuote via CoinGecko, or echo)
```

- **Payout wallet** is an Arkiv attribute of the service (`payout_address`), set at publish time. Default is the Swarm ID identity address (it can receive USDC, but only Swarm ID holds its key), providers can enter any EVM address.
- **Revenue** = sum of `sale` receipts for the provider (permanent entities), so it survives passes expiring. Shown on the provider dashboard with links to Snowtrace.
- **Client pages:** service detail has "Buy access" + a "Try the bot" console once unlocked; `/passes` lists live passes with time left.
- Payment rail: Circle testnet USDC `0x5425890298aed601595a70AB815c96711a31Bc65` on Fuji (chain id 43113), 6 decimals. Test funds: [USDC faucet](https://faucet.circle.com/), [AVAX faucet](https://core.app/tools/testnet-faucet/).
- **Swarm wallet.** Every identity gets an EVM account derived with Swarm ID `deriveAppSecret` (`packages/swarm` → `deriveWalletSecret`). Same identity, same address, no extension. Clients pay from it by default (MetaMask is a fallback), providers receive on it, and the provider dashboard lets them **reveal/export the private key**, withdraw USDC anywhere and claim contract earnings. Test funds: AVAX for gas + USDC from the faucets linked in the UI.
- **Contract (Foundry, not deployed yet):** `contracts/src/APIperitivoPayments.sol`, a pull-payment ledger. `buy(provider, serviceKey, amount, accessSeconds)` pulls USDC and credits the provider (optional platform fee ≤ 10%), `claim(to, amount)` withdraws, `totalEarned` / `serviceRevenue` / `getPurchases` expose revenue on-chain. 28 Foundry tests (`cd contracts && forge test`) cover accounting, fees, pagination, false-returning and no-return tokens and reentrancy. Deploy with `contracts/script/Deploy.s.sol`, then set `NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS`: the app switches to contract mode (approve + buy, server verifies the `Purchased` event) and the "On-chain payments" panels on the service page and provider dashboard show the contract address, counters and latest purchases with Snowtrace links.
- **Access layer for providers.** `verifyAccessPass(bearer, serviceId)` in `packages/arkiv` is the whole check. Two ways to use it: run your own bot and call it, or declare an `endpoint` in your manifest and let `POST /api/gateway/<serviceId>` verify the pass and forward the call with `x-apiperitivo-*` headers. The demo bot at `/api/bot/<serviceId>` uses the same check.

## Quick start

```bash
bun install
cp .env.example apps/web/.env.local   # then fill ARKIV_WRITER_PRIVATE_KEY (see below)
bun dev                               # http://localhost:3000
```

Other commands:

```bash
bun typecheck   # tsc for every workspace
bun lint        # eslint (web) + tsc (packages)
bun build       # next build + package checks
bun test        # package tests (bun test)
```

### Environment variables

Copy `.env.example` to `apps/web/.env.local`.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SWARM_ID_IFRAME_ORIGIN` | browser | Swarm ID iframe/auth origin. Default `https://swarm-id.snaha.net`. |
| `NEXT_PUBLIC_SWARM_ID_APP_NAME` | browser | App name shown in the Swarm ID consent UI. |
| `NEXT_PUBLIC_SWARM_GATEWAY_URL` | browser | Public Bee API used for manifest proof links and download fallback. Default `https://api.gateway.ethswarm.org` (the gateway the Swarm ID proxy uploads through). A manifest is visible at `<gateway>/bytes/<manifestRef>`. |
| `NEXT_PUBLIC_SWARM_SUBSIDISED_GATEWAY_URL` | browser | Subsidised gateway passed to `SwarmIdClient` so identities without a postage stamp can still upload (`uploadMode = subsidised`). Default `https://api.gateway.ethswarm.org/`, the same value the official Swarm ID demo uses. `off` disables it. |
| `NEXT_PUBLIC_ARKIV_RPC_URL` | browser + server | Optional Arkiv RPC override. Defaults to the Tiramisu testnet RPC bundled with the SDK. |
| `ARKIV_RPC_URL` | server | Optional RPC override for writes. |
| `ARKIV_WRITER_PRIVATE_KEY` | **server only** | App-owned key (0x + 64 hex) funded on Arkiv Tiramisu. Required for `POST /api/services`. Without it the app is read-only and the provider dashboard shows "Arkiv writer not configured". |

The writer account needs testnet GLM on Tiramisu (chain id `7738577`). Generate a fresh key, fund it at the [Arkiv faucet](https://hub.arkiv.network/faucet), and paste it in `.env.local`. Never prefix it with `NEXT_PUBLIC_`. Explorer: <https://tiramisu.explorer.arkiv.network>.

### Where to see the results

| What | Where |
| --- | --- |
| Service entity | `https://tiramisu.explorer.arkiv.network/entity/<entityKey>` (link on every card, detail page and publish success screen) |
| Publish transaction | `https://tiramisu.explorer.arkiv.network/tx/<txHash>` (publish success screen) |
| Writer account | `https://tiramisu.explorer.arkiv.network/address/<writer>` (provider dashboard, with live GLM balance) |
| Manifest bytes | `https://api.gateway.ethswarm.org/bytes/<manifestRef>` (proof chip + detail page) |

Swarm ID identities upload to the Swarm network through `api.gateway.ethswarm.org`; there is no separate Swarm "testnet" in this flow. Arkiv writes go to the Tiramisu testnet.

### SDKs in use (inspected, not invented)

- `@snaha/swarm-id` `0.4.1` — `SwarmIdClient`: `initialize()`, `connect()`, `disconnect()`, `connectionInfo`, `uploadData()`, `downloadData()`. The client is created with `containerId` pointing at a zero-size hidden div in the app shell, otherwise the SDK pins its own "Login with Swarm ID" widget to the bottom-right corner; login is driven by our buttons through `connect()`.
- `@arkiv-network/sdk` `0.8.1` + `viem` — `createPublicClient().select().where(and(eq(...)))`, `createWalletClient().createEntity()`, `ExpirationTime`, `jsonToPayload`, attribute constructors `str/bool/i32`.

## Architecture

```text
apps/web            Next.js 15 App Router + Tailwind v4 (client UI, /api/services, /api/access-passes, /api/bot/[serviceId])
packages/shared     Zod schemas: ServiceManifest, ArkivService, PublishServiceInput; manifest builder; role helpers; serviceId generator
packages/swarm      Swarm ID adapter (browser): initSwarm, getConnectionInfo, connect, disconnect, uploadServiceManifest, downloadServiceManifest
packages/arkiv      Arkiv read adapter (browser/server): listServices, getService, listServicesByProvider,
                    listAccessPassesByBuyer, getAccessPass, listSalesByProvider, getBlockTiming
                    Arkiv server writer (`@apiperitivo/arkiv/server`): publishService, issueAccessPass, getWriterStatus
packages/payments   USDC on Avalanche Fuji: browser (connect wallet, payUsdc, waitForPayment), server (verifyUsdcPayment)
```

Vendor SDK calls never appear in React components; components only see `ArkivService`, `ServiceManifest` and `SwarmConnectionInfo`.

### Trust assumption (Phase 1)

`POST /api/services` signs the Arkiv entity with the app-owned writer key. The `providerId` / `providerName` in the request come from the caller's Swarm ID session and are **not** verified server-side. This is a deliberate hackathon boundary: publishing is not trustless. The route validates the body with Zod, requires a valid Swarm reference, and refuses to run without a configured writer.

### Publish invariant

```text
form → build manifest (Zod) → upload to Swarm (uploadData) → manifestRef → POST /api/services → createEntity on Arkiv → success
```

Manifest upload prefers Swarm ID `uploadData` (user stamp, or the subsidised gateway). If that call fails, the browser falls back to a direct `POST <gateway>/bytes` on the public gateway, which stamps the bytes itself; the success screen says which path was used. Do not pass `pin: true` to `uploadData`: `Swarm-Pin` is not on the gateway's CORS allow-list and the request dies as "Failed to fetch".

Service entities are created with `ExpirationTime.permanent()`: a listing never expires. Only the Phase 2 access pass (what a client buys) will carry a TTL.

Arkiv is never written before the Swarm upload succeeds. If Arkiv fails after the upload, the UI says so and the reference is shown; nothing is written to Arkiv.

### Degraded modes

- Swarm ID `canUpload === false` (only when the subsidised gateway is disabled and the identity has no drive): login works, marketplace and provider dashboard work, the publish button is disabled with a clear explanation.
- No `ARKIV_WRITER_PRIVATE_KEY`: everything reads, `POST /api/services` returns 503 with a clear reason, dashboard shows a warning badge.
- Swarm ID iframe fails to initialise: home shows "Swarm ID login failed." with retry, raw error only in development.

---

This Phase 1 intentionally excludes payments and smart contracts.

The complete MVP for this phase is:

```text
Swarm ID login
      ↓
Choose role
CLIENT / PROVIDER
      ↓
      ├─────────────────────────────┐
      │                             │
   CLIENT                        PROVIDER
      │                             │
query Arkiv                  create service
      │                             │
service cards                upload manifest
      │                          to Swarm
service detail                    │
      │                             ▼
fetch manifest                  get ref
from Swarm                       │
                                  ▼
                           publish service
                              on Arkiv
```

## Product idea

### Client

A client signs in with Swarm ID and can:

- browse all available services published on Arkiv;
- search/filter by name or category;
- open a service detail page;
- inspect the immutable technical manifest stored on Swarm;
- see provider identity and Arkiv/Swarm references.

### Provider

A provider signs in with Swarm ID and can:

- create a new service;
- define its name, description and category;
- define one or more machine-readable operations;
- preview the reduced Swarm manifest;
- upload that manifest to Swarm;
- publish a queryable service entity on Arkiv containing the returned `manifestRef`;
- see their own published services.

There is no payment yet.

---

# Swarm ID role

Swarm ID is the application identity.

After login the app asks:

```text
How do you want to use APIperitivo?

[ I'm a Client ]
[ I'm a Provider ]
```

The selected role is an application preference, NOT a security boundary.

For Phase 1, persist the role locally using the Swarm identity id as key:

```text
apiperitivo:role:<swarmIdentityId>
```

The user must always be able to switch role from the header/profile menu.

Do not require an EVM wallet in Phase 1.

---

# Swarm role

Swarm stores the immutable technical service manifest.

Keep it intentionally small.

Example:

```json
{
  "v": 1,
  "operations": {
    "getQuote": {
      "input": {
        "symbol": "string"
      }
    }
  }
}
```

Another example:

```json
{
  "v": 1,
  "operations": {
    "translate": {
      "input": {
        "text": "string",
        "targetLanguage": "string"
      }
    }
  }
}
```

Do NOT duplicate discovery metadata from Arkiv.

Swarm answers:

> "How can a machine use this service?"

For Phase 1:
- Provider upload should prefer Swarm ID `uploadData`.
- If `canUpload === false`, show a clear provider publishing blocker.
- Client browsing must still work even if `canUpload === false`.
- Downloading/inspecting manifests should use the current supported Swarm ID/public Swarm API.

Do not invent Swarm ID SDK methods. Inspect the installed package/types/docs.

---

# Arkiv role

Arkiv is the queryable live service registry.

Arkiv answers:

> "What services exist?"

Recommended entity:

```json
{
  "attributes": {
    "app": "apiperitivo",
    "entityType": "service",
    "serviceId": "market-data-a81f",
    "category": "market-data",
    "providerId": "<swarm-identity-id>",
    "providerName": "<display-name>",
    "available": true,
    "version": 1,
    "manifestRef": "<swarm-reference>",
    "priceUsdc": "0.50",
    "accessSeconds": 604800
  },
  "payload": {
    "name": "Market Data API",
    "description": "Prezzi aggiornati degli asset"
  },
  "contentType": "application/json"
}
```

**On the wire the attribute names are snake_case** (`entity_type`, `service_id`, `provider_id`, `provider_name`, `manifest_ref`, `price_usdc`, `access_seconds`): the Tiramisu engine rejects uppercase letters in attribute names even though the SDK's local validator allows them. The camelCase names above are our TypeScript shape; the mapping lives in `packages/arkiv/src/entity.ts` (`ATTR`).

`priceUsdc` (`dec`) and `accessSeconds` (`u64`) are the commercial terms of one access pass: what a client will pay and for how long access lasts. They are set by the provider at publish time and shown on cards and the detail page. The purchase itself is Phase 2.

For Phase 1 the service entity should be long-lived.

Do NOT make the service itself expire for the demo.

The later paid `access_pass` will be the expiring Arkiv entity, but it is explicitly out of scope for this phase.

---

# Publish flow

The Provider form should implement this exact sequence:

```text
1. Provider fills service form
2. App builds reduced manifest
3. Show manifest preview
4. Upload manifest to Swarm
5. Receive manifestRef
6. Publish service entity to Arkiv
7. Show success
8. Service appears in marketplace
```

Never create the Arkiv service before the Swarm upload succeeds.

The Arkiv entity must already contain a valid `manifestRef`.

---

# Arkiv writer model

For Phase 1, use an application-owned Arkiv writer on the server.

Reason:
- user logs in only with Swarm ID;
- we do not want to introduce an EVM wallet yet;
- Arkiv writes require the app's configured writer credentials.

Recommended:

```text
Browser
  ↓
POST /api/services
  ↓
Next.js server route
  ↓
Arkiv writer adapter
  ↓
create entity
```

The request should include the current Swarm player/provider identity.

This is a trusted hackathon boundary in Phase 1.

Do not claim the publishing flow is trustless.

---

# Routes

Recommended routes:

```text
/
  Login / entry

/choose-role
  Client vs Provider

/marketplace
  Client service marketplace

/services/[serviceId]
  Service detail + Swarm manifest inspector

/provider
  Provider dashboard / own services

/provider/new
  Publish service
```

If a logged-in user opens the wrong section, allow it.

Role selection should choose the default experience, not lock the user out.

---

# Marketplace UI

The marketplace must feel polished and modern.

Not a plain admin table.

Suggested visual style:

- clean dark or warm-dark UI;
- strong typography;
- generous spacing;
- rounded service cards;
- subtle glass / depth;
- category pills;
- provider identity badge;
- visible Arkiv and Swarm proof chips;
- responsive layout.

Example:

```text
┌──────────────────────────────────────────────────┐
│ APIperitivo                     Francesco ▾      │
│                                                  │
│ Discover APIs that machines can understand.      │
│                                                  │
│ [ Search services... ] [ All categories ▾ ]     │
├──────────────────────────────────────────────────┤
│                                                  │
│ ┌────────────────────┐  ┌────────────────────┐   │
│ │ MARKET DATA        │  │ AI / TEXT          │   │
│ │                    │  │                    │   │
│ │ Market Data API    │  │ Translate API      │   │
│ │                    │  │                    │   │
│ │ Live crypto prices │  │ Translate text     │   │
│ │                    │  │                    │   │
│ │ by provider-x      │  │ by alice           │   │
│ │                    │  │                    │   │
│ │ Arkiv ✓  Swarm ✓   │  │ Arkiv ✓  Swarm ✓  │   │
│ │                    │  │                    │   │
│ │ [ VIEW SERVICE ]   │  │ [ VIEW SERVICE ]  │   │
│ └────────────────────┘  └────────────────────┘   │
└──────────────────────────────────────────────────┘
```

Add:
- skeleton loading;
- empty state;
- search;
- category filter;
- nice hover state.

---

# Service detail UI

Display:

```text
Market Data API

Market Data
by provider-x

Prezzi aggiornati degli asset

ARKIV
serviceId
providerId
manifestRef

SWARM MANIFEST

getQuote
  symbol: string
```

Use an expandable JSON inspector for the raw manifest.

Show concise proof chips:

```text
Arkiv Registry ✓
Swarm Manifest ✓
```

---

# Provider dashboard

Provider page:

```text
YOUR SERVICES

2 published services

[ + PUBLISH SERVICE ]

Market Data API
Arkiv ✓
Swarm ✓
Available
```

Query Arkiv by:

```text
providerId = currentSwarmIdentity.id
```

Do not maintain a separate services database.

---

# Publish service UI

Use a friendly step form, not raw JSON as the primary UX.

Fields:

```text
Service name
Description
Category
```

Operations builder:

```text
Operation ID
Input fields
```

For hackathon speed, support:
- adding/removing operations;
- adding simple input fields;
- input types:
  - string
  - number
  - boolean

Generate the manifest automatically.

Also provide an advanced/raw manifest preview.

Example provider flow:

```text
SERVICE
Market Data API

DESCRIPTION
Real-time crypto prices

CATEGORY
market-data

OPERATION
getQuote

INPUT
symbol : string
```

Generated manifest:

```json
{
  "v": 1,
  "operations": {
    "getQuote": {
      "input": {
        "symbol": "string"
      }
    }
  }
}
```

CTA:

```text
[ PUBLISH SERVICE ]
```

Then show progress:

```text
Uploading manifest to Swarm... ✓
Publishing service to Arkiv... ✓

SERVICE LIVE
```

Show both references.

---

# Data loading

Client marketplace:

```text
query Arkiv:
app = apiperitivo
entityType = service
available = true
```

Provider dashboard:

```text
query Arkiv:
app = apiperitivo
entityType = service
providerId = current identity
```

Service detail:
- get selected Arkiv entity;
- read `manifestRef`;
- download Swarm manifest;
- validate with Zod;
- render operations.

No hard-coded service list in final P0.

---

# State management

Keep it simple.

Use:
- React state;
- server components where helpful;
- small context/hook for Swarm ID session;
- small role hook backed by localStorage.

Do not introduce Redux.

---

# Packages / monorepo

Recommended:

```text
apps/
  web/

packages/
  shared/
  swarm/
  arkiv/
```

`packages/shared`
- Zod schemas
- service types
- manifest builder
- role type

`packages/swarm`
- Swarm ID adapter
- upload manifest
- download manifest
- connection info helpers

`packages/arkiv`
- Arkiv query adapter
- Arkiv server writer adapter
- entity parsing

Do not scatter vendor SDK calls through React components.

---

# P0 definition of done

The phase is complete when:

1. Swarm ID login works.
2. User chooses Client or Provider.
3. Role persists locally for that Swarm identity.
4. Client marketplace reads real services from Arkiv.
5. Cards are polished and responsive.
6. Service detail reads real manifest from Swarm.
7. Provider can create a service using a friendly form.
8. Provider manifest is really uploaded to Swarm.
9. Returned Swarm reference is really written into Arkiv.
10. New service appears in marketplace without hard-coded data.
11. Provider dashboard shows only their Arkiv services.
12. User can switch role.
13. No wallet or payment is required.

Anything beyond this is secondary.

---

# Explicitly out of scope

Do NOT build yet:

- Avalanche
- USDC
- smart contracts
- access_pass
- payments
- subscriptions
- API proxy/gateway
- HTTP 402
- EVM wallet connect
- ENS
- reputation
- provider analytics
- API keys
- billing
- multiple pricing plans

We are validating discovery + publishing first.

---

# Future Phase 2

Do not implement this now, but preserve architecture for:

```text
Client buys service
        ↓
USDC Fuji
        ↓
Arkiv access_pass
TTL
        ↓
API gateway
```

The current service entity and Swarm manifest should remain compatible with that future flow.
