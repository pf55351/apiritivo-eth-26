# @apiritivo/ens

Read-only ENS adapter over viem's universal resolver. The app never writes ENS records; providers set them in the ENS app, the app verifies and resolves.

A `.eth` name becomes the human-readable, machine-resolvable address of an API:

| Record | Points to | Checked by |
| --- | --- | --- |
| `addr` (ETH address) | the provider's payout wallet (Swarm wallet) | the server at publish time: a name is accepted only if it resolves to the payout address |
| `text` `com.apiritivo.service` | the Arkiv `service_id` | the service page (badge turns green) and `tools/call-service.ts` |
| `contenthash` `bzz://<manifest_ref>` | the technical manifest on Swarm (EIP-1577, native Swarm support) | the service page |

Exports: `normalizeEnsName`, `resolveEnsAddress`, `resolveServiceRecords`, `verifyServiceRecords`, `recordsForService`, `swarmContenthash` / `swarmRefFromContenthash`, `ensAppUrl`, `ensChain`, `ensChainLabel`, `ENS_SERVICE_TEXT_KEY`.

Config: `NEXT_PUBLIC_ENS_CHAIN` = `sepolia` (default; free names at https://sepolia.app.ens.domains) or `mainnet`; optional `NEXT_PUBLIC_ENS_RPC_URL` / `ENS_RPC_URL`.

viem has no contenthash action, so the package finds the name's resolver and reads `contenthash(node)` from it directly. Tests: `bun test` (EIP-1577 encoding, name normalisation, verification).
