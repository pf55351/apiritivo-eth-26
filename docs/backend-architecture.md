# Backend architecture

APIritivo runs its backend in the Node.js route handlers of the Next.js 15 application at `apps/web`. The server validates requests, verifies Fuji payment receipts, signs Arkiv writes, and gates API execution. Arkiv holds the application records; Swarm holds technical manifests and optional encrypted files; Avalanche Fuji settles USDC payments.

[Open the interactive architecture view](architecture/backend.html) · [Editable diagram specification](architecture/backend.architecture.json) · [Delivery receipt](architecture/backend.delivery.json)

This describes the local implementation inspected on 2026-09-12, based on commit `d7c00fcf0cb0537a478369d01f84b89eac3f3c56` and the current working tree. Diagram source links are pinned to that commit; browser components also have local UI edits. The diagram summarizes server dependencies; the browser's direct storage and payment operations are described in its cards and below. External service availability and the active environment configuration were not checked for this documentation task.

For contract addresses, exact function calls, event verification and transaction sequences, see the [technical contract reference](architecture/technical-reference.md) and [contract integration map](architecture/contracts.html).

[Client workflow](architecture/client.html) · [Provider workflow](architecture/provider.html) · [Role responsibilities](architecture/role-workflows.md)

## Runtime and package boundaries

| Boundary | Responsibility | Implementation |
| --- | --- | --- |
| Next.js route handlers | Five route paths, six handlers; Node.js runtime, forced dynamic execution | [`apps/web/app/api`](../apps/web/app/api) |
| Shared server functions | Require a pass and run demo operations | [`lib/server/access.ts`](../apps/web/lib/server/access.ts) |
| Shared data contracts | Zod schemas for listings, purchases, grants, manifests and call envelopes | [`packages/shared/src`](../packages/shared/src) |
| Arkiv read adapter | Query listings, passes, sales and grants; fetch block timing and verify bearer credentials; usable by browser and server | [`packages/arkiv/src/index.ts`](../packages/arkiv/src/index.ts) |
| Arkiv writer | Sign entity creation with the app-owned `ARKIV_WRITER_PRIVATE_KEY` | [`packages/arkiv/src/server.ts`](../packages/arkiv/src/server.ts) |
| Payment verifier | Fetch Fuji transaction receipts and verify `Purchased` or USDC `Transfer` logs | [`packages/payments/src/server.ts`](../packages/payments/src/server.ts) |
| Browser payment adapter | Sign purchases, claims and transfers; read contract balances and watch sales | [`packages/payments/src/browser.ts`](../packages/payments/src/browser.ts) |
| Browser Swarm adapter | Swarm ID, deterministic key derivation, manifest upload/download and ACT file sharing | [`packages/swarm/src/index.ts`](../packages/swarm/src/index.ts) |
| Payment contract | USDC purchase ledger and provider pull-payment claims | [`APIritivoPayments.sol`](../contracts/src/APIritivoPayments.sol) |

These packages are modules used by the application, not separately deployed microservices. The gateway uses a direct HTTP fetch to the Bee gateway for manifest resolution; the Swarm ID adapter runs in the browser. The inspected backend has no separate application database, job queue or scheduled expiry worker. The Arkiv adapter reuses an RPC client object; it does not cache entity query results.

## API surface

| Method and path | Implemented behavior | Principal responses |
| --- | --- | --- |
| `GET /api/services` | Report writer configuration, public address, chain and GLM balance when available. This is writer health, not the marketplace listing endpoint. | `200`; unreachable RPC is represented as unknown funding |
| `POST /api/services` | Validate service input, check writer funding, create a permanent listing using an already uploaded `manifestRef`. | `201`, `400`, `503` configuration/funding, `502` publication failure |
| `POST /api/access-passes` | Load service terms, look up a sale by transaction hash, verify the payment and payer address, create an expiring pass and permanent sale. | `201`, `400`, `404`, `409` missing terms/reused payment, `402` payment mismatch, `503`, `502` write failure |
| `POST /api/grants` | Check the service, caller-supplied provider ID and encrypted-file reference; record the updated ACT history reference produced in the provider's browser. | `201`, `400`, `404`, `403` provider mismatch, `409` file mismatch, `503`, `502` write failure |
| `POST /api/gateway/[serviceId]` | Verify bearer access, parse `{ operation, input }`, resolve the service manifest and forward to its endpoint; otherwise run the demo operation. | `200`, `401`, `403`, `400`, `404`, `502` upstream failure |
| `POST /api/bot/[serviceId]` | Verify the same bearer access and execute the built-in demo operation directly. | `200`, `401`, `403`, `400`, `500` demo failure |

These are the handlers' explicit response branches, not a guarantee that all dependency failures are normalized: some Arkiv reads and block-timing calls occur outside route-level `try` blocks.

Sources: [`services`](../apps/web/app/api/services/route.ts), [`access-passes`](../apps/web/app/api/access-passes/route.ts), [`grants`](../apps/web/app/api/grants/route.ts), [`gateway`](../apps/web/app/api/gateway/%5BserviceId%5D/route.ts), [`bot`](../apps/web/app/api/bot/%5BserviceId%5D/route.ts).

## Publish, purchase and execute

### Publish a service

The provider's browser builds a technical manifest, uploads it to Swarm and receives a content reference. Only then does it send `POST /api/services`. The app-owned writer creates a permanent Arkiv `service` entity with the manifest reference and commercial terms. The current form builds `operations` without an `endpoint`, so listings published through it use the demo fallback when called through the gateway.

An optional private attachment is uploaded with Swarm ACT in the browser. Its encrypted reference, history reference and publisher public key are included in the listing. The server records these references; it does not upload or decrypt the attachment.

Sources: [`provider/new`](../apps/web/app/provider/new/page.tsx), [`publishService`](../packages/arkiv/src/server.ts), [`buildManifest`](../packages/shared/src/manifest.ts).

### Purchase access

1. The browser signs `approve` and `buy` when `NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS` is configured. Without a configured contract it signs a USDC `transfer` directly to the listing's payout address.
2. After the transaction is mined, the browser creates a random 32-byte secret. It sends the payment hash, buyer fields, `keccak256(secret)` and the AES-GCM-encrypted secret to `POST /api/access-passes`.
3. The route reads the current listing from Arkiv and checks for an existing `sale` with the same transaction hash.
4. `verifyPayment` fetches the Fuji receipt. Contract mode checks a successful transaction, the configured emitting contract, provider, hashed service ID and sufficient amount. Direct mode checks USDC transfer logs to the payout address and sufficient total amount. The route compares the reported payer with `buyerAddress`.
5. `issueAccessPass` creates the TTL-bound `access_pass`, then creates the permanent `sale` with its `pass_key`. It reads Arkiv block timing to return the expiry block and an estimated expiry date.

The contract retains purchased USDC as provider claimable balances, less any configured fee. Providers sign `claim` from their credited wallet. Payment and claim transactions happen from the browser; the Next.js server verifies purchase receipts and never signs a buyer's payment.

Sources: [`buy-access`](../apps/web/components/buy-access.tsx), [`payment verification`](../packages/payments/src/server.ts), [`entity issuance`](../packages/arkiv/src/server.ts), [`contract`](../contracts/src/APIritivoPayments.sol).

### Call a paid API

Both execution routes use `requireAccessPass`, which delegates to `verifyAccessPass`. The credential is `Authorization: Bearer <passKey>.<secret>`. Verification fetches the pass entity and chain block timing in parallel, then checks that the pass exists, belongs to this service, has not reached its expiry block and contains a matching secret hash. Missing or malformed credentials return `401`; absent, expired, wrong-service or wrong-secret passes return `403`.

The gateway then reads the listing, fetches `GET <Bee gateway>/bytes/<manifestRef>` with `cache: no-store`, and validates the manifest. If it finds an endpoint, it forwards a JSON `POST` with a 20-second timeout and `x-apiritivo-service`, `x-apiritivo-pass`, `x-apiritivo-buyer` and `x-apiritivo-expires-block` headers. It wraps the upstream result and verification metadata in its response; a failed upstream response or fetch maps to `502`. The bearer secret is not forwarded to the upstream.

If the endpoint is absent, the manifest fetch fails, or the manifest is invalid, the gateway runs the built-in demo. `/api/bot/[serviceId]` runs that demo directly after the pass check. `getQuote` reads a supported symbol's USD price from CoinGecko; other operations produce an echo response. The routes validate the call envelope but do not enforce the manifest's operation names or individual typed input definitions.

Sources: [`pass verification`](../packages/arkiv/src/index.ts), [`shared guard and demo`](../apps/web/lib/server/access.ts), [`gateway`](../apps/web/app/api/gateway/%5BserviceId%5D/route.ts).

### Share a private file

The provider calls `grantPrivateFile` in the browser, which invokes Swarm ACT `actAddGrantees`. It then posts the updated history reference to `/api/grants`. The writer creates a permanent `grant` entity; a buyer uses recorded references and its own Swarm identity to download and decrypt with `actDownloadData`. Granting is a separate provider action after purchase, not an automatic side effect of minting a pass. ACT revocation and automatic revocation at pass expiry are not wired into this implementation.

Sources: [`private-grants-panel`](../apps/web/components/private-grants-panel.tsx), [`Swarm ACT adapter`](../packages/swarm/src/index.ts), [`grant route`](../apps/web/app/api/grants/route.ts).

## Data ownership and lifetime

| Record or object | Storage | Contents and lifecycle |
| --- | --- | --- |
| `service` | Arkiv | Discovery metadata, price, duration, payout address, Swarm manifest reference and optional private-file references; permanent |
| `access_pass` | Arkiv | Buyer/service/payment attributes and public secret hash; payload contains the encrypted secret; expires after the listing's `access_seconds`, enforced using chain blocks |
| `sale` | Arkiv | Payment and buyer attributes plus the issued pass key; permanent |
| `grant` | Arkiv | Buyer sharing key and Swarm ACT references; permanent |
| Technical manifest | Swarm | `v`, `operations`, optional `endpoint`; referenced by content hash |
| Private attachment | Swarm ACT | Encrypted bytes, accessed through identity grants |
| USDC purchase and claim ledger | Avalanche Fuji | Contract accounting and events in contract mode; token transfers in direct mode |

Arkiv attributes are `snake_case`. Queries filter by `app = apiritivo` and entity type, with up to 20 pages of 100 results. Browser views query Arkiv directly for discovery, passes and receipts; they do not route these reads through `GET /api/services`. Expired passes cease to authorize API calls while sale and grant history remain.

Sources: [`entity writer`](../packages/arkiv/src/server.ts), [`query adapter`](../packages/arkiv/src/index.ts), [`entity field mapping`](../packages/arkiv/src/entity.ts).

## Implemented trust model

All application entity writes are signed by the server's app-owned Arkiv key. `providerId` and `buyerId` are supplied by clients without a server-verified Swarm identity signature. A verified payment proves an observed on-chain transfer or purchase; matching a caller-supplied address does not authenticate that caller's identity. The pass secret is generated and encrypted in the browser, so issuance receives only its hash and ciphertext. Later API calls necessarily send the plaintext secret to the pass guard as part of the bearer credential.

Replay prevention is a sale lookup followed by separate pass and receipt writes, not an atomic uniqueness guarantee. Concurrent requests or a failure between those writes can leave a gap. ACT authorization is independent of an access pass's TTL. The gateway supplies access-context headers to a configured provider endpoint, but this repository does not implement the upstream provider's independent authentication or gateway-origin enforcement.

These are properties of the current code, not a proposed production topology. Signing publish/purchase requests and contract-driven issuance remain future work.

## Rebuild and verification

The standalone HTML is generated with the `archify` skill. From the repository root, with that skill installed at the path below:

```bash
node /Users/lory/.codex/skills/archify/bin/archify.mjs validate architecture docs/architecture/backend.architecture.json --repo-root . --quality showcase --json
node /Users/lory/.codex/skills/archify/bin/archify.mjs deliver architecture docs/architecture/backend.architecture.json docs/architecture/backend.html --repo-root . --quality showcase --json
node /Users/lory/.codex/skills/archify/bin/archify.mjs visual-check docs/architecture/backend.html --json
```

Use the installed skill's equivalent path on another machine. `ARCHIFY_CHROME` can point to a local Chrome/Chromium executable for visual checks. Edit the JSON specification and regenerate rather than editing the generated HTML.

The [delivery receipt](architecture/backend.delivery.json) binds the exact specification and HTML SHA-256 digests, reports all nine showcase checks and verifies 15 source references. The [visual-check receipt](architecture/backend.visual-check.json) records viewport measurements and screenshots; its automated `visualReview: pending` field is separate from human/model visual inspection. The final visual review is recorded in [backend.review.json](architecture/backend.review.json).
