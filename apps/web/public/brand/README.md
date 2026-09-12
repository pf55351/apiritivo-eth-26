# APIritivo brand assets

Original transparent PNG exports imported from Downloads on 2026-09-12.
The files retain their original pixels, dimensions, and transparency.

## Logos

Horizontal wordmarks are 2172 × 724 pixels. `light` and `dark` name the
intended background, not the text color.

| File | Appearance | Original download |
| --- | --- | --- |
| `logos/apiritivo-logo-light.png` | Orange API, charcoal ritivo | `06_21_32 PM (1).png` |
| `logos/apiritivo-logo-dark.png` | Orange API, warm white ritivo | `06_21_33 PM (2).png` |
| `logos/apiritivo-logo-monochrome.png` | Charcoal symbol and wordmark | `06_21_33 PM (3).png` |

## Symbols

Standalone symbols are 1254 × 1254 pixels.

| File | Appearance | Original download |
| --- | --- | --- |
| `icons/apiritivo-symbol.png` | Primary orange brackets and aperitivo glass | `06_21_34 PM (4).png` |
| `icons/apiritivo-symbol-alternate.png` | Alternate color symbol with slightly different proportions | `06_21_34 PM (5).png` |
| `icons/apiritivo-symbol-monochrome.png` | Charcoal symbol | `06_21_35 PM (6).png` |

All original download names begin with `ChatGPT Image Sep 12, 2026, `.

## App usage

Public asset URLs begin with `/brand/`, for example
`/brand/logos/apiritivo-logo-dark.png`.

`../../app/icon.png` is a 512 × 512 favicon derived from `icons/apiritivo-symbol.png`.
The original is center cropped to 1046 × 1046, then resized so the mark fills
about 96% of the icon width. Transparency, colors, and proportions are preserved.
Next.js App Router discovers this file and adds the browser icon metadata
automatically. Rebuild this tightly framed variant when replacing the primary symbol.

The supplied exports are PNG files. SVG and ICO exports were not supplied.
