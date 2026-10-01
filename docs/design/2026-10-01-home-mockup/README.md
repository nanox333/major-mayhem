# Home mockup follow-up: arena composition

The user supplied a 1402×1122 arena home mockup on October 1, 2026 and requested implementation issues and generated assets, then explicitly asked for issues before implementation. This branch contains design material and artwork only; application source is unchanged. Reviewed against main `90e63e9` (merged #213), including `Home.tsx`, `Modes.tsx`, `TopBar.tsx` and the editorial finishing styles.

## What changes the look

The current implementation has the correct daily headline and a useful lineup diagram, but its flat field, repeated Free Play diagram, small outline head and arrow-only secondary actions differ substantially from the supplied target. The reference gets its character from three purposeful images, a shorter header, a composed hero, visible Free Play configuration and compact information below it. The orange accent alone cannot achieve this.

Retain the shared shell width and stable layouts introduced by #213. Background can extend beyond the content rail, while header, copy, cards and archive remain aligned. Home-specific arena art does not require darkening every screen or replacing the light theme.

## Implementation issues

- [Build the arena-backed daily hero with the mockup’s headline and lineup composition](https://github.com/nanox333/major-mayhem/issues/214)
- [Replace schematic mode art with a traced equipment case and anonymous pro silhouette](https://github.com/nanox333/major-mayhem/issues/215)
- [Expose Free Play filters before starting a run, with a full-width Open case action](https://github.com/nanox333/major-mayhem/issues/216)
- [Tighten the home header and content rhythm to match the compact arena mockup](https://github.com/nanox333/major-mayhem/issues/217)
- [Match the mockup’s archive strip, icon-led stats and compact information footer](https://github.com/nanox333/major-mayhem/issues/218)

Suggested sequence: shell rhythm (#217), hero (#214), mode-card artwork (#215) and staged setup (#216) together, then lower-page details (#218). #112 remains the brand identity issue; this work does not create a competing logo project.

## Asset reference

![Generated sources and simplified SVG trace previews](asset-reference.jpg)

This is an asset comparison sheet, not an implemented page or measured browser screenshot. The user-supplied mockup is the layout target; the arena is newly generated decorative artwork. No text, logo, question mark, interface, player slots or bracket is baked into these assets.

- `assets/arena.webp`: panoramic arena, dark negative space for headline on the left and tactical silhouette on the right. Original PNG retained under `assets/sources/arena.png`. Use behind real HTML and SVG; add theme-aware scrims after checking contrast. The trace would sacrifice depth, so keep this compressed raster.
- `assets/case.svg`: genuine simplified color-path trace of the generated equipment case, transparent background. Intended upper-right of Free Play, leaving title and controls separate. The brand mark may be overlaid later from the real approved SVG source.
- `assets/pro-silhouette.svg`: genuine simplified path trace of the generated anonymous player, transparent background. Intended right side of Guess; question mark must be a separate scalable text/SVG element.
- `assets/case.webp` and `assets/pro-silhouette.webp`: compressed raster alternatives for visual comparison. A trace intentionally drops scratches, fabric and fine lighting. It is not a pixel-identical substitute; choose after comparison at actual card size.
- `assets/sources/*.png`: original full-resolution generation outputs copied without modifying their originals in `/workspace/generated_images`.

The SVGs contain paths, not embedded raster `<image>` elements. Both were rasterized and visually reviewed. Neither decorative cutout should receive focus; when integrated, use empty alt text or an aria-hidden SVG. The current trace SVG role is for standalone preview, not an accessibility requirement for implementation.

## Measured asset sizes

These are individual file sizes, not the eventual build-size delta. Offline data-URL encoding and compression must be measured in the implementation PR. Source PNGs are design originals, not assets to indiscriminately import into the application.

| Asset | Bytes | Gzip bytes |
| --- | ---: | ---: |
| `arena.webp` | 48,694 |  48,702 |
| `case.svg` | 99,517 |  34,770 |
| `pro-silhouette.svg` | 25,468 |  8,257 |
| `case.webp` | 43,856 |  43,889 |
| `pro-silhouette.webp` | 49,236 |  49,198 |

## Tracing recipe and provenance

Generated with OpenAI image generation for this repository from the attached mockup's visual direction. These are anonymous original decorative compositions, not sourced player photographs, official game renders or team logos. Generation can imply no guarantee of exclusivity. Repository artwork credit: OpenAI image generation, prepared and traced by Codex, October 1, 2026. No third-party asset license is being asserted; this source branch follows the repository's ISC license.

Reproduce traces with Python, Pillow 12.3.0 and vtracer 0.6.15:

```sh
python -m pip install Pillow==12.3.0 vtracer==0.6.15
python docs/design/2026-10-01-home-mockup/trace-assets.py
```

The recipe uses a 480px maximum working size, median denoising, 12-color quantization, thresholded alpha and spline tracing. It retains geometry while dropping fine raster texture. Exact settings are in the script; generated sources remain unchanged. WebP alternatives use 640px maximum dimension, quality 85; arena uses 1920px maximum width, quality 80, Pillow method 6.

Generation brief: original near-black esports arena with orange spotlights, quiet left headline zone, right-edge tactical silhouette, no recognizable game characters or interface; rugged black equipment case with orange edge rails, transparent backdrop and no logos; anonymous forward-facing esports competitor with shadowed face, black zip jacket and restrained orange hair/shoulder rim light, transparent backdrop and no question mark or branding. Separate calls generated the three sources using the attached mockup as the visual reference.

## Reference boundaries

The five starter silhouettes and plus signs are an illustrative lineup-to-Major diagram, not interactive slot controls or a real tournament bracket. Seven draft picks still mean five starters, coach and bench. Daily number, countdown and results are read from actual local game state. The screenshot's "Standard" difficulty is not an existing rules mode; #216 specifies only real role-label options and stages setup without touching an unfinished run.

Retain actual stats and a meaningful empty state, first-visit help, complete credits, source dates and affiliation disclosure. Keep all text and controls in HTML/SVG; generation is only for decorative art. Use drawn icon primitives and real brand SVG, not traced screenshot typography. Review light/dark/high contrast, forced colors, reduced motion, keyboard navigation, 44px targets, 200% zoom and widths 320/375/768/1440/1920. No game logic changes, external assets, new runtime dependency, or application implementation are part of this branch.
