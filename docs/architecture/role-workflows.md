# Client and provider workflows

[Client workflow](client.html) · [Provider workflow](provider.html) · [Contract map](contracts.html) · [Technical reference](technical-reference.md)

The client buys and consumes a service. The provider publishes and earns from it. Each diagram separates the role's browser actions from Swarm, Fuji contracts and the app-owned Arkiv writer. These show the implemented successful path in contract mode; optional private-file access and failure conditions are called out in the supporting cards.

| Responsibility | Client | Provider |
| --- | --- | --- |
| Identity | Connect a browser wallet (MetaMask, Rabby, Core); its address is `buyer_id`. Swarm ID is optional, only for private files | Connect Swarm ID; derive the payout wallet |
| Discovery / publication | Read listings from Arkiv and technical manifests from Swarm | Define operations and commercial terms; upload the manifest before publishing a listing |
| USDC transaction | Sign `approve` when needed, then `APIritivoPayments.buy` | Sign `APIritivoPayments.claim(wallet, 0)` from the credited payout account |
| Arkiv request | Send `POST /api/access-passes` with payment hash, buyer fields and sealed secret | Send `POST /api/services`; optionally `POST /api/grants` |
| Backend responsibility | Verify payment and payer, check replay receipt, create TTL pass and permanent sale | Validate listing / grant data and sign Arkiv entity creation |
| API usage | Send `<passKey>.<secret>`; the backend checks entity, service, expiry and secret | Supply a service implementation if a manifest endpoint is configured |
| Private file | Wait for the provider's ACT grant, then download with `actDownloadData`; the current UI also requires an active pass | Upload the optional encrypted file, run `actAddGrantees` in the browser, then record the new history reference |
| Revenue | Pay the listing's provider; no earnings claim occurs in the purchase path | Watch `Purchased` logs and Arkiv receipts, claim revenue, optionally transfer USDC onward |

In the provider diagram, **Client buys access** is an external event, not a provider action. The dashed relationship is the provider dashboard polling Fuji purchase logs. Viewing a dashboard does not initiate a purchase or mint a pass. Claiming needs an actual positive `claimable` balance.

The client signs payment transactions. The provider signs claims and optional outgoing transfers. The Next.js server signs Arkiv writes, using its own writer key. The payment contract pulls USDC during `buy` and transfers it out during `claim`; it does not issue Arkiv passes.

The current publication form does not expose `endpoint`, so the gateway uses the demo bot for form-created manifests. ACT grants remain a distinct provider action and are not automatically revoked at API pass expiry. The app's client/provider workspace choice is a UI preference, not a server authorization proof.

Without a configured payments contract, the client signs a direct USDC transfer to the provider. In that fallback there is no contract earnings claim. The configured contract addresses and the previous read-only Fuji snapshot are in the [technical reference](technical-reference.md#verified-contracts); this role split does not make a new chain-state claim.

## Implementation evidence

| Workflow stage | Source |
| --- | --- |
| Client payment, secret creation and pass request | [`buy-access.tsx`](../../apps/web/components/buy-access.tsx) |
| Payment signing and sales polling | [`payments/browser.ts`](../../packages/payments/src/browser.ts) |
| Server payment verification and issuance | [`access-passes/route.ts`](../../apps/web/app/api/access-passes/route.ts), [`arkiv/server.ts`](../../packages/arkiv/src/server.ts) |
| Pass guard and API execution | [`arkiv/index.ts`](../../packages/arkiv/src/index.ts), [`server/access.ts`](../../apps/web/lib/server/access.ts) |
| Provider manifest-first publication | [`provider/new/page.tsx`](../../apps/web/app/provider/new/page.tsx) |
| Provider earnings claims and outgoing transfers | [`swarm-wallet-panel.tsx`](../../apps/web/components/swarm-wallet-panel.tsx) |
| Provider grants and buyer downloads | [`private-grants-panel.tsx`](../../apps/web/components/private-grants-panel.tsx), [`private-files-panel.tsx`](../../apps/web/components/private-files-panel.tsx) |
| Contract accounting | [`APIritivoPayments.sol`](../../contracts/src/APIritivoPayments.sol) |

Editable inputs: [client.workflow.json](client.workflow.json) and [provider.workflow.json](provider.workflow.json). Regenerate the HTML from them with the `archify` skill; receipts and screenshots are not kept in the repository.
