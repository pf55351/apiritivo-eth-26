# UX Flows — APIritivo

Generated with the `ux-flow-designer` skill from the project docs (README, judge walkthrough, pitch, web README). Input was the existing documentation, not a PRD. The goal was to find every flow described in the docs, draw it, and simplify it.

## Master screen map

[diagrams/screen-map.md](diagrams/screen-map.md)

## Screen inventory

| Screen | Route in app | Purpose | Wireframe | Use cases |
| --- | --- | --- | --- | --- |
| Home / Sign in | `/` | Swarm ID entry point | [home.html](wireframes/home.html) | UC-001 |
| Role chooser | `/choose-role` | Client / Provider preference | [role.html](wireframes/role.html) | UC-001 |
| Marketplace | `/marketplace` | live Arkiv listings | [marketplace.html](wireframes/marketplace.html) | UC-004 |
| Service page | `/services/[id]` | manifest, buy, proofs | [service.html](wireframes/service.html) | UC-004 |
| Service page · unlocked | `/services/[id]` | pass, API key, bot | [service-unlocked.html](wireframes/service-unlocked.html) | UC-004, UC-005 |
| Try the bot | section of `/services/[id]` | call the API | [try-bot.html](wireframes/try-bot.html) | UC-005 |
| My passes | `/passes` | live passes, countdown | [passes.html](wireframes/passes.html) | UC-006 |
| Provider dashboard | `/provider` | services, sales, live feed | [provider.html](wireframes/provider.html) | UC-002, UC-007 |
| Publish form | `/provider/new` | create a listing | [publish.html](wireframes/publish.html) | UC-002 |
| Publish success | `/provider/new` (done) | proofs | [publish-success.html](wireframes/publish-success.html) | UC-002 |
| Wallet panel | section of `/provider` | fund, claim, send, reveal | [wallet.html](wireframes/wallet.html) | UC-003, UC-008 |

## Use case diagrams

| Use case | Flow | States | Sequence |
| --- | --- | --- | --- |
| UC-001 Sign in and choose a role | [flow](diagrams/uc-001-sign-in/flow.md) | [states](diagrams/uc-001-sign-in/states.md) | [sequence](diagrams/uc-001-sign-in/sequence.md) |
| UC-002 Publish a service | [flow](diagrams/uc-002-publish/flow.md) | [states](diagrams/uc-002-publish/states.md) | [sequence](diagrams/uc-002-publish/sequence.md) |
| UC-003 Fund the Swarm wallet | [flow](diagrams/uc-003-fund-wallet/flow.md) | [states](diagrams/uc-003-fund-wallet/states.md) | [sequence](diagrams/uc-003-fund-wallet/sequence.md) |
| UC-004 Buy access | [flow](diagrams/uc-004-buy-access/flow.md) | [states](diagrams/uc-004-buy-access/states.md) | [sequence](diagrams/uc-004-buy-access/sequence.md) |
| UC-005 Call a purchased API | [flow](diagrams/uc-005-call-api/flow.md) | [states](diagrams/uc-005-call-api/states.md) | [sequence](diagrams/uc-005-call-api/sequence.md) |
| UC-006 Review my passes | [flow](diagrams/uc-006-my-passes/flow.md) | [states](diagrams/uc-006-my-passes/states.md) | [sequence](diagrams/uc-006-my-passes/sequence.md) |
| UC-007 Track sales and verify on Arkiv | [flow](diagrams/uc-007-track-sales/flow.md) | [states](diagrams/uc-007-track-sales/states.md) | [sequence](diagrams/uc-007-track-sales/sequence.md) |
| UC-008 Claim earnings and move funds | [flow](diagrams/uc-008-claim/flow.md) | [states](diagrams/uc-008-claim/states.md) | [sequence](diagrams/uc-008-claim/sequence.md) |

Full use case text: [use-cases.md](use-cases.md).

## Clickable prototype links

| From screen | Element | To screen |
| --- | --- | --- |
| home | Enter with Swarm ID | role |
| role | I'm a Client / I'm a Provider | marketplace / provider |
| marketplace | service card | service |
| service | Buy access | service-unlocked |
| service-unlocked | Try the bot | try-bot |
| passes | row · Open service | service-unlocked |
| provider | Publish a service | publish |
| provider | Your Swarm wallet | wallet |
| publish | Publish | publish-success |
| publish-success | Open service / Back | service / provider |
| any signed-in screen | tab bar | marketplace / passes / provider |

## Navigation patterns

- **One nav bar, three destinations** (Marketplace · My passes · Provider). Role only decides the landing page; nothing is hidden.
- **Proof chips open external tabs** (Arkiv Data Explorer, Snowtrace, Swarm gateway). They never navigate inside the app.
- **In-place state changes instead of new screens**: buying turns the access card green on the same page; publishing swaps the form for the success card; claiming updates the wallet block.
- **Back links** on every secondary screen; no modal chains except the Swarm ID dialog.

## Simplifications found while drawing the flows

These are the changes the diagrams argue for. Items marked *docs* are applied in `docs/JUDGE-WALKTHROUGH.txt`; items marked *app* are recommendations for the UI.

1. **Nine walkthrough steps → five phases** (*docs*). Judges think in phases: Setup · Creator · Buyer · Verify · Payout. Funding is folded into the Buyer phase because it is only ever needed right before *Buy*. The walkthrough now opens with this short path.
2. **Funding is one action, not two errands** (*app*). UC-003 sends the tester to two faucets with the address on the clipboard. Recommendation: a "Get test funds" card on the locked access card with the address pre-copied, both faucet links, and automatic balance polling for 2 minutes so *refresh* is not needed.
3. **One canonical place for the API key** (*docs + app*). The key appears in the buy-success box, the Try the bot box and My passes. The docs now point to one: the **Your API key** box on the service page right after buying, with My passes as the "later" place. In the app, the bot console can reference that box instead of repeating it.
4. **Role chooser only on first login** (*app*). Already implemented (stored per identity); the docs now say so, so testers do not look for it on the second login.
5. **Buy progress is one bar with two signatures** (*app*). Approve → buy → confirm → mint reads as four risks. Show it as one progress bar with "2 signatures, no popup" upfront; the sequence diagram shows only two user-visible waits.
6. **Claim then Send are separate blocks** (*app*, done). The wallet panel already splits "Earnings held by the contract → Claim to my Swarm wallet" from "Send USDC from this wallet", so the destination field can no longer redirect a claim.
7. **Wallet panel deserves an anchor** (*app*). It sits below the fold on `/provider`. A "Your Swarm wallet ↓" link in the stats row (as in the wireframe) removes a scroll hunt in UC-008.
8. **Expiry is a deletion, say it once** (*docs*). Every UC repeated "Arkiv deletes the entity". The walkthrough now states it in the intro and shows it once, in the negative checks of UC-005.

## Open questions for visual design

- Should the Try the bot section become the primary content of the unlocked service page, above the manifest?
- Do judges need the raw manifest JSON at all, or is the operations list enough with a "view raw" link?
- Direct mode (no contract) hides the claim block. Should the wallet panel say so explicitly, or is silence fine?

## Optional next step

The wireframes can be exported to Figma with the official Code to Canvas integration (Figma desktop with Dev Mode MCP Server). Ask for "export to figma" and the setup steps will be presented.
