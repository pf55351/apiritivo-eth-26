# Route review

2026-09-12 · `feat/ui` · Source review only.

## Design read

API marketplace for developers. Calm, premium, orange. Supabase inspired typography and controls. Preserve branding and route structure.

Starting points: equal hero columns, repeated actions and explanations, bordered navigation, duplicated previews, dense Docs.

Taste: variance 6 · motion 3 · density 3. Project layout, copy, and review skills cover product routes.

## Route pass

| Route | Context and essentials | Consolidation | Source checks |
| --- | --- | --- | --- |
| `/` | Understand product; explore or publish | Focused hero, one conceptual image, compact infrastructure links, working format example | Role aware actions; example labeled; image dimensions and responsive sizes; login flow preserved |
| `/marketplace` | Find and compare APIs | Search, category, result count; flat listings | Filters and empty/error states; long text; link target |
| `/services/[serviceId]` | Inspect, buy, call | Operations beside access; raw manifest below; technical details closed | Price, duration, network; pass loading/error visible; request endpoint label matches caller |
| `/passes` | Reuse purchased access | Name, expiry, copy actions, Use API; receipt closed | Failed load never looks empty; expiry states; keys stay hidden until requested |
| `/provider` | Manage APIs and earnings | Flat metrics; compact API rows; wallet and claim action | Unavailable metrics distinct from zero; sales feed waits for provider address |
| `/provider/new` | Publish a listing | Plain section headings; compact preview; optional details closed; brief success | Field order and handlers; public listing notice; private file grants; validation retained |
| `/choose-role` | Pick a workspace | Two plain action rows | Saved view and navigation preserved; keyboard buttons |
| `/docs` | Learn or troubleshoot | Topics expand on demand; short overview; reference tables retained | Existing anchors; hash opens topic; no scroll listeners; walkthrough labels updated |
| `/design-system` | Reuse actual UI | Fewer labels; flat examples; underline navigation preview | Shared tokens and components; sample actions stay local |

## Shared review

* Transparent navbar; white underline; role navigation preserved.
* Focus styles, reduced motion, reduced transparency fallback.
* Charcoal, orange, Inter, Manrope, Source Code Pro preserved.
* Swarm sign in frame stays mounted once.
* No payment, publication, transfer, or private key export triggered.
* No tests, builds, lint, typechecks, Lighthouse, or browser checks run, per user request.
* `git diff --check` used for whitespace only.
* Independent source review: no required findings in the changed routes, shared navigation, or example components.
* Runtime layout, mobile rendering, authentication, payments, and publication remain for user verification.

## Hero artwork update

Replaced the physical cable illustration with fine orange data strands. Soft edge masking blends the artwork into the page. The image enters over 700 ms and fades away as it leaves the viewport, reversing when scrolling back. Only the decorative artwork animates. The scroll effect is progressive enhancement; reduced motion keeps the image static.

Scale follow-up: artwork now spans the landing width behind the hero and infrastructure row. Responsive oversized framing, a canvas veil beneath the copy, and soft outer masking replace the separate image column. The foreground stays in normal flow; only the decorative layer is clipped. Image sizing hints match the larger display. Source review only; no tests or browser checks run.

Source review: image dimensions and responsive sizing retained; no new dependencies, scroll listeners, or changes to login and workspace actions. Runtime animation and browser support were not tested, following the user's instructions. Scroll range reference: [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-range).

Built-in ImageGen output: [api-flow.png](../apps/web/public/images/api-flow.png). Previous landing asset.

Prompt:

> Use case: stylized-concept. Asset type: APIritivo developer marketplace landing page hero. Replace the heavy physical ribbon cable and connector blocks in the reference with one refined abstract stream of very fine orange optical fibers, symbolizing API requests flowing between applications. Keep the orange #ff7847 and warm charcoal #121311 palette and the sweeping lower-left to upper-right diagonal composition. About 20 precision fine threads travel as one elegant open S curve across the central 65% of the image; their ends become progressively thinner and dimmer until they disappear into the charcoal negative space. No hardware blocks, no thick ribbon, no closed ring, no planets, no coins, no interface, no text, logos, labels, sparkles, random particles or neon fog. Use restrained warm highlights, crisp individual fine strands near the center, elegant depth from gentle perspective, and quiet studio lighting. The backdrop must be entirely flat matte #121311 at all four edges, no horizon or textured floor, with wide generous empty margins. The outer silhouette should dissolve smoothly into that background without a rectangular boundary. Landscape 3:2, 1536 by 1024. A premium understated technical visual, delicate and airy.

## Artwork clarity update

Current asset: [api-flow-hd.png](../apps/web/public/images/api-flow-hd.png), 3072 × 2048. Built-in ImageGen cleaned the approved strands but returned 1536 × 1024 despite the requested dimensions. Resized the cleaner output with macOS `sips` to the requested delivery dimensions. This is an upscale, not native 3K detail.

The landing image now requests quality 100, uses auto height to preserve the source ratio, and declares responsive sizes including its minimum cover width. Its new filename avoids reuse of the old image URL. Oversized placement, foreground veil, edge masking, scroll fade, and reduced motion behavior remain. No blur or sharpen filter added. Source and asset inspection only; no tests or browser flows run.

Prompt:

> Edit the attached APIritivo hero artwork to remove grain and improve resolution. Deliver a genuine 3072 x 2048 pixel image (3:2), suitable for display at 1536 CSS pixels on a 2x Retina screen. Preserve the existing composition exactly: one open sweeping S-shaped group of thin orange #ff7847 strands flowing diagonally from lower left to upper right, with fine tapered ends fading into a warm charcoal #121311 background. Preserve the curve, framing, amount of empty space and roughly twenty strands; do not redesign or add elements. Re-render edges cleanly at the larger native resolution, with smooth continuous strands, delicate highlights, and crisp antialiasing. Remove all photographic grain, speckling, mottled texture, dithering, banding, sharpening halos and JPEG artifacts. Background must be completely smooth, flat charcoal, particularly all four edges. Avoid extra glow or bloom, fuzz, smoke and particles. No text, logos, UI, labels, rectangles, hardware or new shapes. This is a high-resolution cleanup and enlargement of the approved image, not a new visual concept.

## Previous hero asset

Built-in ImageGen output: [api-connection.png](../apps/web/public/images/api-connection.png).

Prompt:

> Use case: stylized-concept. Asset type: premium API marketplace landing page hero illustration. Create one refined studio still life that symbolizes software connections: a single continuous orange ribbon cable curving in an elegant architectural arc between two small brushed graphite connector blocks, one near foreground lower left, the other rear upper right. Mechanical precision, simple sculptural silhouette, subtle orange #ff7847 satin finish, graphite hardware, charcoal #121311 seamless background. Three quarter overhead camera, tightly considered asymmetric composition, soft studio side lighting, tactile material detail, restrained shadows. Landscape 3:2 composition, the sculpture fills about 70% of image with calm negative space around it, all objects fully in frame. No text, labels, logos, symbols, computer UI, mock screenshot, gradients blobs, glow, extra ornaments or floating particles. This is a conceptual image for a calm developer tool, not an advertisement for a physical product.
