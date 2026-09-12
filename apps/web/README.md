# @apiperitivo/web

Next.js 15 App Router + Tailwind v4. All vendor calls go through the packages.

```text
/                      home, Swarm ID login, role chooser
/marketplace           live Arkiv query, search, category filter
/services/[serviceId]  Arkiv entity + Swarm manifest, buy access, bot console, proofs, on-chain panel
/passes                client's live access passes
/provider              dashboard: services, earnings, Swarm wallet (reveal key, withdraw, claim), on-chain panel
/provider/new          publish flow: form → manifest → Swarm → Arkiv
/api/services          POST publish (server Arkiv writer), GET writer status
/api/access-passes     POST verify payment on Fuji → mint access_pass + sale on Arkiv
/api/bot/[serviceId]   demo bot gated by verifyAccessPass
/api/gateway/[serviceId]  verifies the pass, forwards to the manifest `endpoint`
```

State: `lib/session.tsx` (Swarm ID + role), `lib/swarm-wallet.tsx` (derived EVM wallet), small query hooks in `lib/use-*.ts`. Config in `lib/env.ts`; copy `../../.env.example` to `.env.local`.
