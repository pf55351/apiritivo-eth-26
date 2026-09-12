# Wireframe inventory

Open `home.html` in a browser and click through. Pure HTML links, no JavaScript. Every screen has a back link or the tab bar, so there are no dead ends. The tab bar mirrors the app nav (Marketplace · My passes · Provider).

| Screen | File | Use cases | Key elements | Outgoing links |
| --- | --- | --- | --- | --- |
| Home / Sign in | [home.html](home.html) | UC-001 | Enter with Swarm ID, popup-blocked retry hint | role |
| Role chooser | [role.html](role.html) | UC-001 | identity chip, Client / Provider buttons | marketplace, provider, home |
| Marketplace | [marketplace.html](marketplace.html) | UC-004 | search, category pills, live service cards, empty state | service, tab bar |
| Service page | [service.html](service.html) | UC-004 | manifest operations, access card (locked), pay-with toggle, balances + faucets, Buy | service-unlocked, marketplace, tab bar |
| Service page · unlocked | [service-unlocked.html](service-unlocked.html) | UC-004, UC-005 | Unlocked countdown, pass key, **API key + Copy**, proofs | try-bot, marketplace, tab bar |
| Try the bot | [try-bot.html](try-bot.html) | UC-005 | operation, typed inputs, Run, verification line, script example, denied examples | service-unlocked, tab bar |
| My passes | [passes.html](passes.html) | UC-006 | rows with countdown, Copy API key, Arkiv + tx links, empty state | service-unlocked, marketplace, tab bar |
| Provider dashboard | [provider.html](provider.html) | UC-002, UC-007 | status chips, Live pill, stats, recent sales with receipt link, services, wallet link | publish, service, wallet, tab bar |
| Publish form | [publish.html](publish.html) | UC-002 | listing fields, fixed payout, operations builder, issues, Publish | publish-success, provider, tab bar |
| Publish success | [publish-success.html](publish-success.html) | UC-002 | Swarm / Arkiv / tx proofs, Open service, Back | service, provider, tab bar |
| Wallet panel | [wallet.html](wallet.html) | UC-003, UC-008 | address + balances + faucets, Claim to my Swarm wallet, Send USDC, Reveal key | provider, tab bar |

Note: in the real app the wallet panel and Try the bot are sections of `/provider` and `/services/[id]`, not separate routes. They are separate wireframes here so the flows stay readable.
