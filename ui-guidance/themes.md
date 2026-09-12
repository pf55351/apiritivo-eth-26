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
| Control border | `#65665B` | `#828675` | Inputs and secondary buttons |
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
* Keep the navbar transparent and blurred. Its underline follows content color.
* Reuse the hero artwork with theme-specific presentation and the same canvas
  veil; it must dissolve into the light background as well as the dark one.
* Add a quiet sun / moon appearance switch with a 44px keyboard/touch target.
  Keep Docs, account, and workspace switch in that relative order.
* Default to the existing dark appearance. Save the explicit choice separately
  from workspace and identity preferences and apply it before the first paint.
* Switching appearance must preserve page state and the mounted Swarm ID frame.
  If browser storage is unavailable, switching still works for the current page.
* `/design-system` previews the active palette and both sets of values. Check
  desktop and narrow screens, keyboard operation, persistence, and both themes.

The palette is ready for implementation after replacing fixed white accents,
separating orange fill from orange text, and handling the supplied logo and hero.
