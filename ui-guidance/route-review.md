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

## Hero asset

Built-in ImageGen output: [api-connection.png](../apps/web/public/images/api-connection.png).

Prompt:

> Use case: stylized-concept. Asset type: premium API marketplace landing page hero illustration. Create one refined studio still life that symbolizes software connections: a single continuous orange ribbon cable curving in an elegant architectural arc between two small brushed graphite connector blocks, one near foreground lower left, the other rear upper right. Mechanical precision, simple sculptural silhouette, subtle orange #ff7847 satin finish, graphite hardware, charcoal #121311 seamless background. Three quarter overhead camera, tightly considered asymmetric composition, soft studio side lighting, tactile material detail, restrained shadows. Landscape 3:2 composition, the sculpture fills about 70% of image with calm negative space around it, all objects fully in frame. No text, labels, logos, symbols, computer UI, mock screenshot, gradients blobs, glow, extra ornaments or floating particles. This is a conceptual image for a calm developer tool, not an advertisement for a physical product.
