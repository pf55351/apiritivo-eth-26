# @apiritivo/swarm

Browser-only adapter over `@snaha/swarm-id` (`SwarmIdClient`). Our names, the SDK's methods underneath.

| Function | SDK call |
| --- | --- |
| `initSwarm({ iframeOrigin, appName, subsidisedGatewayUrl, containerId, gatewayUrl })` | `new SwarmIdClient(...)`, `initialize()` |
| `connect()` / `disconnect()` | `connect({ popupMode: "popup" })` / `disconnect()` |
| `getConnectionInfo()` | `connectionInfo` (identity, `canUpload`, `uploadMode`) |
| `uploadServiceManifest(manifest)` | `uploadData(bytes)` — falls back to `POST <gateway>/bytes` |
| `downloadServiceManifest(ref)` | `downloadData(ref)` — falls back to `GET <gateway>/bytes/<ref>`, validated with Zod |
| `deriveWalletSecret()` | `deriveAppSecret("apiperitivo:wallet:v1")` → 32 bytes used as the Swarm wallet private key |
| `derivePassEncryptionKey()` | `deriveAppSecret("apiritivo:pass-crypt:v1")` → 32-byte AES-GCM key for access-pass secrets |
| `getGranteeKey()` | `connectionInfo.identity.sharingPublicKey` (fallback: app key) — what a provider grants ACT access to |
| `uploadPrivateFile(bytes)` / `grantPrivateFile(historyRef, key)` / `downloadPrivateFile({…})` | `actUploadData` / `actAddGrantees` / `actDownloadData` — private files, per-identity access |
| `getSwarmDrive()` | `getPostageBatch()` → the drive Swarm ID resolved for this app (read-only; the user picks drives in Swarm ID) |

Two labels on purpose: the wallet key never doubles as a cipher key. The wallet label keeps the pre-rename spelling so existing addresses do not move. Derived secrets are bound to identity + app origin: a different origin (for example localhost vs production) yields a different wallet.

Gotchas: pass a `subsidisedGatewayUrl` or identities without a postage stamp get `canUpload=false`; never send `pin: true` (CORS); mount the iframe once in a zero-size container and let the user click the SDK's own button, or the popup loses its opener.
