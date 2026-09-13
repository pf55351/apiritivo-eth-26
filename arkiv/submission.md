# Arkiv submission — evidence index

Mission selected: **02 — Built to expire**. Network: Arkiv Tiramisu (chain 7738577).
Repo: https://github.com/pf55351/apiritivo-eth-26 · Walkthrough: [docs/JUDGE-WALKTHROUGH.txt](../docs/JUDGE-WALKTHROUGH.txt)

## 1. Wallets that create Arkiv entities

| Address | Role |
|---|---|
| `0x401629d4c1A4C1A0Ffd14A089f798Dd29A94c09C` | Backend writer. Creates and owns **every** entity (`service`, `access_pass`, `sale`, `grant`). Server-only key (`ARKIV_WRITER_PRIVATE_KEY`); reads trust only this owner. No ownership transfer. Also used as the USDC payer on Avalanche Fuji in our demo purchases (`buyer_address`). |

Addresses that appear inside entity attributes but never write to Arkiv: provider payout wallets derived from Swarm ID (e.g. `0x6176Ee7e66D04e52d08D7C277BbD9ae4e3611354`, `0xE20a31dc98d98c982B4d5760bc1595a9e53F21f8`), demo client wallet `0xB8F4d25f3e18F336506A39a40e5C3500922e9bAd`.

All entities by owner: https://data.arkiv.network/?q=%24owner%20%3D%20addr(0x401629d4c1A4C1A0Ffd14A089f798Dd29A94c09C)&chain=tiramisu

## 2. On-chain creation evidence (all by the writer above)

Counts at block 387492: 8 `service`, 21 `sale`, 19 live `access_pass`, 3 `grant`. 21 sales vs 19 passes = 2 passes already expired on their own.

### Services (permanent)

| service_id | Entity key | Block | Arkiv tx |
|---|---|---|---|
| `data-api-x-2e80` | [`0x248c5d29…3cf439`](https://data.arkiv.network/?q=%24key%20%3D%20key(0x248c5d29f15e0d93c4e8611a9f45831080336ef26b8fd0737f20675b1f3cf439)&chain=tiramisu) | 384818 | [`0x0477ab9c…c5cbe`](https://tiramisu.explorer.arkiv.network/tx/0x0477ab9cd13f87388857fca8d045a7a729ed14074ec1f8c503970319adfc5cbe) |
| oldest listing | [`0x88e9ca56…8a39a`](https://data.arkiv.network/?q=%24key%20%3D%20key(0x88e9ca56086b0e4b96b34e80b3c16129505f6b3cda79e4aefc2feb94c408a39a)&chain=tiramisu) | 357521 | [`0x6368f990…acac9`](https://tiramisu.explorer.arkiv.network/tx/0x6368f9904fb1ac1e8922a99fe2e0cc4f38bb74c05d074cfb4a1489d109bacac9) |

### Purchases: pass + sale written in one `executeBatch` (one Arkiv tx each)

| Block | Arkiv tx | access_pass (expires block) | sale (permanent) | Fuji payment tx |
|---|---|---|---|---|
| 385052 | [`0xcedb0ede…c53a26`](https://tiramisu.explorer.arkiv.network/tx/0xcedb0ede6798433f2440dc6b5e32a3f9d8c05bb879bfb83c559c6031e4c53a26) | [`0x2743bd9a…fe86d5`](https://data.arkiv.network/?q=%24key%20%3D%20key(0x2743bd9a8e2db32b09e1a63f76f43387088159bba06e967c2359c61439fe86d5)&chain=tiramisu) (687452) | [`0x2d8fbb52…e1702d`](https://data.arkiv.network/?q=%24key%20%3D%20key(0x2d8fbb5227c2fceb105c84305913379148a9395f4ec4a6d95efc1cd161e1702d)&chain=tiramisu) | [`0xcba45992…e04c49`](https://testnet.snowtrace.io/tx/0xcba4599231a3ed07ebcfb48108bc568ac3d5d77032013ca2c35efd61ffe04c49) |
| 371652 | [`0x2d1c9292…c842d`](https://tiramisu.explorer.arkiv.network/tx/0x2d1c9292e5c968347172769ea48d109ef117fbb8b6103a5f83cbe735c94c842d) | [`0x1bd169a6…c479a8`](https://data.arkiv.network/?q=%24key%20%3D%20key(0x1bd169a65487914c24c8597644fbecb20f0a0f190d89ce6e35c34de063c479a8)&chain=tiramisu) (674052) | [`0x2132c1e1…d7a5bd`](https://data.arkiv.network/?q=%24key%20%3D%20key(0x2132c1e11dacd15637c0925d91a18b5ffb69f0d242ebde50a7e22303c3d7a5bd)&chain=tiramisu) | [`0x3d946662…ff26ed`](https://testnet.snowtrace.io/tx/0x3d94666254be518487674e32e0c73e317d04a1597f35d9d83a623fc07aff26ed) |

### Passes that already expired on their own (no delete call exists in the codebase)

The permanent `sale` still references the pass in `pass_key`; the pass itself is no longer returned by any query.

| Sale (still readable) | Created | Arkiv tx that created pass + sale | Expired pass key (now "not found") |
|---|---|---|---|
| [`0xc7f90640…205a89`](https://data.arkiv.network/?q=%24key%20%3D%20key(0xc7f90640118bd06e7dffa957778956e815074503e894024d455b3ba0bb205a89)&chain=tiramisu) · `test-call-price-3d6a` | block 369656 | [`0x04e6b9a8…6f67b7`](https://tiramisu.explorer.arkiv.network/tx/0x04e6b9a88ed0af9ab2f51ff44c33c5780f6e44d5a23cfdd42b8a78407d6f67b7) | [`0x4521270c…e32b853`](https://data.arkiv.network/?q=%24key%20%3D%20key(0x4521270c3fc8c3a1c5c7369e1637b03703fa76d020768f4fd1d06ac42e32b853)&chain=tiramisu) |
| [`0xac4274f6…a6e3b`](https://data.arkiv.network/?q=%24key%20%3D%20key(0xac4274f6ae2d230b4d2152f99a74d0b4c6ce8fcfaef91471e35ad50bc78a6e3b)&chain=tiramisu) · `market-api-08c1` | block 357649 | sale [`0x3ccb6ee4…3fb743`](https://tiramisu.explorer.arkiv.network/tx/0x3ccb6ee40779b25461dd85e7d971198be6dd766c339c5f6bec8e6844063fb743), pass [`0xd6afa143…f9d421`](https://tiramisu.explorer.arkiv.network/tx/0xd6afa143ab07f1d45a71bc5da16830980b104060f2f96ba2979995bd52f9d421) (block 357646, earlier two-tx flow) | [`0x18381aaa…af8087`](https://data.arkiv.network/?q=%24key%20%3D%20key(0x18381aaa87f343b25abb78083d4f8b358d4e56d85fcefb9140c9eee183af8087)&chain=tiramisu) |

Checked at block 387531 with the app's own read path (`getAccessPass`): both expired keys → `null`; `0x2743bd9a…` → live, `expiresAtBlock 687452`.

### Grants

[`0x988a0be5…59cc3`](https://data.arkiv.network/?q=%24key%20%3D%20key(0x988a0be5612bcbbb456333cd98ffeac54e18c694552be41b809fcb8d4a759cc3)&chain=tiramisu) · block 371677 · tx [`0x9c9caa8d…4714b4`](https://tiramisu.explorer.arkiv.network/tx/0x9c9caa8dc4ef80634328be4caeb60c4e1b996e0d092f7b82660b90b6284714b4)

## 3. Reproducing Mission 02 — Built to expire

**What changes when the entity lapses:** the API key stops working (gateway answers 403), the pass disappears from "My passes" (or shows *Expired* while the countdown is being watched), and the sale receipt stays.

**Write path (expiry = purchased duration):** [`packages/arkiv/src/server.ts#L228-L249`](../packages/arkiv/src/server.ts#L228-L249) — `expires: ExpirationTime.fromSeconds(service.accessSeconds)` for the pass, `ExpirationTime.permanent()` for the sale, both in one `executeBatch`. Durations a provider can sell: [`packages/shared/src/service.ts#L43`](../packages/shared/src/service.ts#L43) (30 s … 1 year, even seconds only because Arkiv counts 2-second blocks).

**Read path (same query, before and after):** [`getAccessPass`](../packages/arkiv/src/index.ts#L165) → [`verifyAccessPass`](../packages/arkiv/src/index.ts#L245), called by every gated request through [`apps/web/lib/server/access.ts#L8`](../apps/web/lib/server/access.ts#L8). "Not found" is treated as "no access": there is no delete call, no cron and no revoke endpoint anywhere in the repo (`grep -rn deleteEntity packages apps` returns nothing).

**UI reaction:** [`apps/web/components/passes-view.tsx#L28`](../apps/web/components/passes-view.tsx#L28) (countdown → *Expired*), timing logic tested in [`apps/web/lib/pass-timing.test.ts`](../apps/web/lib/pass-timing.test.ts).

**Steps (about 3 minutes):**

1. Run the app (`bun install && bun dev`, see README "Quick start") and follow [docs/JUDGE-WALKTHROUGH.txt](../docs/JUDGE-WALKTHROUGH.txt) steps 1–4, choosing **30 seconds** as access duration when publishing.
2. Buy the pass. Copy the API key `<passKey>.<secret>` shown after checkout, and open the pass in the Data Explorer: `https://data.arkiv.network/?q=$key = key(<passKey>)&chain=tiramisu`.
3. Call the API before expiry: `bun tools/call-service.ts <serviceId> "<passKey>.<secret>"` → 200 with the service answer.
4. Wait ~40 s. Run the exact same command → **403 "Access pass not found on Arkiv or expired."** Reload the Data Explorer query → no entity. "My passes" shows *Expired*, "Sales" still lists the receipt with `pass_key` = the vanished key.

**Known limitations:** no recorded video yet; the shipped demo services sell 7-day passes, so use a fresh 30-second listing to see the boundary. Arkiv's estimated expiry block is what the UI counts down to (block time 2 s, so ±1 block). Live access checks poll on demand; there is no WebSocket subscription in this build.
