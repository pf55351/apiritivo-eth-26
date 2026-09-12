# @apiritivo/tools

`bun demo:check` (from the repo root) — pre-demo readiness. Reads `apps/web/.env.local` and pings every external dependency:

- **Arkiv · Tiramisu**: RPC, writer address + GLM balance, count of `service` and live `access_pass` entities, services missing a payout wallet.
- **Swarm**: public gateway health and a real unstamped upload, subsidised gateway value.
- **Avalanche Fuji**: RPC, USDC contract symbol, `APIritivoPayments` (token, purchase count, fees accrued) or a warning when running in direct-transfer mode.

Exits non-zero on blockers. "0 services" is not a blocker: Tiramisu is a testnet and can be reset, publish again from `/provider/new`.

`bun call:service <serviceId | name.eth> "<passKey>.<secret>" [operation] [inputJson]` (from the repo root, `call-service.ts`) — what a script or agent does with a bought pass: resolves an ENS name to its Arkiv `service_id` when given one, then calls `POST /api/gateway/<serviceId>` with the bearer credential. `APP_URL` overrides `http://localhost:3000`.

`bun tools/ens-register.ts` — ENS on Sepolia (ENSv2 beta) with the Arkiv writer key from `apps/web/.env.local`:

- `status <label>` availability, price in MockUSDC, balances
- `register <label>` mint MockUSDC, approve, commit, wait, register for 1 year
- `resolver <label>` deploy `APIritivoResolver` and set it on the name (the shared v2 resolver refuses writes)
- `records <name.eth> --addr 0x… [--service <id>] [--manifest <ref>]` write the records the app verifies

`bun tools/call-service.ts <serviceId | name.eth> "<passKey>.<secret>" [operation] [inputJson]` — call a bought API like a machine; a `.eth` name is resolved through ENS (Arkiv `ens_name` as fallback).
