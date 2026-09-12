# APIritivo UI system

Premium orange developer tooling, extracted from three reference directions and adapted to this Bun / Next.js / Tailwind v4 repo. Open `/design-system` on the local app for a living component reference. The homepage and marketplace demonstrate the system with the product's existing flows.

## Reference extraction

Reviewed the public HTML and styles on 12 September 2026. This is a pattern extraction, not a vendored copy of the reference sites. No third-party scripts, brand logos, proprietary font files, or backend integrations were added.

| Reference | Observed patterns | APIritivo adaptation |
| --- | --- | --- |
| [Arkiv](https://arkiv.network/) | Heavy display hierarchy, indexed sections, compact actions; public CSS specifies orange `#fe7446`, ink `#111`, sand `#f6f4ef`, Brutal Type and IBM Plex Mono. | Large editorial headline, numbered discovery flow, fine section rules, our own `#ff7847` orange and original brand mark. |
| [Arkiv documentation](https://docs.arkiv.network/) | Orange accents, bordered quick-start panels, technical labels, copyable network information and code-focused typography. | Readable API panels, restrained metadata, shared form fields, a navigable UI reference page. |
| [Supabase](https://supabase.com/) | Product-led hierarchy, interactive code/product previews, semantic surface and foreground tokens, compact controls. Its public styles include Manrope, Inter, and Source Code Pro. | Dark semantic surfaces, a manifest/request example selector, clear action hierarchy, Manrope with the repo's JetBrains Mono. |

The visual direction is original to APIritivo. The reference sites are sources of design patterns, not runtime dependencies. Supabase is a visual reference only; the application still uses its existing Swarm, Arkiv, and Fuji architecture.

## Foundations

The source of truth is `apps/web/app/globals.css`. Keep existing `ink-*` and `spritz-*` names compatible with current pages; prefer semantic aliases in new components.

| Intent | Tailwind utility | Value |
| --- | --- | --- |
| Page canvas | `bg-canvas` | `#121311` |
| Standard panel | `bg-surface` | `#191a17` |
| Raised or hovered surface | `bg-surface-raised` | `#20211d` |
| Main content | `text-content` | `#f4f3eb` |
| Secondary content | `text-muted` | `#bfc0b5` |
| Supporting metadata | `text-subtle` | `#a2a399` |
| Primary action | `bg-accent` | `#ff7847` |
| Hover action | `bg-accent-hover` | `#ff9465` |
| Orange text | `text-accent-text` | `#ffb28d` |
| Decorative separator | `border-line` | `#34352e` |
| Control boundary | `border-line-strong` | `#65665b` |
| Control radius | `rounded-control` | 8px |
| Panel radius | `rounded-panel` | 14px |

Orange buttons use dark text. Use the lighter accent-text token for small orange text on dark surfaces. Success and error keep distinct labels or symbols as well as color. Category hues are categorical, not connection-health indicators.

Typography uses `Manrope` and `JetBrains_Mono` through the existing `next/font/google` integration in `app/layout.tsx`; no dependency was added. The font variables are `--font-manrope` and `--font-code` so the Tailwind `font-mono` alias does not refer to itself. Font retrieval at build time follows the existing Next.js setup.

Use `.hero-title` for the homepage display and `.section-heading` for page and section headings. Body text stays 14–18px; mono is for code, IDs and exact values. Work in 4px spacing increments, with 24–32px panel padding and 64–80px between major sections.

## Shared components

| Component / class | Source | Use |
| --- | --- | --- |
| `Button` | `components/ui.tsx` | `primary`, `ghost`, `subtle`, `danger`; sizes `sm`, `md`, `lg`; links use `href`, actions use `onClick`, forms use `type="submit"`. |
| `Eyebrow`, `SectionTitle` | `components/ui.tsx` | Section orientation and consistent page heading hierarchy. `SectionTitle` renders an `h1`, so use once per page. |
| `BrandMark` | `components/ui.tsx` | Original small APIritivo mark; decorative SVG paired with visible text or a labeled link. |
| `Badge`, `CategoryPill`, `ProofChip`, `Avatar`, `RefField` | `components/ui.tsx` | Roles, categories, provenance, identity and copyable references. Only use positive proof states when backed by the application data. |
| `CodePanel` | `components/code-panel.tsx` | String code, title, optional language and footer; line numbers, horizontal scrolling, copy feedback, and a manual fallback when clipboard access fails. Never executes code. |
| `JsonInspector` | `components/ui.tsx` | Collapsed JSON disclosure using `CodePanel`; preserves the existing `value`, `title`, `defaultOpen` API. |
| `ApiExample` | `components/api-example.tsx` | Illustrative manifest/request selector. Typed against `ServiceManifest`; request matches `/api/gateway/[serviceId]`. All hostnames, service IDs and keys are placeholders. |
| `EmptyState`, `ErrorNotice`, `Skeleton` | `components/ui.tsx` | Existing reusable states, with consistent surfaces and error/status announcements. Use `announce={false}` only for static `ErrorNotice` examples. |
| `.field-control` | `app/globals.css` | Input, select and textarea foundation. Pair with a visible label, preserve native attributes, and add `aria-invalid` when invalid. Utilities can adjust dimensions. |
| `.card`, `.glass` | `app/globals.css` | Compatibility panel styles across existing routes. Both intentionally share opaque surfaces and the panel radius. |
| `.card-interactive`, `.card-selected` | `app/globals.css` | Opt into hover/focus emphasis or persistent selection. Ordinary data panels do not move on hover. |

### Example

```tsx
import { Button, Eyebrow } from "@/components/ui";

export function ProviderIntro() {
  return (
    <section className="card p-6">
      <Eyebrow>For providers</Eyebrow>
      <h2 className="mt-4 text-2xl">Publish your API.</h2>
      <div className="mt-6">
        <Button href="/provider/new">Get started</Button>
      </div>
    </section>
  );
}
```

## Integration boundaries

- The app shell, homepage, marketplace, service cards and role chooser use the new system directly. Shared panels, controls, typography and JSON inspectors carry it into passes, service details and provider views.
- Provider publishing, operations editing, bot calls and wallet forms reuse `.field-control`; their handlers and data flows are retained.
- The Swarm sign-in dialog and its SDK iframe remain mounted once. Styling must never remount the frame or synthesize a click on the SDK button. Authentication changes are outside this UI work.
- Preserve server routes, contract settings, payment signing, manifest serialization and Arkiv attributes when extending the design.
- Use real marketplace data. Illustrative API examples stay explicitly labeled and never send requests or trigger payments.
- All external reference links use normal hyperlinks. Nothing fetches source-site styles or scripts at runtime.

## Responsive and interaction rules

The hero stacks before desktop width; mobile navigation occupies its own row rather than competing with identity controls. Grid children use `min-width: 0`. Long code scrolls within its panel, while addresses wrap or truncate. Keep controls labeled, active navigation marked with `aria-current`, and selection buttons marked with `aria-pressed`.

The system includes a skip link, visible focus outlines, disabled controls and `prefers-reduced-motion`. Avoid perpetual decorative animation. Color changes are sufficient for interactive cards; do not animate ordinary form or payment panels.

Form controls use 16px text on narrow screens and 14px from 640px upward. Static component examples do not announce fake errors; real errors retain live announcements.

## Validation status and manual review

Implementation was reviewed by reading the changed source. No tests, lint, typecheck, build, or browser session were run for this UI change, following the user's instruction to handle testing personally. Visual fit and runtime behavior remain for manual verification.

Suggested review routes: `/`, `/marketplace`, `/design-system`, `/provider/new`, `/passes`, and an existing service detail page. Check narrow layouts, keyboard focus, long values, code copying, and the manifest/request selector. Confirm the existing Swarm sign-in handover separately; the new styling does not establish that authentication issue as resolved.
