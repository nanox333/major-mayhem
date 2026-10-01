# Quick UI follow-ups — October 1, 2026

Implements #217 (compact shell), #218 (archive/stats/footer), #74 (static skipped-reel rarity) and #123 (remaining Guess visual review and optional suggestion preview). The arena hero and mode-card artwork remain separate #214/#215 work.

## Home and shell

The shared header uses a 56px minimum rail and 44px utility targets; text sets its height rather than being clipped. Mode navigation stays independent of run progress and moves into More on phones. At enlarged text sizes the wordmark can wrap. Home uses a 16px section rhythm, original neutral SVG archive cards, substantial stat icons and a three-group footer with all previous credits/disclosures preserved. Returning-player help stays collapsible and first-visit help still opens.

Populated stats exposed a stale `:has()` grid override in styles.css, which has been removed. Phone tile labels use their full width, the Swiss finish is shortened to “Swiss exit” without changing the record, and tile columns respond to text size. Empty stats still explain the first run. The local countdown stays inline with its label rather than inheriting the old panel timer's block layout.

[Desktop](home-1440.png) · [Phone](home-375.png). These are actual production-browser captures of a reducer-generated completed-run record, not fabricated mockup counters.

## Static case cue

Opened player-roster cards have a static rarity edge and restrained shadow under the identity header, whether the reel played, was skipped, or reduced motion bypassed it. Placement words remain visible; selecting a candidate still uses the separate orange selection treatment. Hard mode never receives the new cue class. Forced colors use CanvasText instead of a rarity hue. The existing slow final tick timing and skip/fast preference remain unchanged.

## Guess colour-vision review

Captured the actual six-clue grid at 375px with three deterministic incorrect guesses and all three clue states. Reviewed normal rendering, full-severity protanopia, deuteranopia, tritanopia and grayscale in dark, light and both high-contrast palettes. Simulations use the Machado, Oliveira and Fernandes (2009) matrices in linear RGB through SVG `feColorMatrix`; grayscale uses zero saturation. This is a simulated visual review, not a user study or clinical accessibility certification.

| Palette | Normal | Protanopia | Deuteranopia | Tritanopia | Grayscale |
| --- | --- | --- | --- | --- | --- |
| Dark | [View](guess-dark-normal.png) | [View](guess-dark-protanopia.png) | [View](guess-dark-deuteranopia.png) | [View](guess-dark-tritanopia.png) | [View](guess-dark-grayscale.png) |
| Light | [View](guess-light-normal.png) | [View](guess-light-protanopia.png) | [View](guess-light-deuteranopia.png) | [View](guess-light-tritanopia.png) | [View](guess-light-grayscale.png) |
| Dark high contrast | [View](guess-dark-high-normal.png) | [View](guess-dark-high-protanopia.png) | [View](guess-dark-high-deuteranopia.png) | [View](guess-dark-high-tritanopia.png) | [View](guess-dark-high-grayscale.png) |
| Light high contrast | [View](guess-light-high-normal.png) | [View](guess-light-high-protanopia.png) | [View](guess-light-high-deuteranopia.png) | [View](guess-light-high-tritanopia.png) | [View](guess-light-high-grayscale.png) |

Green/amber hues converge under red-green deficiencies. Results remain distinguishable through ✓ / ≈ / ✗, solid/dashed boundaries, directional arrows and spoken clue meanings. The review retains the existing palette rather than claiming hue separation that the simulations do not show. Existing contrast tests pass for all four palettes.

Autocomplete now previews only the candidate nickname in the next empty row, explicitly labelled “Not submitted”, with no clue/result values. Arrow selection and clearing do not change Guess history or consume a guess; submission is still the existing action. The visual preview is hidden from assistive technology because the combobox already announces its active option. It disappears during reveal and after completion.

## Reproduce

```sh
npm run build
CHROMIUM_PATH=/path/to/chromium npx tsx scripts/quick-ui-review.ts
```

The review script checks the populated Home at 320, 375, 768, 1440 and 1920px; 200% root text scaling (not a claim of real browser zoom); static reduced-motion cues and hard-mode omission; four palettes; all clue-state symbols/accessible names; and non-submitting autocomplete previews. `--home-only` recaptures just Home/layout checks. It generates the screenshots in this directory using the actual saved-run reducer and actual Guess clue calculations. Browser CSS filters only affect review captures, not application code.

No gameplay/rules/save changes, production artwork downloads or runtime dependencies. Source PNG captures here are design verification artifacts only, not embedded into the site. The existing full browser and responsive suites verify unchanged navigation, run guards, dialogs, drafts, shares and settings.
