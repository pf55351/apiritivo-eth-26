# APIritivo — use cases

Extracted from `README.md`, `docs/JUDGE-WALKTHROUGH.txt`, `docs/pitch-3min.md` and `apps/web/README.md`.
Two actors: **Creator** (publishes and sells an API) and **Buyer** (pays and calls it). Both are Swarm ID identities; a judge can play both with two browser profiles.
External systems: **Swarm ID** (login), **Swarm** (manifest bytes), **Arkiv** (registry), **Fuji** (USDC + `APIritivoPayments`), **App server** (4 API routes).

| ID | Name | Actor | Screens |
| --- | --- | --- | --- |
| UC-001 | Sign in with Swarm ID and choose a role | Creator, Buyer | Home, Role |
| UC-002 | Publish a service | Creator | Provider, Publish, Publish success |
| UC-003 | Fund the Swarm wallet | Buyer (Creator for claim gas) | Service, Wallet |
| UC-004 | Buy access to a service | Buyer | Marketplace, Service |
| UC-005 | Call a purchased API | Buyer, Agent/script | Service › Try the bot, terminal |
| UC-006 | Review my passes and expiry | Buyer | My passes |
| UC-007 | Track sales and verify on Arkiv | Creator | Provider, Arkiv Data Explorer |
| UC-008 | Claim earnings and move funds | Creator | Provider › Wallet |

---

## UC-001 — Sign in with Swarm ID and choose a role

- **Actors:** User (Creator or Buyer), Swarm ID popup, App
- **Preconditions:** app running; popups allowed for the app origin
- **Main flow:**
  1. User opens Home and clicks *Enter with Swarm ID*.
  2. App opens the sign-in dialog holding the Swarm ID iframe; user clicks the SDK button.
  3. Popup on swarm-id.snaha.net: user creates an identity or signs in. No wallet, no seed phrase.
  4. Popup closes; app shows the identity name and derives the Swarm wallet in the background.
  5. Role screen: user picks *Client* or *Provider*.
  6. App stores the role per identity (localStorage) and routes to Marketplace or Provider.
- **Alternative flows:**
  - 3a. Popup blocked → sign-in card shows "nothing appeared?" with *retry*.
  - 3b. User closes the popup → back to Home, no session.
  - 5a. Returning identity with a stored role → Role screen skipped.
  - 6a. Wallet derivation fails → screens still work; wallet-dependent buttons disabled with an error notice.
- **Postconditions:** session with identity id + name; role preference; Swarm wallet address available.

## UC-002 — Publish a service

- **Actors:** Creator, App, Swarm, App server (Arkiv writer)
- **Preconditions:** UC-001 done; Arkiv writer funded with GLM (chip is green)
- **Main flow:**
  1. Creator opens Provider › *Publish a service*.
  2. Fills name, description, category, price (USDC), duration, at least one operation with typed inputs. Payout = Swarm wallet (fixed, shown).
  3. Clicks *Publish*. App builds the manifest and uploads it to Swarm (`uploadData`; fallback: direct gateway `POST /bytes`).
  4. App `POST /api/services` with the manifest reference and the listing fields.
  5. Server creates the permanent `service` entity on Arkiv and returns entity key + tx hash.
  6. Success screen: proof chips for Swarm (bytes) and Arkiv (Data Explorer query), *Open service*, *Back to dashboard*.
- **Alternative flows:**
  - 3a. Swarm ID cannot upload for this identity → automatic direct gateway upload.
  - 3b. Both uploads fail → "Manifest upload failed." Form kept, retry.
  - 5a. Writer unfunded / RPC error → "Arkiv publication failed." with reason in the dev details. Nothing written; retry re-uses the Swarm ref.
  - 2a. Validation errors → inline list next to the *Publish* button, button disabled.
- **Postconditions:** listing visible in Marketplace; manifest immutable on Swarm; service id known.

## UC-003 — Fund the Swarm wallet

- **Actors:** Buyer (or Creator), external faucets, Fuji
- **Preconditions:** UC-001 done; wallet address shown in the Service access card or the Provider wallet panel
- **Main flow:**
  1. User copies the Swarm wallet address from the access card (Buyer) or the wallet panel (Creator).
  2. Opens the AVAX faucet (gas) and the USDC faucet (Circle) from the links in the same card; pastes the address.
  3. Returns to the app and clicks *refresh* until balances are non-zero.
- **Alternative flows:**
  - 2a. Faucet rate-limited → wait or use MetaMask as payment method instead.
  - 3a. Buyer has USDC but no AVAX → *Buy* stays disabled with the gas hint.
- **Postconditions:** wallet holds enough USDC for the price and AVAX for two transactions.

## UC-004 — Buy access to a service

- **Actors:** Buyer, App, Fuji (`APIritivoPayments`, USDC), App server, Arkiv
- **Preconditions:** UC-003 done; service purchasable (price, duration, payout present)
- **Main flow:**
  1. Buyer opens Marketplace, picks a service (live Arkiv query), reads the manifest and price.
  2. Chooses *Pay with: Swarm wallet* (default) or MetaMask. Clicks *Buy access · 0.50 USDC*.
  3. App: `approve` USDC → `buy(payout, keccak(serviceId), amount, seconds)`; waits for the receipt.
  4. App generates a random pass secret, hashes it, encrypts it for this identity.
  5. App `POST /api/access-passes` {serviceId, buyerId, buyerAddress, txHash, secretHash, encryptedSecret}.
  6. Server: no sale with this tx yet → verifies the `Purchased` event on Fuji → mints `access_pass` (expiring) + `sale` (permanent) on Arkiv.
  7. Access card turns green: "Unlocked · time left", pass key, Arkiv link, **Your API key** `<passKey>.<secret>` with *Copy*.
- **Alternative flows:**
  - 2a. Insufficient USDC/AVAX → button disabled + faucet links (UC-003).
  - 3a. User rejects in MetaMask → "Payment was rejected." stay on step 2.
  - 3b. Tx reverted → "Payment failed." with Snowtrace link.
  - 6a. Tx already used → 409 "already used for an access pass" (pass key returned).
  - 6b. Verification fails (wrong amount/recipient/sender) → 402 with reason; USDC already spent: contact provider (hackathon boundary).
  - 6c. Arkiv write fails → 502; payment done, pass not minted; retry with the same tx is safe.
  - Direct mode (no contract configured): step 3 is a single USDC `transfer`; server verifies the `Transfer` log.
- **Postconditions:** live pass on Arkiv; permanent receipt; buyer holds the only decryptable copy of the secret.

## UC-005 — Call a purchased API

- **Actors:** Buyer (browser) or Agent/script (terminal), App server, Arkiv, provider endpoint or demo bot
- **Preconditions:** UC-004 done; API key `<passKey>.<secret>` available
- **Main flow (browser):**
  1. On the Service page, *Try the bot* section is enabled (key auto-decrypted from the pass).
  2. Buyer picks an operation, fills typed inputs, clicks *Run*.
  3. App `POST /api/bot/<serviceId>` with `Authorization: Bearer <passKey>.<secret>`.
  4. Server reads the pass entity on Arkiv, checks service id, expiry block, `keccak256(secret) == secret_hash`.
  5. Response shows "Pass verified on Arkiv ✓ · expires in N s" and the result (live price for `getQuote`).
- **Main flow (terminal):** `bun tools/call-service.ts <serviceId> "<key>" getQuote '{"symbol":"ETH"}'` → `POST /api/gateway/<serviceId>`; same verification; forwards to the manifest `endpoint` if present, else demo bot.
- **Alternative flows:**
  - 3a. No header / malformed → 401 "Missing access pass".
  - 4a. Pass missing (expired, Arkiv deleted it) → 403 "not found on Arkiv or expired".
  - 4b. Wrong service → 403; wrong secret → 403 "Pass secret does not match".
  - 5a. Upstream endpoint down → 502 with `upstream` in the body.
- **Postconditions:** none on-chain; a read only.

## UC-006 — Review my passes and expiry

- **Actors:** Buyer, App, Arkiv
- **Preconditions:** UC-001 done
- **Main flow:**
  1. Buyer opens *My passes*.
  2. App queries `access_pass` where `buyer_id = me` and `getBlockTiming()`; countdown per pass computed from blocks.
  3. Each row: service name, time left, pass key, *Copy API key* (decrypts secret), Arkiv link, payment tx link, *Open service*.
- **Alternative flows:**
  - 2a. No passes → empty state with *Browse marketplace*.
  - 3a. Legacy pass without secret → row shows "cannot be used, buy again".
  - Pass expired → simply gone from the list on refresh.
- **Postconditions:** none.

## UC-007 — Track sales and verify on Arkiv

- **Actors:** Creator, App, Fuji logs, Arkiv, Data Explorer
- **Preconditions:** UC-002 done; at least one purchase
- **Main flow:**
  1. Creator opens Provider. *Live on chain* pill shows the Fuji watcher is polling.
  2. A purchase lands → toast "New sale · 0.50 USDC" → Arkiv lists refresh.
  3. Dashboard: published services, earnings (Σ receipts), recent sales with buyer, amount, Fuji tx, *Sale receipt on Arkiv*.
  4. Creator opens a receipt in the Data Explorer (`$key = key(…)`) and reads `buyer_id`, `buyer_address`, `tx_hash`, `paid_usdc`, `pass_key`.
- **Alternative flows:**
  - 1a. Watcher error (RPC) → pill "Offline", lists still load on *Refresh*.
  - 3a. No sales yet → empty state "No sales yet".
- **Postconditions:** none.

## UC-008 — Claim earnings and move funds

- **Actors:** Creator, App, Fuji (`APIritivoPayments`, USDC)
- **Preconditions:** contract mode; UC-007 shows claimable > 0; Swarm wallet has AVAX (UC-003)
- **Main flow:**
  1. In Provider › *Your Swarm wallet*, block *Earnings held by the contract* shows claimable and lifetime totals.
  2. Creator clicks *Claim to my Swarm wallet*. App sends `claim(swarmWallet, 0)` signed by the derived key.
  3. Tx link appears; USDC balance and claimable refresh.
  4. Optional: *Send USDC from this wallet* → destination + amount (or *send all*) → USDC `transfer`.
  5. Optional: *Reveal private key* to import the wallet into MetaMask.
- **Alternative flows:**
  - 2a. No AVAX → tx fails "insufficient funds for gas"; faucet link above.
  - 2b. Claimable 0 → button disabled.
  - 4a. Invalid address/amount → button disabled.
  - Direct mode → block 1 hidden; funds are already in the wallet, only step 4 applies.
- **Postconditions:** USDC in the Swarm wallet (or forwarded); `Claimed` event on Fuji.
