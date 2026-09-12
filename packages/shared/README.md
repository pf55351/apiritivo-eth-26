# @apiritivo/shared

Zod schemas and pure helpers shared by the web app, the adapters and the tools. No vendor SDKs here.

| Export | Purpose |
| --- | --- |
| `serviceManifestSchema`, `buildManifest`, `validateManifest`, `manifestToBytes`, `manifestFromBytes` | Reduced technical manifest stored on Swarm (`v`, optional `endpoint`, `operations[name].input[field] = string \| number \| boolean`) |
| `APP_ID`, `SERVICE_ENTITY_TYPE`, `arkivServiceSchema`, `publishServiceInputSchema`, `generateServiceId`, `SERVICE_CATEGORIES`, `ACCESS_DURATIONS`, `priceUsdcSchema`, `evmAddressSchema`, `ensNameSchema` | Service listing as published on Arkiv (name, description, category, price, access duration, payout wallet) |
| `ACCESS_PASS_ENTITY_TYPE`, `SALE_ENTITY_TYPE`, `accessPassSchema` (with `secretHash`, `encryptedSecret`), `saleSchema`, `issueAccessPassInputSchema` (`secretHash` + `encryptedSecret` required), `issueAccessPassResultSchema`, `botRequestSchema`, `sumUsdc`, `formatRemaining` | Access passes, sale receipts, bot calls |
| `GRANT_ENTITY_TYPE`, `grantSchema`, `publishGrantInputSchema` | Private-file grants (Swarm ACT history refs recorded on Arkiv) |
| `Role`, `ROLES`, `isRole`, `roleStorageKey`, `ROLE_HOME` | Client / provider view preference stored per Swarm identity (guests separately) |

Tests: `bun test`.
