# @apiperitivo/shared

Zod schemas and pure helpers shared by the web app, the adapters and the tools. No vendor SDKs here.

| Export | Purpose |
| --- | --- |
| `serviceManifestSchema`, `buildManifest`, `validateManifest`, `manifestToBytes`, `manifestFromBytes` | Reduced technical manifest stored on Swarm (`v`, optional `endpoint`, `operations[name].input[field] = string \| number \| boolean`) |
| `arkivServiceSchema`, `publishServiceInputSchema`, `generateServiceId`, `SERVICE_CATEGORIES`, `ACCESS_DURATIONS`, `priceUsdcSchema` | Service listing as published on Arkiv (name, description, category, price, access duration, payout wallet) |
| `accessPassSchema`, `saleSchema`, `issueAccessPassInputSchema`, `botRequestSchema`, `sumUsdc`, `formatRemaining` | Phase 2: access passes, sale receipts, bot calls |
| `Role`, `roleStorageKey`, `ROLE_HOME` | Client / provider preference stored per Swarm identity |

Tests: `bun test`.
