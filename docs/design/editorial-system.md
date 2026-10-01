# Editorial visual system

This implements issue #200 and supplies the shared foundation for #201–#204. The October concept images are layout proposals, not production assets or sources of game data.

## Tokens and type

`src/styles.css` owns every palette. Dark has three surfaces: base charcoal `#141615`, section `#1c1f1d`, raised `#272b28`. Insets reuse base; light uses warm paper `#eeeee7`, white and `#e4e7df`. Semantic aliases `--surface-base`, `--surface-section`, `--surface-raised`, `--action`, `--selection`, `--focus`, `--side-t`, `--side-ct`, `--outcome-win` and `--outcome-loss` resolve through the existing theme tokens. Page CSS must not override theme palettes.

Chalk `#f2f0e9` is the principal dark text. Orange `#f37a30` marks the primary action and selection; light orange is deliberately darker (`#a94a06`) to remain readable. CT blue and outcome colors always accompany words, letters or symbols. `--muted-2` is decoration only. `--control` supplies required control boundaries, while softer `--line` groups ordinary content. High contrast raises these boundaries and strengthens focus to 3px.

Body copy uses the local system sans-serif stack at normal weight; short display headings use the existing bundled Saira Condensed. Draft player names use strong regular text rather than condensed metadata. The stencil wordmark stays Major Mayhem. Scores use tabular numerals. Font size remains user-zoomable; no fixed-height text containers.

Spacing is 4, 8, 12, 16, 24 and 32px (`--space-1` through `--space-6`). Radius is 3px for small controls, 5px for cards and 8px for dialogs. Flat fills and structural rules replace decorative glow. Shadows are reserved for overlays.

## Patterns and hierarchy

Use a row plus a rule for sequential information. A selected row has orange boundary and an explicit selection label/check; hover does not carry required meaning. Enclose independently interactive candidates and dialogs, not every subsection. Disclosure headers remain real controls with expanded state. Primary actions are filled orange with regular, bold sentence-case labels and a 48px minimum height; secondary actions use plain outlined or text treatment. A page should have one dominant next action, while tactical actions remain distinct controls.

The shared shell aligns its mark, content and page gutters. Desktop mode navigation (Play, Roster archive, Guess the pro) sits centrally in the top bar; informational run progress remains in the console heading and cannot undo gameplay. Below 800px, mode navigation moves to the existing More menu; phone settings also move there; sound and help remain directly available. Header controls and shared buttons have at least 44px targets. Text remains real selectable text.

## Assets and validation

No new network-loaded fonts, generated portraits, logos or runtime dependencies are introduced. Saira fonts remain bundled under SIL OFL (licenses in `assets-src/fonts`); normal reading uses operating-system fonts. Existing photos, logos and radar assets keep their existing credits and offline embedding. Page images are reference only.

The contrast suite checks body/secondary/muted/accent/side/outcome text at 4.5:1 and control/focus boundaries at 3:1 across dark, light and both high-contrast palettes. Responsive browser checks must include 320, 375, 768, 1440 and 1920px, keyboard focus, 200% zoom and reduced motion. Record build gzip delta and identical-state before/after screenshots in the implementation PR; do not claim conceptual images as measured browser output.

## Finishing rules

These came from reviewing every screen of a run, not just the four in the concepts. `src/styles/editorial-finish.css` carries them and loads last.

- **Orange is the only primary action.** Green and red mark outcomes (a win, a loss, a positive or negative link), never buttons or panels. A "match ready" screen is an opponent and a decision, not an alert.
- **Sections are flat.** A rule and space group things; a box stays only where something is chosen (a candidate, a map to ban, a dialog). A player row looks the same in the draft rail, the lobby, the live lineup and the results.
- **One column.** Every screen uses the page width, so nothing resizes as a run moves from draft to match to results. `html { scrollbar-gutter: stable }` keeps the scrollbar's space while a dialog locks scrolling.
- **Nothing moves when you point.** Reserve the decision region from empty to chosen, put steady content above content that changes height, and render a note that appears on a choice (the substitute's role) in a reserved line. Lineup rows keep one height whether a slot is empty, previewed or filled.
- **One disclosure.** `details > summary` draws a chevron that turns; the browser's triangle is never shown. Row disclosures put it on the right, inline ones (marker key, Major history) on the left.
- **Drawn icons, not glyphs.** Emoji and symbol characters render differently per platform; playback, copy, save and share use the icon set.
- **Every class is styled.** `src/ui/styled.test.ts` fails if a component uses a class no stylesheet defines, so new work can't ship as browser defaults. `scripts/ui-e2e.ts` fails if the content column differs between screens at any width.
