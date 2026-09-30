The draft now supports roster details and chemistry previews, but portraits and names compete with instructions, badges and nested bordered panels. The confirmation area can visually dominate the roster choices. Historical identity should feel central to the game, not like dense admin-table metadata.

### Image concept

Three archival roster columns, larger consistent portraits, clearly separated name/country/role typography, a compact lineup rail and a quiet decision area beneath the choices. One selected row uses a side rule and surface change, not a glow.

### Implementation scope

- Use roster org/year as the column headline, actual Major/event and placement as secondary metadata. Preserve the source/details entry point from #192.
- Make player names the primary row content with consistent ~48px portrait crops and readable secondary labels. Preserve silhouette fallbacks and avoid cropping missing portraits differently.
- Separate committed lineup entries, empty slots and candidate previews visually. Empty slots use plus/empty markers; previews must never look committed.
- Keep all desktop candidate rows visible without a confirmation overlay covering them. Render the selected player, legal role choice, chemistry consequence and commit action in one reserved decision region.
- On phones, use a compact accessible roster selector and one readable roster at a time, with the existing lineup sheet reachable. Switching the visible roster must preserve an already selected candidate or deliberately expose its identity; it must never silently draft someone else.
- Keep reroll count near its secondary action. Preserve full/fast/skip reel states; do not let a tall empty sidebar determine the reel screen's height.

### Acceptance criteria

- [ ] Compare normal, secondary-role, hard-mode, no-selection, candidate-preview and committed states on desktop and phone.
- [ ] At 1440×900, five rows in each roster and the confirmation action are readable without overlap; at 375px the selected candidate and commit action remain reachable.
- [ ] 320px and 200% zoom allow scrolling with no content under a fixed dock; coach/bench and empty-role states use the same system.
- [ ] Keyboard selection, existing focus restoration, source details, hard-mode secrecy and actual chemistry text still work.
- [ ] The generated example's chemistry must not be copied: same-org picks create links according to current rules even if country differs.

Builds on completed #191 and #192; related #97, #98 and #106. The opportunity is the visual treatment of existing decisions, not another draft-mechanics redesign.

### Visual reference

![Draft desktop and phone concept](https://raw.githubusercontent.com/nanox333/major-mayhem/design/october-2026-concepts/docs/design/2026-10-01/draft.png)

### Reference boundaries

These are AI-generated visual proposals, reviewed against the current UI, not executable layouts or production assets. Use existing credited portraits, logos, fonts and radar assets in implementation. Read roster dates, countries, roles and chemistry from the actual data. Some generated details remain inaccurate: the results timeline omits the Swiss loss shown in its ledger; the mobile radar repeats a marker and omits others; the draft example omits a shared-org chemistry link. The implementation must derive these from game state. Country codes must use neutral text, not arbitrary nationality colors or generated flags. Backgrounds/buttons should use flat fills despite residual shading in the images.

The board's “1440px/375px” labels describe target layouts, not measured viewport screenshots. Verify actual 320, 375, 768, 1440 and 1920px layouts, keyboard navigation, 200% zoom, dark/light/high contrast and reduced motion. Body text should be readable at normal scale; desktop controls need not all fit a phone's first viewport.

Keep seeded gameplay, save compatibility, hard-mode secrecy, existing share disclosure, pause/buy/timeout behavior, offline operation and absence of accounts. Progress steps remain informational, not links that undo a draft. No new runtime dependencies or network-loaded assets are needed for this visual pass.
