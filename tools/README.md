# @apiritivo/tools

`bun demo:check` (from the repo root) — pre-demo readiness. Reads `apps/web/.env.local` and pings every external dependency:

- **Arkiv · Tiramisu**: RPC, writer address + GLM balance, count of `service` and live `access_pass` entities, services missing a payout wallet.
- **Swarm**: public gateway health and a real unstamped upload, subsidised gateway value.
- **Avalanche Fuji**: RPC, USDC contract symbol, `APIritivoPayments` (token, purchase count, fees accrued) or a warning when running in direct-transfer mode.

Exits non-zero on blockers. "0 services" is not a blocker: Tiramisu is a testnet and can be reset, publish again from `/provider/new`.
