# @apiperitivo/arkiv

Arkiv (Tiramisu testnet) adapter over `@arkiv-network/sdk` + viem.

**Reads** (`@apiperitivo/arkiv`, browser or server): `listServices`, `getService`, `listServicesByProvider`, `listAccessPassesByBuyer`, `listAccessPassesForService`, `getAccessPass`, `listSalesByProvider`, `findSaleByTxHash`, `getBlockTiming`, `secondsUntilBlock`, `verifyAccessPass(bearer, serviceId)`.

**Writes** (`@apiperitivo/arkiv/server`, server only, signs with `ARKIV_WRITER_PRIVATE_KEY`): `publishService` (permanent `service` entity), `issueAccessPass` (expiring `access_pass` + permanent `sale`), `getWriterStatus` (address, GLM balance, faucet link).

Entities (attributes are snake_case, see `ATTR` in `src/entity.ts`):

```text
service      app, entity_type, service_id, category, provider_id, provider_name, available, version,
             manifest_ref, price_usdc (dec), access_seconds (u64), payout_address (addr)   payload { name, description }
access_pass  app, entity_type, service_id, provider_id, buyer_id, buyer_address, tx_hash, paid_usdc, chain_id   expires
sale         same + pass_key                                                                             permanent
```

The Tiramisu engine rejects uppercase letters in attribute names; the SDK's local validator does not, so never bypass `ATTR`.
