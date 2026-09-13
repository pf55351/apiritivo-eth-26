# Arkiv feedback report — APIritivo (ETHRome 2026)

**Versions used.** `@arkiv-network/sdk` 0.8.1 · network Tiramisu (chain id 7738577), public RPC · Data Explorer `data.arkiv.network` · block explorer `tiramisu.explorer.arkiv.network` · Hub `hub.arkiv.network` · runtime Bun 1.3.8, Next.js 15, viem 2.x.
**Usage.** One server-side writer (`0x401629d4c1A4C1A0Ffd14A089f798Dd29A94c09C`), about 50 entity writes (8 `service`, 21 `sale`, 21 `access_pass`, 3 `grant`). Evidence index: [submission.md](submission.md).

Surfaces covered below: SDK · Docs · Hub · Access keys / faucet · Explorers · Network · MCP / tools.

---

## 1. SDK (`@arkiv-network/sdk` 0.8.1)

### 1.1 Feature gap: expiring entities linked to a principal without exposing it (our main blocker)

- **Expected.** A way to write expiring child entities (our `access_pass`) that a buyer can query as "mine", linked to the buyer's principal identity, without the buyer's wallet or id being a public attribute readable by anyone.
- **Actual.** The only trustworthy index is `ownedBy(<wallet>)` plus public attributes. To make "my passes" queryable we must store `buyer_id` and `buyer_address` as attributes, so every purchase is linkable to a wallet in the Data Explorer. We discussed this with the Arkiv team at the venue; no pattern keeps both the query and the anonymity today.
- **Workaround.** Pass *use* is protected by a secret (`secret_hash` in clear, secret AES-GCM encrypted in the payload under a key derived from the buyer's Swarm ID). The *link* buyer → purchase stays public.
- **Suggestion.** Indexer-level anonymisation: blinded attributes (query by `hmac(holderKey, service_id)`, third parties see an opaque index), or attributes readable only by owner/grantee with a public expiry, or a documented pattern for "expiring children of a permanent parent whose owner is not exposed".
- **Repro.** Write any entity with `buyer_address` as attribute; open `https://data.arkiv.network/?q=buyer_address = "<wallet>"&chain=tiramisu` from a logged-out browser: every purchase of that wallet is listed.

### 1.2 Attribute-name validation differs between SDK and chain

- **Expected.** An attribute key rejected by the chain is rejected locally by the SDK, or the docs state the rule.
- **Actual.** `createEntity({ attributes: { serviceId: "x" } })` passes SDK validation and fails only at submission; the chain accepts lowercase only. Cost us about one hour.
- **Repro.** SDK 0.8.1, Tiramisu: create an entity with any attribute key containing an uppercase letter; observe the local call succeeds and the transaction is rejected. Renaming to `service_id` fixes it.

### 1.3 `ExpirationTime.fromSeconds` does not document the 2-second block rounding

- **Expected.** `fromSeconds(n)` either documents how `n` maps to blocks or throws for values it cannot represent.
- **Actual.** Lifetimes are stored in 2-second blocks; an odd number of seconds is silently rounded. We discovered it by comparing the applied `expiresAt` block with the requested seconds and now refuse odd durations at publish time.
- **Repro.** Create an entity with `expires: ExpirationTime.fromSeconds(61)`, read it back with `select({ expiresAt: true })`, compare `expiresAt - createdAt` with 61/2.

### 1.4 Expired entities leave no trace

- **Expected.** An opt-in way to read what expired (`includeExpired`, a tombstone, or an expiry event).
- **Actual.** Once an entity lapses no query returns it. Our audit trail exists only because we write a permanent `sale` that stores the `pass_key`.
- **Repro.** Create an entity with a 30-second lifetime, wait 40 seconds, query `$key = key(<key>)`: empty, no indication it ever existed. Example: pass `0x4521270c…e32b853` referenced by permanent sale `0xc7f90640…205a89`.

### 1.5 Referencing a sibling key inside one `executeBatch`

- **Expected.** The docs next to `executeBatch` show how an entity in a batch references another entity created in the same batch.
- **Actual.** It works with `predictEntityKeys({ owner, count })` + `salt`, but we found it by reading the SDK source. Once found, it gave us idempotent pass + receipt minting in one transaction.
- **Repro.** `packages/arkiv/src/server.ts` lines 228–249 in our repo.

### 1.6 Type of `createPublicClient`

- **Expected.** The client returned by `createPublicClient` satisfies the exported `PublicArkivClient` type.
- **Actual.** It does not; we cast `as unknown as PublicArkivClient` in two places (`packages/arkiv/src/index.ts`, `server.ts`).
- **Repro.** `const c: PublicArkivClient = createPublicClient({ chain, transport: http(url) })` under `strict: true`, TypeScript 5.9.

## 2. Docs

- **Expected.** The first page a builder reads states: attribute keys are lowercase; lifetimes are 2-second blocks; anyone can write any attribute, so reads must filter by owner; how to reference sibling keys in a batch.
- **Actual.** All four are missing or hard to find. The owner-filter point matters most: our first version accepted `app = apiritivo` entities from any wallet, which would have allowed forged passes and listings. We found it in review, not in the docs.
- **Good.** Query builder and entity model docs were enough to ship the first read path in an afternoon.

## 3. Hub

- **Used for:** faucet, mission pages, submission links.
- **Expected / Actual.** Worked as described. One request for a writer address was enough; nothing to report beyond a wish for a "your entities" shortcut into the Data Explorer from the Hub.

## 4. Access keys / faucet

- **Access keys.** Not needed: the public Tiramisu RPC accepted reads and writes without a key.
- **Faucet.** One GLM top-up for the writer covered the entire hackathon (~50 writes, 0.093 GLM left at submission). No friction. Expected / actual identical.

## 5. Explorers

### 5.1 Data Explorer: no link from an entity to its creating transaction

- **Expected.** An entity page shows the transaction that created it and the expiry block.
- **Actual.** Neither is shown, and there is no transaction view at all.
- **Repro.** Open `https://data.arkiv.network/?q=$key = key(0x248c5d29f15e0d93c4e8611a9f45831080336ef26b8fd0737f20675b1f3cf439)&chain=tiramisu`.

### 5.2 Block explorer: no address transaction API

- **Expected.** A way to list the transactions sent by an address (Blockscout-style `/api/v2/addresses/{addr}/transactions` or the legacy `?module=account&action=txlist`).
- **Actual.** Both return 404 / empty. To map entity keys to creation transactions for this submission we fetched blocks over RPC (`eth_getBlockByNumber` with transactions at each entity's `createdAt`) and filtered by `from`.
- **Repro.** `curl https://tiramisu.explorer.arkiv.network/api/v2/addresses/0x401629d4c1A4C1A0Ffd14A089f798Dd29A94c09C/transactions` → `{"error":"Not found: ..."}`.

## 6. Network (Tiramisu)

- **Expected / Actual.** The public RPC handled our traffic during the event; block time 2 s as advertised. We did not measure sustained load.
- **Design note for others.** Because expiry is enforced by absence, every read failure must be surfaced as "unavailable" (we answer HTTP 503), never as "expired" or "not found". Otherwise an RPC hiccup locks paying users out.

## 7. MCP / tools

- Not used. We built directly on the SDK; our own CLIs live in `tools/` (demo check, service call, ENS registration).

## What worked well

Expiry as a first-class property is why we chose Arkiv: the purchased duration *is* the pass's lifetime, the gateway simply stops finding it, and there is no cron or revoke endpoint in the codebase. One `executeBatch` per purchase (pass + permanent receipt) made minting idempotent for free.
