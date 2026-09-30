The present UI has a consistent palette but weak hierarchy: `src/styles.css` applies condensed typography broadly, nearly every region becomes another bordered rounded panel, and decorative chrome competes with player names and match decisions. PR #198 improved interaction; this issue addresses the remaining visual identity.

### Proposed direction

Warm charcoal, chalk text, restrained orange, stronger type hierarchy and fewer enclosing boxes. The four attached screen concepts are one coherent direction rather than four unrelated reskins. Preserve the Major Mayhem identity; this is not a new logo project.

### Implementation scope

- Define semantic surface, text, action, selection, side, outcome, spacing, radius and typography tokens. Suggested starting colors: charcoal `#141615`, chalk `#F2F0E9`, orange `#F37A30`; validate contrast rather than adopting swatches blindly.
- Use condensed display type for short headings, a readable regular face for body copy and explanatory labels, and tabular numerals for scores. Reuse bundled fonts where suitable; any additional font must be bundled with its license.
- Introduce at most three surface levels. Use whitespace and rules for ordinary grouping; reserve bordered containers for interactive selection, dialogs and genuinely independent sections. Avoid panel-inside-panel styling.
- Make orange the primary-action/selection accent. Separate score-side and win/loss semantics with words and symbols; color alone must carry no required meaning. Use a visible focus outline independent of hover.
- Specify one shared shell, separate mode navigation from run progress, and move secondary links into the phone menu. Retain sound, help and settings access. The different generated headers are illustrative, not competing navigation contracts.
- Apply equivalent hierarchy to light/high-contrast themes. Do not replace the light-theme preference with a permanently dark design.

### Acceptance criteria

- [ ] A design reference documents tokens, typography roles, action priority, row/card/disclosure patterns and desktop/phone shell.
- [ ] Home, draft, match and results use the same primitives without adding four page-specific theme systems.
- [ ] Contrast tests cover the updated tokens and focus/control boundaries; all required text remains readable at 200% zoom.
- [ ] Before/after screenshots use identical state, theme and viewport. Mobile tap targets are at least 44px; no overflow at 320px.
- [ ] Record compressed build-size change and asset provenance; preserve offline single-file output.

Related: #97, #98, #99, #112. This is a second visual pass on the current implementation, not a claim that the older v1.5 work never shipped. Implement the screen issues after these shared decisions.

### Visual reference

![Home desktop and phone concept](https://raw.githubusercontent.com/nanox333/major-mayhem/design/october-2026-concepts/docs/design/2026-10-01/home.png)
![Draft desktop and phone concept](https://raw.githubusercontent.com/nanox333/major-mayhem/design/october-2026-concepts/docs/design/2026-10-01/draft.png)
![Live desktop and phone concept](https://raw.githubusercontent.com/nanox333/major-mayhem/design/october-2026-concepts/docs/design/2026-10-01/live.png)
![Results desktop and phone concept](https://raw.githubusercontent.com/nanox333/major-mayhem/design/october-2026-concepts/docs/design/2026-10-01/results.png)

### Reference boundaries

These are AI-generated visual proposals, reviewed against the current UI, not executable layouts or production assets. Use existing credited portraits, logos, fonts and radar assets in implementation. Read roster dates, countries, roles and chemistry from the actual data. Some generated details remain inaccurate: the results timeline omits the Swiss loss shown in its ledger; the mobile radar repeats a marker and omits others; the draft example omits a shared-org chemistry link. The implementation must derive these from game state. Country codes must use neutral text, not arbitrary nationality colors or generated flags. Backgrounds/buttons should use flat fills despite residual shading in the images.

The board's “1440px/375px” labels describe target layouts, not measured viewport screenshots. Verify actual 320, 375, 768, 1440 and 1920px layouts, keyboard navigation, 200% zoom, dark/light/high contrast and reduced motion. Body text should be readable at normal scale; desktop controls need not all fit a phone's first viewport.

Keep seeded gameplay, save compatibility, hard-mode secrecy, existing share disclosure, pause/buy/timeout behavior, offline operation and absence of accounts. Progress steps remain informational, not links that undo a draft. No new runtime dependencies or network-loaded assets are needed for this visual pass.
