# @apiritivo/arkiv

Arkiv (Tiramisu testnet, chain 7738577) adapter over `@arkiv-network/sdk` + viem.

## Reads — `@apiritivo/arkiv` (browser or server)

| Function | Query |
| --- | --- |
| `listServices()` | `service` where `available = true`, newest first, one per `service_id` |
| `getService(serviceId)`, `listServicesByProvider(providerId)`, `getServiceByEnsName(name)` | `service` filtered |
| `listAccessPassesByBuyer(buyerId)`, `listAccessPassesForService(serviceId, buyerId)` | live `access_pass` entities (Arkiv drops expired ones) |
| `getAccessPass(passKey)` | `getEntity`; `null` = missing or expired |
| `listSalesByProvider(providerId)`, `findSaleByTxHash(txHash)` | permanent `sale` receipts (revenue, replay protection) |
| `listGrantsForService(serviceId)`, `findGrant(serviceId, buyerId)` | permanent `grant` entities (private-file access; newest = live history ref) |
| `getBlockTiming()`, `secondsUntilBlock()`, `estimateBlockDate()` | block-based expiry → seconds / dates at read time |
| `verifyAccessPass(authorization, serviceId)` | the one check every gated service needs, see below |

Explorer links: `arkivEntityUrl(key)` → Data Explorer `?q=$key = key(0x…)&chain=tiramisu`; `arkivOwnerUrl(address)` → `$owner = addr(0x…)`; `arkivQueryUrl(query)` for anything else; `arkivDataExplorerUrl()` for the landing page; `arkivTxUrl(hash)` → Tiramisu block explorer (the Data Explorer has no transaction view).

## Writes — `@apiritivo/arkiv/server` (server only)

Signs with `ARKIV_WRITER_PRIVATE_KEY`. `publishService` creates the permanent `service` entity (call it only after the manifest is on Swarm). `issueAccessPass` creates the expiring `access_pass` and the permanent `sale`. `publishGrant` records a private-file grant made in the provider's browser. `getWriterStatus` returns address, GLM balance, faucet link, block-explorer link (balance) and Data Explorer link (owned entities).

## Pass secrets — `src/pass-secret.ts` (browser-safe)

The entity key of a pass is public, so it cannot be the API key on its own.

```text
buyer's browser:  secret = random 32 bytes
                  secret_hash = keccak256(secret)                → attribute on the pass, in clear
                  encryptedSecret = AES-256-GCM(secret, K_buyer) → pass payload
                  K_buyer = keccak256(personal_sign(PASS_KEY_MESSAGE))   (browser wallet, one signature per page load)
                        or deriveAppSecret("apiritivo:pass-crypt:v1")    (Swarm ID buyer)
                  either way the key never leaves the browser
API key:          Authorization: Bearer <passKey>.<secret>
server:           getEntity(passKey) → still exists? same service? not past expiry block?
                  keccak256(secret) == secret_hash?
```

Helpers: `generatePassSecret`, `hashPassSecret`, `encryptPassSecret`, `decryptPassSecret`, `formatPassBearer`, `parsePassBearer`, `checkPassSecret`. A pass minted without `secret_hash` is refused with 403.

## Entities

Attributes are snake_case (see `ATTR` in `src/entity.ts`). The Tiramisu engine rejects uppercase letters in attribute names; the SDK's local validator does not, so never bypass `ATTR`.

```text
service      app, entity_type, service_id, category, provider_id, provider_name, available, version,
             manifest_ref, price_usdc (dec), access_seconds (u64), payout_address (addr), ens_name (optional),
             private_name, private_bytes, private_type, private_enc_ref, private_history_ref, private_pubkey (optional, ACT file)
             payload { name, description }                                                permanent
access_pass  app, entity_type, service_id, provider_id, buyer_id, buyer_address (addr), tx_hash,
             paid_usdc (dec), chain_id (i32), secret_hash, buyer_pubkey (optional Swarm sharing key)
             payload { serviceName, purchasedAt, encryptedSecret }                        expires after access_seconds
sale         same as access_pass minus secret_hash, plus pass_key
             payload { serviceName, purchasedAt }                                         permanent
grant        app, entity_type, service_id, provider_id, buyer_id, buyer_pubkey, act_history_ref, act_enc_ref, act_pubkey
             payload { grantedAt }                                                        permanent
```

`buyer_id` is the lowercase wallet address for wallet buyers and a Swarm ID id for Swarm buyers.

Tests: `bun test` (entity parsing, pass-secret round trips).
