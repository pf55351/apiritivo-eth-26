# Arkiv feedback — APIritivo (ETHRome 2026)

SDK `@arkiv-network/sdk` 0.8.1 · network Tiramisu (7738577) · one server-side writer `0x4016…c09C` · ~50 entity writes over the weekend. Evidence index: [submission.md](submission.md).

## The thing we could not build: anonymous expiring entities tied to a principal

**What we wanted.** Each purchase is an expiring `access_pass` that belongs to a buyer. We wanted those passes linked to the buyer's principal identity (Swarm ID) so the buyer can list "my passes", **without** the buyer's wallet or identity being a public, queryable attribute on chain.

**What Arkiv offers today.** The only trustworthy index is the owner wallet (`ownedBy`) plus public attributes. To make "my passes" queryable we had to write `buyer_id` and `buyer_address` as attributes. That makes every purchase linkable to a wallet by anyone with the Data Explorer. We discussed it with the Arkiv team at the venue and did not find a pattern that keeps both the query and the anonymity.

**Our workaround.** Pass ownership is proven with a secret: the pass stores `secret_hash` (keccak256) in clear and the secret AES-GCM-encrypted in the payload under a key derived from the buyer's Swarm ID. That protects the *use* of the pass, not the *link* between buyer and purchase, which stays public.

**Ask.** Anonymisation at the indexer level. Any of these would have unblocked us:
- blinded attributes: query by a value only the holder can derive (e.g. `hmac(buyerKey, service_id)`), so a third party sees an opaque index, not a wallet;
- private attributes readable only by owner or grantee, with a public expiry;
- a documented pattern for "child entities that expire, linked to a permanent parent, with the parent owner not exposed".

## Issues (expected vs actual)

1. **Attribute names: local validator disagrees with the chain.** Actual: `createEntity` with an attribute key like `serviceId` passes SDK validation and fails only at submission; the chain wants lowercase. Expected: the SDK rejects it locally, or the docs state "lowercase / snake_case only". Repro: any `createEntity({ attributes: { serviceId: "x" } })` on 0.8.1. Cost us about an hour.
2. **Lifetime is in 2-second blocks, `fromSeconds` does not say so.** Actual: an odd number of seconds is not representable; we found out from the applied expiry block and now refuse odd durations at publish time. Expected: `ExpirationTime.fromSeconds` documents the rounding (or throws), and the docs state the block time.
3. **Expired entities leave no trace.** Actual: once the pass lapses no query returns it, so an audit of "what did this buyer hold" depends on us having written a permanent `sale` that stores `pass_key`. Expected: an opt-in `includeExpired` / tombstone read, or an expiry event we can subscribe to.
4. **Sibling keys in a batch.** We needed the sale to reference the pass created in the same `executeBatch`. `predictEntityKeys` + `salt` works, but we found it by reading the SDK, not the docs. Expected: this pattern documented next to `executeBatch`.
5. **Types.** `createPublicClient(...)` does not type as `PublicArkivClient`; we cast with `as unknown as` in two places. Expected: the returned client satisfies the exported interface.
6. **Explorers.** Data Explorer: no transaction view and no "created in tx" on an entity. Block explorer: no address API (Blockscout-style `/api/v2/addresses/{addr}/transactions` returns 404), so to compile the evidence for this submission we scanned blocks over RPC and matched `createdAt`. Expected: entity page shows creation tx and expiry block; an address transaction list endpoint.

## Surfaces we used

- **SDK:** typed reads (`select/where/ownedBy`), `createEntity`, `executeBatch`, `predictEntityKeys`, `ExpirationTime`. Solid once the two gotchas above are known.
- **Docs:** enough to start; missing the block/seconds conversion, the naming rule, the batch pattern, and one sentence early on saying "anyone can write any attribute, always filter by owner" (that is how we found our first trust bug).
- **Hub / faucet:** one GLM top-up funded the whole hackathon for one writer. No friction.
- **Access keys:** none needed for the public RPC.
- **Network:** public Tiramisu RPC handled our traffic; our routes still answer 503 rather than "expired" when a read fails, which we recommend to everyone building access control on Arkiv.
- **MCP / tools:** not used.

## What worked well

Expiry as a first-class property is the reason we picked Arkiv: the purchased duration *is* the pass's lifetime, the gateway just stops finding it, no cron and no revoke endpoint. One batch write per purchase (pass + receipt) gave us idempotent minting for free.
