# @apiritivo/web

Next.js 15 App Router + Tailwind v4. All vendor calls go through the packages; components only see `ArkivService`, `ServiceManifest`, `AccessPass`, `Sale`, `SwarmConnectionInfo`, `Signer`.

```text
/                         home; Client view offers Connect wallet, Provider view offers Swarm ID sign-in
/choose-role              pick the workspace (Client / Provider); a preference, never access control
/marketplace              public: live Arkiv query, search, category filter
/services/[serviceId]     public: Arkiv entity + Swarm manifest, buy access (wallet), Try API console, private file, proofs
/passes                   wallet gated: the connected wallet's live access passes with countdown, credentials, Data Explorer links
/provider                 Swarm ID gated: My APIs, recorded sales, wallet (claim, send, reveal key), file access grants, connection details
/provider/new             publish flow: form → manifest → Swarm → Arkiv (payout = Swarm wallet, fixed; optional ENS name, verified server-side; optional private file)
/docs                     in-app documentation (run, judge steps, access pass, code map)
/design-system            reusable UI reference: tokens, controls, API panels and states
/api/services             POST publish (server Arkiv writer), GET writer status (balance, explorer links)
/api/access-passes        POST verify payment on Fuji → mint access_pass (+ secret hash) and sale on Arkiv
/api/grants               POST record a private-file grant made in the provider's browser
/api/bot/[serviceId]      demo bot gated by verifyAccessPass (bearer `<passKey>.<secret>`)
/api/gateway/[serviceId]  verifies the pass, forwards to the manifest `endpoint` with `x-apiritivo-*` headers
```

## State and config

- `lib/session.tsx` — Swarm ID connection + workspace preference (localStorage per identity, separate guest preference, never access control).
- `lib/swarm-wallet.tsx` — EVM wallet derived from the identity (`deriveWalletSecret` → `swarmSigner`); the secret stays in memory for the session. Provider payout wallet.
- `lib/injected-wallet.tsx` — client identity: MetaMask / Rabby / Core over EIP-1193, silent reconnect, Fuji network switch, balances, and `sealPassSecret` / `openPassSecret` backed by one `personal_sign` of `PASS_KEY_MESSAGE` per page load.
- `lib/identity.ts` — `useActiveIdentity()` / `useActiveAccount()`: the Swarm ID in the Provider view, the wallet in the Client view; `passOwner()` tells which key opens a pass.
- `lib/use-pass-bearer.ts` — reveals `<passKey>.<secret>` with the owner's key (wallet signature or Swarm ID).
- `lib/readiness.ts` — pure rules behind the bottom-right readiness pill (`components/readiness-beacon.tsx`, `readiness-panel.tsx`): USDC, AVAX, GLM writer, Swarm drive.
- `lib/use-services.ts`, `lib/use-access.ts`, `lib/access-query-state.ts`, `lib/pass-timing.ts` — query hooks over the Arkiv adapter (services, passes, sales, block timing) and refresh-in-place state.
- `lib/publish-validation.ts` — publish form step validation; `lib/theme.ts` — Auto / Light / Dark appearance (dark until the visitor chooses).
- `lib/use-ens.ts` — resolves and verifies a service's linked ENS name (badge in `service-card`, panel `components/ens-panel.tsx` on the service page).
- `lib/use-live-sales.ts` — subscribes to Fuji (`watchSales`) for a provider address; fires `onSale` so Arkiv lists refresh.
- `lib/server/access.ts` — `requireAccessPass` shared by the bot and the gateway, plus the demo bot brain (CoinGecko prices for `getQuote`).
- `lib/env.ts` — public runtime config. Copy `../../.env.example` to `.env.local`; a `NEXT_PUBLIC_*` change needs a `bun dev` restart.

## Provider wallet panel (`components/swarm-wallet-panel.tsx`)

Two separate actions, both signed by the Swarm wallet key in the browser:

1. **Claimable** (contract mode only) — `claimable` / `totalEarned` from `APIritivoPayments` and a single button, *Claim USDC*. Destination is always the Swarm wallet.
2. **Send USDC** — destination + amount (or *send all*), a plain USDC transfer to MetaMask or any address.

Each block has its own Snowtrace tx link and error line. The panel also reveals the private key for use outside APIritivo. Gas for both steps is AVAX in the Swarm wallet.

## UI

Follow [UI guidance](../../ui-guidance/README.md). `/design-system` previews the shared components.

Every Arkiv entity link goes through `arkivEntityUrl` and opens the Data Explorer with `$key = key(…)` on Tiramisu. Arkiv transaction hashes and the writer's GLM balance link to the Tiramisu block explorer, which is the only place that shows them.

Client sign-in is `components/wallet-menu.tsx` (Connect wallet, network row with Switch, optional Swarm ID row for private files, Disconnect) and `WalletGate` in `components/auth-gate.tsx` for pages that need the wallet.

Provider sign-in uses `components/swarm-sign-in.tsx`: the app opens a dialog containing the persistent SDK iframe. A direct click on the SDK button opens the authentication popup with the iframe as its opener, preserving session handover in browsers with partitioned storage. Closing the dialog keeps the iframe and any in-progress handover alive.

## Local pitfalls

`bun dev` and `bun run build` both write to `.next`. Never run them together; if the dev server logs `ENOENT … .next/…`, stop it, delete `.next` and restart.
