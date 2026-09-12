# CLAUDE.md — APIritivo (ETH Rome 2026)

Read `README.md` first. This file holds the rules that are not obvious from the code.

## What it is

Machine-readable service marketplace. Identity = Swarm ID, technical manifests = Swarm, registry = Arkiv, payments = USDC on Avalanche Fuji (direct transfer today, `contracts/APIritivoPayments.sol` when deployed).

Monorepo (Bun + Turbo): `apps/web` (Next 15, Tailwind v4), `packages/shared` (Zod schemas), `packages/swarm`, `packages/arkiv`, `packages/payments`, `tools` (demo check), `contracts` (Foundry).

## Non-negotiable rules

- **Never invent SDK methods.** Inspect `node_modules/.bun/@snaha+swarm-id*` and `@arkiv-network+sdk*` types before touching the adapters.
- **Vendor SDKs stay inside `packages/*`.** React components only see `ArkivService`, `ServiceManifest`, `AccessPass`, `Sale`, `SwarmConnectionInfo`, `Signer`.
- **Publish order:** build manifest → upload to Swarm → `manifestRef` → Arkiv entity. Never write Arkiv first.
- **Arkiv attribute names are snake_case** (`entity_type`, `service_id`, `provider_id`, `manifest_ref`, `price_usdc`, `access_seconds`, `payout_address`, `buyer_id`, `buyer_address`, `tx_hash`, `paid_usdc`, `chain_id`, `pass_key`, `secret_hash`). The chain rejects uppercase letters even though the SDK's local validator accepts them. Always go through `ATTR` in `packages/arkiv/src/entity.ts`.
- **Arkiv links:** entities → Data Explorer via `arkivEntityUrl` / `arkivOwnerUrl` (`https://data.arkiv.network/?q=…&chain=tiramisu`); tx hashes and GLM balances → Tiramisu block explorer via `arkivTxUrl` / `explorerUrl`. Never hand-build explorer URLs in components.
- **Service listings are permanent** (`ExpirationTime.permanent()`). Only `access_pass` entities expire; `sale` receipts are permanent so revenue survives.
- **Swarm manifest = technical only** (`v`, optional `endpoint`, `operations`). Name, description, category, price, duration, payout wallet live on Arkiv.
- **Swarm uploads:** pass `subsidisedGatewayUrl` (same value the official Swarm ID demo uses) and never `pin: true` (`Swarm-Pin` is not on the gateway's CORS allow-list → "Failed to fetch"). Direct `POST <gateway>/bytes` is the fallback.
- **Swarm ID iframe** stays mounted once in `#swarm-id-frame` inside the sign-in dialog. Open the dialog from the app, then let the user click the SDK's own button: its popup must keep the iframe as opener for session handover with partitioned storage. Never recreate the iframe or auto-click its button.
- **Server trust boundary:** `POST /api/services` and `POST /api/access-passes` sign with the app-owned Arkiv writer (`ARKIV_WRITER_PRIVATE_KEY`, server only). Payments are verified on-chain (Transfer log or `Purchased` event) before a pass is minted. `providerId`/`buyerId` from the client are trusted (hackathon boundary, documented in README). **Pass ownership:** the API key is `<passKey>.<secret>`; the pass stores `secret_hash` (keccak256) in clear and the secret AES-GCM-encrypted in the payload under a key from `derivePassEncryptionKey()` (Swarm ID `deriveAppSecret`). `verifyAccessPass` requires the secret; legacy passes without `secret_hash` are refused. Helpers live in `packages/arkiv/src/pass-secret.ts`, never re-implement them. The provider payout wallet is always the Swarm-derived wallet (not editable); the manifest `endpoint` field is not exposed in the publish form for now (the gateway falls back to the demo bot). **Private files (Swarm ACT):** optional per service; `uploadPrivateFile` / `grantPrivateFile` / `downloadPrivateFile` in `packages/swarm` wrap `actUploadData` / `actAddGrantees` / `actDownloadData`. Grants happen in the provider's browser and are recorded as `grant` entities via `POST /api/grants` (newest grant = live history ref). Only the publisher can grant; never try to grant from the server.
- **Contract is deployed on Fuji** at `0x4e98f464dc8c667e3b0fd3092e0f2d4585702fa3` (owner = Arkiv writer `0x4016…c09C`, fee 0). Redeploy only if the user asks, via `contracts/deploy-fuji.sh`. `NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS` empty = direct-transfer mode; a `NEXT_PUBLIC_*` change needs a `bun dev` restart.
- **Secrets:** `apps/web/.env.local` is gitignored. `.env.example` carries a testnet-only writer key on purpose (user's decision); never put mainnet keys anywhere.

## Quality gate (run before finishing)

```bash
bun typecheck && bun lint && bun test && bun run build   # never `bun run build` while `bun dev` is running: both write apps/web/.next
bun test:contracts      # Foundry
bun demo:check          # external dependencies
```

Playwright is available in the scratchpad for overflow/console checks (see git history for the scripts). Pages that need Swarm ID login cannot be driven headless; ask the user to verify them in the browser.

## UX rules

- **Design system:** read `.impeccable.md` and `docs/design-system.md` for the orange APIritivo direction. Reuse `components/ui.tsx`, `CodePanel`, semantic color tokens and `.field-control`; `/design-system` is the living reference.

- Product look, not admin panel: cards, pills, proof chips, skeletons, empty states. JSON only in inspectors.
- Clear error strings (kept in components): "Swarm ID login failed.", "Swarm upload unavailable for this identity.", "Manifest upload failed.", "Arkiv publication failed.", "Manifest could not be downloaded.", "No services published yet.". Raw SDK errors only in the dev debug `<details>`.
- Role (client/provider) is a localStorage preference keyed by Swarm identity id, never access control. Both sections stay reachable.
