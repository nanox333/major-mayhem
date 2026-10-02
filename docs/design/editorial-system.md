# Editorial visual system

This implements issue #200 and supplies the shared foundation for #201–#204. The October concept images are layout proposals, not production assets or sources of game data.

## Tokens and type

`src/styles.css` owns every palette. Dark has three surfaces: base charcoal `#141615`, section `#1c1f1d`, raised `#272b28`. Insets reuse base; light uses warm paper `#eeeee7`, white and `#e4e7df`. Semantic aliases `--surface-base`, `--surface-section`, `--surface-raised`, `--action`, `--selection`, `--focus`, `--side-t`, `--side-ct`, `--outcome-win` and `--outcome-loss` resolve through the existing theme tokens. Page CSS must not override theme palettes.

Chalk `#f2f0e9` is the principal dark text. Orange `#f37a30` marks the primary action and selection; light orange is deliberately darker (`#a94a06`) to remain readable. CT blue and outcome colors always accompany words, letters or symbols. `--muted-2` is decoration only. `--control` supplies required control boundaries, while softer `--line` groups ordinary content. High contrast raises these boundaries and strengthens focus to 3px.

Body copy uses bundled Inter (`src/fonts`, SIL OFL, so it matches on every device) with the system stack as fallback, at normal weight; short display headings use the existing bundled Saira Condensed. Draft player names use strong regular text rather than condensed metadata. The stencil wordmark stays Major Mayhem. Scores use tabular numerals. Font size remains user-zoomable; no fixed-height text containers.

Spacing is 4, 8, 12, 16, 24 and 32px (`--space-1` through `--space-6`). Radius is 3px for small controls, 5px for cards and 8px for dialogs. Flat fills and structural rules replace decorative glow. Shadows are reserved for overlays.

## Patterns and hierarchy

Use a row plus a rule for sequential information. A selected row has orange boundary and an explicit selection label/check; hover does not carry required meaning. Enclose independently interactive candidates and dialogs, not every subsection. Disclosure headers remain real controls with expanded state. Primary actions are filled orange with regular, bold sentence-case labels and a 48px minimum height; secondary actions use plain outlined or text treatment. A page should have one dominant next action, while tactical actions remain distinct controls.

The shared shell aligns its mark, content and page gutters. Desktop mode navigation (Play, Roster archive, Guess the pro) sits centrally in the top bar; informational run progress remains in the console heading and cannot undo gameplay. Below 800px, mode navigation moves to the existing More menu; phone settings also move there; sound and help remain directly available. Header controls and shared buttons have at least 44px targets. Text remains real selectable text.

## Assets and validation

No new network-loaded fonts, generated portraits, logos or runtime dependencies are introduced. Saira and Inter fonts are bundled under SIL OFL (Saira licenses in `assets-src/fonts`, Inter's in `src/fonts`); nothing loads from a font CDN. Existing photos, logos and radar assets keep their existing credits and offline embedding. Page images are reference only.

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

## Broadcast pass (angular esports style)

A later pass restyled every screen toward one flat, sharp, broadcast-like language. It supersedes the rounded radii and soft panels described above wherever the two disagree. Where a rule below conflicts with an older stylesheet, the newer file wins because it loads later.

**Shape.** Square corners. A panel is a dark flat fill with a 1px inner outline (`inset 0 0 0 1px rgba(255,255,255,.08)`) and, at most, one cut corner made with `clip-path: polygon(...)`. Buttons, tabs and switches are slanted blocks (`clip-path` with 8-10px cut ends, or `skewX(-12deg)` for small squares). No rounded pills, no blur, no glassy gradients.

**Marks.** A slanted orange tick (about 7x13px, `skewX(-18deg)`) goes before a section label. Labels are small, uppercase and letter-spaced (`var(--f-read)`); headings are condensed uppercase (`var(--f-head)`). A cell carries its colour as a 3px bar along its bottom (or a 3px inset on its left edge), not as a full fill. Gold is only for titles.

**Colour.** Orange (`--accent`, `--accent-hi`) is the one action colour and is used sparingly: the primary button, the active tab or switch, a tick, a bar. Everything else is charcoal and chalk. Green and red still mean outcomes only.

**Buttons.** The primary button is angular orange with a striped arrow block at the right and a light sweep on hover. The dark variant (for something already done, such as Replay today's run) reverses it. Secondary actions in dialogs use `.st-btn`: a flat slanted pad that turns orange for a confirm-by-second-click state.

**Dialogs.** A dialog (`.modal__card`) opts in by containing a marker class: `.gh` (Guess the pro guide), `.st` (Settings) or `.hp` (How to play and sources). The card then drops its padding, takes the cut top-right corner, and the content provides its own header: an orange kicker, a large uppercase title and one line of intro over a faint orange wash. The close control is a plain ×, never a slanted block. Sections inside use the tick-and-rule title; rows are flat dark strips with a left edge; disclosures use a + / - marker.

**Streak heat.** The Home streak cell changes tier at eight days (`.is-blaze` in `src/screens/Modes.tsx`): the label becomes "On fire", the meter stays full, and the cell gains a pulsing glow, rising embers and a sweep across the meter. All of it is switched off under `prefers-reduced-motion`.

**Where it lives.** These stylesheets load after the editorial ones, in this order (`src/main.tsx`): `draft-open.css` (sealed case, decision panel), `stats-page.css`, `guess-page.css` (page and its guide dialog), `setup-page.css` (free-play options), and `shell.css` last (header, nav, footer, tips, dropdown menu, Settings, How to play, streak heat). The Home page's own blocks sit at the end of `editorial-home.css`, and the roster archive's at the end of `roster-archive.css`. New screens should add to the page's own file and reuse these patterns rather than restyling shared components in place.

**Pages that are pages.** Stats, Roster archive and the free-play setup (`src/screens/Setup.tsx`) are views of their own in `App.tsx` (`View`), not dialogs; Stats is also an icon at the right end of the header. How to play, Settings and the Guess guide are reached from the "..." menu or the page's `?`, and are dialogs. The debug menu (`src/ui/DebugMenu.tsx`, Ctrl+Shift+D) clears data and loads dummy stats, a streak of any length and achievements for checking these screens, and jumps straight to the draft, lobby, match or results page with a random team built by the real reducer (`src/ui/debugRuns.ts`).

**Known gaps.** The Playwright suites were updated for the new flow (an Open case click on a fresh draft, a Start draft click after Start free play, the help button inside the "..." menu) but have not been run since; phone layouts of the newer pages were written to the same breakpoints and have not been reviewed in a browser.
