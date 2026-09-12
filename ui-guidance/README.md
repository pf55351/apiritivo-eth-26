# UI guidance

## Design Context

Audience: API developers, agent builders, providers.

Tasks: discover, inspect, buy access, call, publish, manage earnings.

Tone: technical, premium, simple.

Reference: [Supabase](https://supabase.com/). Keep APIritivo orange.

## Rules

* Short copy. Keywords preferred.
* Labels: 1 to 3 words. Headings: 2 to 5 words.
* Helper text only when needed. One brief sentence.
* No nested rectangular panels. Use rows, spacing, dividers.
* One primary action per section.
* No dash phrases in visible UI prose. Avoid hyphenated compounds and dash separators.
* Preserve exact URLs, code, identifiers, negative numbers, and user content.
* Keep price, network, duration, permissions, and errors explicit.
* SDK details: development disclosures.
* Default view: name, state, price or balance, duration, next action.
* Addresses, receipts, proofs, JSON, and export tools: closed disclosures.
* API keys: copy action first; reveal on request.
* One place for each metric. Label recorded sales separately from contract balances.
* Service page: access box beside the service introduction on desktop and immediately below it on mobile. Operations and tester stay together, with supporting data below. Highlight the access duration in orange.
* Checkout uses the Swarm wallet. Show its balance and funding controls without a wallet selector.
* Provider page: API list and wallet first. History and connection details below.
* Prefer borderless sections and simple rows. Use a surface only to focus a decision.
* Keep actionable errors and disabled action reasons visible outside disclosures.

These writing rules apply to product UI, including page titles. Technical documentation and code syntax keep their normal notation.

## Style

| Element | Rule |
| --- | --- |
| Body | Inter · regular |
| Headings | Manrope · medium · normal tracking |
| Code | Source Code Pro |
| Palette | Orange `#ff7847` · charcoal / warm white themes · [palette and contrast](themes.md) |
| Borders | 1px solid |
| Corners | Controls 6px · panels 12px |
| Buttons | Primary · secondary · subtle · danger |
| Layout | Flat · spacious · no panel inside panel |
| Interaction | Visible focus · reduced motion · mobile targets |

The account control uses a plain neutral circle with the user's initials.
Reuse `ProfileAvatar` in the header and account menu. Keep it free of decorative
rings and animation.

Favicon: use the original transparent brand symbol, tightly framed to about 96% of the canvas width. Preserve its proportions and export at 512 × 512. Keep full size brand exports unchanged.

Form fields and code editors may have functional boundaries. Remove extra decorative containers around them.

Marketplace cards lead with a larger semibold API title. Category names stay in
filters and API details, without a separate category row on each card. Keep the
price close to the provider and the arrow immediately beside "View API".

## Workspaces

* Client: Marketplace, My passes.
* Provider: My APIs, Publish.
* Docs and service details: shared. Service actions follow the active view; switching keeps the current API open.
* Order the right-side controls: Docs, account profile, workspace switch, appearance. On narrow screens, appearance sits beside the primary navigation on the second row.
* Header switch: compact toggle with an orange thumb and an animated role label beside it. Keep keyboard focus and reduced motion support.
* Navbar: transparent with backdrop blur. Active and hovered links use a thin content-colored underline, never a filled rectangle. Respect reduced transparency preferences.
* Appearance: Auto follows the computer's light or dark theme, including live changes. Offer saved Light and Dark overrides separately from workspace and identity. Use semantic color tokens throughout; orange button labels stay charcoal in both themes.
* Appearance control: icons only, with a monitor for Auto, sun for Light, and moon for Dark. Auto is the default. Keep accessible labels, keyboard selection, and 44px targets.
* Hide the other view's navigation and actions. Direct links require an explicit switch.
* Two identities, one per view: the Client identity is the connected wallet (MetaMask, Rabby, Core); the Provider identity is Swarm ID. Swarm ID may stay signed in while a wallet is the client, only to open private files. Save the view per identity; guests use a separate preference.
* View selection controls the interface, never permissions or payment validation.

## Source files

* [Live CSS](../apps/web/app/globals.css): tokens, variants, spacing.
* [Components](../apps/web/components/ui.tsx): reuse existing props.
* `Disclosure`: shared native disclosure for secondary information; children stay mounted.
* [Code panel](../apps/web/components/code-panel.tsx): code, copy, format controls.
* [Workspace switch](../apps/web/components/workspace-switch.tsx): Client and Provider views.
* `/design-system`: component preview, not a separate rulebook.

## Skills

* [Taste](https://github.com/Leonxlnx/taste-skill/tree/main/skills/taste-skill): landing pages and redesign review. Installed locally as `taste-skill` (skill name `design-taste-frontend`).
* [Layout](skills/apiritivo-ui-layout/SKILL.md)
* [Copy](skills/apiritivo-ui-copy/SKILL.md)
* [Review](skills/apiritivo-ui-review/SKILL.md)

All UI guidance lives here. Other repo files link here. Keep runtime and data rules in `CLAUDE.md`.

Taste settings: `DESIGN_VARIANCE=6`, `MOTION_INTENSITY=3`, `VISUAL_DENSITY=3`.
Preserve the existing brand in both dark and light themes. Keep interactions quiet. Use one purposeful hero image and the real API example component; avoid decorative filler.
Hero artwork uses fine orange data strands as an oversized background beneath the content. Keep the strongest orange on the right; a soft canvas veil using `--ui-canvas` protects copy and actions. Intersect horizontal and vertical fade masks so every edge reaches full transparency before clipping. Keep the upper boundary below the navbar; the bottom dissolves under the next section. Clip only the decorative layer to prevent horizontal overflow. A short entrance and a scroll exit affect only the artwork. Respect reduced motion and leave a static fallback for browsers without scroll timelines.
Preserve the artwork's intrinsic aspect ratio with auto height. Match image sizing hints to its full rendered width, including the minimum needed to fill the backdrop. Use the cleaned `api-flow-hd.png` asset at quality 100; do not add grain or sharpen filters. The 3072 × 2048 delivery asset is resized from a 1536 × 1024 ImageGen cleanup, not a native 3K render.
Taste covers marketing surfaces. Use the project skills for dashboards, forms, and reference tables.
For each route: context → essential information → consolidate → source review → next route. Follow the user's testing permissions.

Latest pass: [route review](route-review.md).
