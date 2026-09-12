# Appearance

APIritivo has two appearances: dark charcoal and light warm white. Appearance is
independent of the Client / Provider workspace and applies to the whole app.
Keep the orange brand, typography, spacing, and simple account placeholder.

## Palette

The light neutrals keep the existing warm olive undertone. Use semantic tokens
in components so surfaces, text, states, and focus change together.

| Role | Dark | Light | Use |
| --- | --- | --- | --- |
| Canvas | `#121311` | `#F7F7F2` | Page background |
| Surface | `#191A17` | `#FDFDF9` | Cards and toolbars |
| Raised surface | `#20211D` | `#EFEFE7` | Menus and hover surfaces |
| Active surface | `#272823` | `#E6E7DE` | Initials and switch track |
| Content | `#F4F3EB` | `#20211D` | Headings and body |
| Secondary content | `#DEDED3` | `#35372F` | Code and references |
| Muted text | `#BFC0B5` | `#505349` | Supporting text |
| Subtle text | `#A2A399` | `#64675B` | Metadata and placeholders |
| Divider | `#34352E` | `#D6D8CC` | Decorative separation |
| Control border | `#747569` | `#828675` | Inputs and secondary buttons |
| Brand fill | `#FF7847` | `#FF7847` | Primary buttons |
| Brand hover fill | `#FF9465` | `#FF9465` | Primary hover |
| Text on brand | `#121311` | `#121311` | Primary labels, colored avatar initials |
| Accent text | `#FFB28D` | `#A63B17` | Links and accent headings |
| Focus / selected | `#FF9465` | `#B4431D` | Focus rings and selected outlines |
| Success | `#B5D49A` | `#3D642C` | Verified, available, completed |
| Warning | `#FDE68A` | `#805410` | Pending and caution |
| Danger | `#F5A1A1` | `#A82D31` | Errors and destructive actions |

## Contrast review

Calculated with sRGB relative luminance before implementation. On the light
canvas, content is 15.07:1, muted text 7.31:1, and accent links 6.00:1.
The faintest text exceeds 4.5:1 on canvas, surface, raised, and active surfaces.
Control borders exceed 3:1 on those surfaces; decorative dividers have no
information-bearing role. Primary labels remain charcoal on orange (7.12:1).
Light primary buttons also receive a darker orange boundary. State labels
always include text or symbols; color is supplementary.

## Integration

* Use shared semantic tokens for every route, form, disclosure, code panel,
  avatar, badge, error, loading state, and account menu.
* Use the supplied light wordmark on light surfaces and the supplied dark
  wordmark on dark surfaces. Keep the original artwork files.
  Sponsor strips follow the surface palette: warm white with dark wordmarks in
  Light, charcoal with white wordmarks in Dark. Preserve Team1's red accent.
* Keep the navbar transparent and blurred. Its underline follows content color.
* Reuse the hero artwork with theme-specific presentation and the same canvas
  veil; it must dissolve into the light background as well as the dark one.
* Use an icon-only appearance picker: monitor for Auto (the default), sun for
  Light, and moon for Dark, with accessible labels and 44px keyboard/touch targets.
  Keep account, workspace switch, and settings gear (Docs + theme) in that relative order.
* Default to Auto, following the computer's color scheme before the first paint
  and when it changes. Preserve saved Light and Dark overrides. Save appearance
  separately from workspace and identity and synchronize it across tabs.
* Switching appearance must preserve page state and the mounted Swarm ID frame.
  If browser storage is unavailable, switching still works for the current page.
* `/design-system` previews each palette and its values through the switch. Check
  desktop and narrow screens, keyboard operation, persistence, and both themes.

## Verification

Implemented with the shared semantic tokens. Automated contrast tests cover text
on all four surfaces, tinted state badges, control boundaries, and primary
labels in both themes. Startup tests cover both system appearances with saved,
invalid, and blocked storage. Runtime tests cover live system changes, manual
overrides, returning to Auto, cross-tab updates, and listener cleanup.

Browser checks covered light and dark documentation, the light hero, palette
previews and form controls, Space / Enter switching, input preservation, reload
persistence, and header fit at 320, 640, 1024, and 1280px. Typecheck, lint, 124
application tests, 28 offline contract tests, and an isolated production build
passed. Two live-chain tests were skipped. The build retains a dependency warning
from `ox` / `viem`; no theme or hydration errors were observed.

The system-theme follow-up passed typecheck, lint, and 137 application tests
(two live-chain tests skipped). Browser checks confirmed Auto matches the
computer, Light persists after reload, Dark overrides work, returning to Auto
persists, disclosures remain open during switching, and arrow keys plus Enter
operate the selector. The header fits at 320px and 1280px without horizontal
overflow. No browser errors were observed. Live OS changes and storage edge
cases are covered by automated tests; the computer's settings were not changed.
