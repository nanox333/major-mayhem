# Draft art pass: evidence for #225

Captured from the built offline game (`dist/index.html`) by `scripts/draft-evidence.ts`, with Playwright's Chromium on macOS. Every run is made by the game's own reducer from a fixed seed, so the same three rosters appear in every shot. Regenerate with `npm run build && npx tsx scripts/draft-evidence.ts`.

The screenshots are real captures of the implemented game. They are not the generated art-direction studies in the issue, and nothing here claims to match those studies pixel for pixel.

## Screenshots

| File | State |
| --- | --- |
| `01-reel-rolling`, `02-reel-landing` | the three lanes rolling, then landing (daily run, clock pinned) |
| `03-settled` | the three cards, nothing chosen |
| `04-selected`, `05-hover-beside-selected` | one candidate selected; a different row hovered beside it |
| `06-secondary-role` | a player whose main slot is taken: the penalty is named, the slot chips show the main one as already filled |
| `07-coach` | the coach round, one coach previewed |
| `08-bench` | the bench round: "Joins as your bench player", no starter-slot bonus implied |
| `09-hard-round1`, `10-hard-round4` | hard mode: no role icons, fit text, chemistry or rarity colour; the panel asks for a slot |
| `11-light`, `12-high-contrast` | the light theme and the high-contrast palette |
| `13-effects-off` | reduced motion and fast reveals: the same cards, no reel |
| `14-zoom-200` | a 720x450 window at double density (200% browser zoom) |
| `15-laptop-1366x768` | the short laptop window |
| `16-phone-selected`, `17-phone-hard`, `18-phone-reel` | 375x812 |
| `19-images-missing` | every portrait and logo failing to load: silhouette portraits, team-badge fallbacks, no half-empty montage |

## Measurements

Decision panel bottom edge (it must stay inside the window): round 1 selected 893 of 900, secondary role 893, bench 898, hard 898 and 893, light 898, high contrast 898, effects off 898, 1366x768 746 of 768. The 200% zoom state is a 450px-tall window, so the page scrolls there by design; none of the captures has horizontal overflow.

Reel frame pacing in headless Chromium (software compositing, so a proxy, not a phone), over three runs of about 275 frames each: desktop 1440x900 averaged 59 to 60 fps with a p95 frame of 16.7 to 16.8 ms and at most one frame over 33 ms; at 375x812 with the CPU slowed 4x it averaged 58.7 to 59.1 fps, p95 16.7 to 16.8 ms, at most two frames over 33 ms, the slowest 67 to 83 ms.

## Size and offline

`dist/index.html` is a single self-contained file with no remote art requests.

| Build | Size | Gzip |
| --- | --- | --- |
| `b879ba8` (before the draft art, the baseline in #225) | 2,799.83 KB | 1,713.94 KB |
| `2f9659a` (main) | 3,610.68 KB | 2,149.11 KB |
| this branch | 3,611.08 KB | 2,149.25 KB |

Both were measured the same way (`gzip -9` of `dist/index.html`). The 435 KB gzip difference is everything merged since the baseline (the Home arena hero, bundled Inter and Saira fonts, the broadcast restyle, the Results page, the phone pass), not the draft art alone. The draft art is the four files below, **74 KB** together (the WebP files are already compressed, so gzip changes nothing), inside the issue's target of about 200 KB gzip beyond the baseline.

## Asset inventory and provenance

| Production file | Source kept in `assets-src/draft` | Size | Use |
| --- | --- | --- | --- |
| `src/assets/draft/major-arena-bg.webp` | `major-arena-bg.original.webp` | 2000x667, 50.2 KB | the arena plate behind the draft header (dark theme only) |
| `src/assets/draft/orange-tech-pattern.webp` | `orange-tech-pattern.original.png` (1254x1254) | 11.7 KB | the faint corner pattern in the decision panel |
| `src/assets/draft/tactical-noise.webp` | `tactical-noise.original.webp` | 512x512, 4.2 KB | the grain on the page behind the draft |
| `src/assets/draft/player-placeholder.webp` | `player-placeholder.original.webp` | 420x525, 7.9 KB | the anonymous silhouette for a player with no photo |

All four were generated with ChatGPT image generation for this project (commit `4a0c410`) and recompressed to WebP; the originals are kept so any of them can be redone. They are environmental decoration, texture and a neutral silhouette: none shows a named player, a team logo or a jersey. Team logos and player photos in the cards come from the existing credited bo3.gg and Wikimedia Commons media (see "Sources and credits" in the game); no new photographic source was added in this pass. There is no traced artwork in the draft; the traced SVGs belong to the Home mode cards (#215).

## Checks run

- `tsc`, the unit tests and the production build.
- `scripts/smoke-e2e.ts` (as CI runs it), `scripts/ui-e2e.ts` (five widths, both alternate palettes, daily Home states, and the new phone pass at 360 and 375px) and the full `scripts/e2e.mjs` playthrough all pass.
- A scan of the hard-mode cards found no role, fit, rarity or strength text in the visible text or the accessible names.

## Not verified

- Frame rate on a real phone or on Safari or Firefox; only the headless proxy above.
- 200% zoom was captured as a half-size window at double density, which is the same layout width, not a manual browser-zoom pass. Larger operating-system text sizes were not tried.
- Forced-colors mode was not captured (the scene is hidden by its media query, which the stylesheet states but this run did not render).

## Moved out of this issue

Larger, sharper portraits for the selected-player bay and the team-header montages are tracked in #267. They need a source-size audit and a size budget of their own.
