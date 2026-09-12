# CLAUDE.md — APIperitivo (ETH Rome 2026)

Read `README.md` first. This file holds the rules that are not obvious from the code.

## What it is

Machine-readable service marketplace. Identity = Swarm ID, technical manifests = Swarm, registry = Arkiv, payments = USDC on Avalanche Fuji (direct transfer today, `contracts/APIperitivoPayments.sol` when deployed).

Monorepo (Bun + Turbo): `apps/web` (Next 15, Tailwind v4), `packages/shared` (Zod schemas), `packages/swarm`, `packages/arkiv`, `packages/payments`, `tools` (demo check), `contracts` (Foundry).

## Non-negotiable rules

- **Never invent SDK methods.** Inspect `node_modules/.bun/@snaha+swarm-id*` and `@arkiv-network+sdk*` types before touching the adapters.
- **Vendor SDKs stay inside `packages/*`.** React components only see `ArkivService`, `ServiceManifest`, `AccessPass`, `Sale`, `SwarmConnectionInfo`, `Signer`.
- **Publish order:** build manifest → upload to Swarm → `manifestRef` → Arkiv entity. Never write Arkiv first.
- **Arkiv attribute names are snake_case** (`entity_type`, `service_id`, `provider_id`, `manifest_ref`, `price_usdc`, `access_seconds`, `payout_address`, `buyer_id`, `tx_hash`, `paid_usdc`, `chain_id`, `pass_key`). The chain rejects uppercase letters even though the SDK's local validator accepts them. Always go through `ATTR` in `packages/arkiv/src/entity.ts`.
- **Service listings are permanent** (`ExpirationTime.permanent()`). Only `access_pass` entities expire; `sale` receipts are permanent so revenue survives.
- **Swarm manifest = technical only** (`v`, optional `endpoint`, `operations`). Name, description, category, price, duration, payout wallet live on Arkiv.
- **Swarm uploads:** pass `subsidisedGatewayUrl` (same value the official Swarm ID demo uses) and never `pin: true` (`Swarm-Pin` is not on the gateway's CORS allow-list → "Failed to fetch"). Direct `POST <gateway>/bytes` is the fallback.
- **Swarm ID iframe** must be mounted in the zero-size `#swarm-id-frame` container, otherwise the SDK shows its own login widget bottom-right.
- **Server trust boundary:** `POST /api/services` and `POST /api/access-passes` sign with the app-owned Arkiv writer (`ARKIV_WRITER_PRIVATE_KEY`, server only). Payments are verified on-chain (Transfer log or `Purchased` event) before a pass is minted. `providerId`/`buyerId` from the client are trusted (hackathon boundary, documented in README).
- **Contract is not deployed** unless the user says so. `NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS` empty = direct-transfer mode.
- **Secrets:** `apps/web/.env.local` is gitignored. `.env.example` carries a testnet-only writer key on purpose (user's decision); never put mainnet keys anywhere.

## Quality gate (run before finishing)

```bash
bun typecheck && bun lint && bun test && bun build
bun test:contracts      # Foundry
bun demo:check          # external dependencies
```

Playwright is available in the scratchpad for overflow/console checks (see git history for the scripts). Pages that need Swarm ID login cannot be driven headless; ask the user to verify them in the browser.

## UX rules

- Product look, not admin panel: cards, pills, proof chips, skeletons, empty states. JSON only in inspectors.
- Clear error strings (kept in components): "Swarm ID login failed.", "Swarm upload unavailable for this identity.", "Manifest upload failed.", "Arkiv publication failed.", "Manifest could not be downloaded.", "No services published yet.". Raw SDK errors only in the dev debug `<details>`.
- Role (client/provider) is a localStorage preference keyed by Swarm identity id, never access control. Both sections stay reachable.
