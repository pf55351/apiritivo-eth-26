# @apiperitivo/swarm

Browser-only adapter over `@snaha/swarm-id` (`SwarmIdClient`). Our names, the SDK's methods underneath.

| Function | SDK call |
| --- | --- |
| `initSwarm({ iframeOrigin, appName, subsidisedGatewayUrl, containerId, gatewayUrl })` | `new SwarmIdClient(...)`, `initialize()` |
| `connect()` / `disconnect()` | `connect({ popupMode: "popup" })` / `disconnect()` |
| `getConnectionInfo()` | `connectionInfo` (identity, `canUpload`, `uploadMode`) |
| `uploadServiceManifest(manifest)` | `uploadData(bytes)` — falls back to `POST <gateway>/bytes` |
| `downloadServiceManifest(ref)` | `downloadData(ref)` — falls back to `GET <gateway>/bytes/<ref>`, validated with Zod |
| `deriveWalletSecret(label)` | `deriveAppSecret(label)` → 32 bytes used as the Swarm wallet private key |

Gotchas: pass a `subsidisedGatewayUrl` or identities without a postage stamp get `canUpload=false`; never send `pin: true` (CORS); mount the iframe in a zero-size container or the SDK shows its own login widget.
