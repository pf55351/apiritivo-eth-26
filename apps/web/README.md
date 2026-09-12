# @apiritivo/web

Next.js 15 App Router + Tailwind v4. All vendor calls go through the packages; components only see `ArkivService`, `ServiceManifest`, `AccessPass`, `Sale`, `SwarmConnectionInfo`, `Signer`.

```text
/                         home, Swarm ID sign-in, active workspace actions
/marketplace              live Arkiv query, search, category filter
/services/[serviceId]     Arkiv entity + Swarm manifest, buy access, bot console, proofs, on-chain panel
/passes                   client's live access passes with countdown and Data Explorer links
/provider                 dashboard: services, live sales feed (Fuji), earnings, Swarm wallet, on-chain panel
/provider/new             publish flow: form → manifest → Swarm → Arkiv (payout = Swarm wallet, fixed; no endpoint field yet)
/design-system            reusable UI reference: tokens, controls, API panels and states
/api/services             POST publish (server Arkiv writer), GET writer status (balance, explorer links)
/api/access-passes        POST verify payment on Fuji → mint access_pass (+ secret hash) and sale on Arkiv
/api/bot/[serviceId]      demo bot gated by verifyAccessPass (bearer `<passKey>.<secret>`)
/api/gateway/[serviceId]  verifies the pass, forwards to the manifest `endpoint` with `x-apiritivo-*` headers
```

## State and config

- `lib/session.tsx` — Swarm ID connection + workspace preference (localStorage per identity, separate guest preference, never access control).
- `lib/swarm-wallet.tsx` — EVM wallet derived from the identity (`deriveWalletSecret` → `swarmSigner`); the secret stays in memory for the session.
- `lib/use-services.ts`, `lib/use-access.ts` — small query hooks over the Arkiv adapter (services, passes, sales, block timing).
- `lib/use-live-sales.ts` — subscribes to Fuji (`watchSales`) for a provider address; fires `onSale` so Arkiv lists refresh.
- `lib/server/access.ts` — `requireAccessPass` shared by the bot and the gateway, plus the demo bot brain (CoinGecko prices for `getQuote`).
- `lib/env.ts` — public runtime config. Copy `../../.env.example` to `.env.local`; a `NEXT_PUBLIC_*` change needs a `bun dev` restart.

## Provider wallet panel (`components/swarm-wallet-panel.tsx`)

Two separate actions, both signed by the Swarm wallet key in the browser:

1. **Earnings held by the contract** (contract mode only) — shows `claimable` / `totalEarned` from `APIritivoPayments` and a single button, *Claim to my Swarm wallet*. Destination is always the Swarm wallet.
2. **Send USDC from this wallet** — destination + amount (or *send all*), a plain USDC transfer to MetaMask or any address.

Each block has its own Snowtrace tx link and error line. The panel also reveals the private key for use outside APIritivo. Gas for both steps is AVAX in the Swarm wallet.

## UI

Follow [UI guidance](../../ui-guidance/README.md). `/design-system` previews the shared components.

Every Arkiv entity link goes through `arkivEntityUrl` and opens the Data Explorer with `$key = key(…)` on Tiramisu. Arkiv transaction hashes and the writer's GLM balance link to the Tiramisu block explorer, which is the only place that shows them.

Sign-in uses `components/swarm-sign-in.tsx`: the app opens a dialog containing the persistent SDK iframe. A direct click on the SDK button opens the authentication popup with the iframe as its opener, preserving session handover in browsers with partitioned storage. Closing the dialog keeps the iframe and any in-progress handover alive.

## Local pitfalls

`bun dev` and `bun run build` both write to `.next`. Never run them together; if the dev server logs `ENOENT … .next/…`, stop it, delete `.next` and restart.
