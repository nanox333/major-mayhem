The current match (`src/screens/Match.tsx`, `src/ui/Board.tsx`) works, but the scoreboard, radar, feed and controls still resemble independent widgets. Large face tokens obscure the map at small widths, while tactical choices and playback utilities have nearly equal visual weight.

### Image concept

A strong scoreboard, compact round strip, readable radar flanked by the fielded five and recent events, and a decision dock that visually separates tactical calls from playback. Use explicit CT/T and team labels, not unexplained blue/orange decoration.

### Implementation scope

- Use tabular score digits and a single composition for side labels, team names, map, round and playback state. Handle long names, halftime, overtime and BO3 context without clipping.
- Prototype compact numbered radar markers mapped to a readable lineup legend. Keep names/details discoverable by keyboard/touch, and provide an accessible textual description. Validate against overlapping markers before replacing face tokens.
- State that the radar is illustrative positioning, not a live tactical simulation. Use current bundled radar assets and game-event data; do not invent kill feeds, weapons, damage or moving positional telemetry.
- Reduce recent-round cards to restrained rows. Historical viewing must remain a stable snapshot with explicit return-to-live behavior.
- Make tactical actions prominent only when available. Lost-pistol save/force choice gets decision priority; pause, speeds, next round and skip are secondary playback controls. “Skip map” reveals the existing simulated result and never forfeits.
- Phone layout prioritizes scoreboard, radar and the current decision; keep the full lineup accessible without permanently spending a screen on it. Reserve safe-area/content space for the dock.

### Acceptance criteria

- [ ] Ready, playing, paused, historical, lost-pistol, timeout-used, halftime and map-complete states have consistent layouts and correct labels.
- [ ] All ten markers map uniquely to the two fielded fives, using letters/numbers as well as side colors. No fabricated live positions.
- [ ] Tactical and playback controls remain distinct at 320px and 200% zoom, with 44px tap targets and no hidden feed rows.
- [ ] BO1/BO3, overtime and long opponent names are reviewed at phone and desktop widths.
- [ ] Existing pause/reload, buy decision, dialog cover and history behavior is unchanged; full playthrough and responsive checks pass.

Builds on completed #194 and #193, related #98. The image's stray mobile marker numbering is not the production specification; render markers and round totals from actual state.

### Visual reference

![Live desktop and phone concept](https://raw.githubusercontent.com/nanox333/major-mayhem/design/october-2026-concepts/docs/design/2026-10-01/live.png)

### Reference boundaries

These are AI-generated visual proposals, reviewed against the current UI, not executable layouts or production assets. Use existing credited portraits, logos, fonts and radar assets in implementation. Read roster dates, countries, roles and chemistry from the actual data. Some generated details remain inaccurate: the results timeline omits the Swiss loss shown in its ledger; the mobile radar repeats a marker and omits others; the draft example omits a shared-org chemistry link. The implementation must derive these from game state. Country codes must use neutral text, not arbitrary nationality colors or generated flags. Backgrounds/buttons should use flat fills despite residual shading in the images.

The board's “1440px/375px” labels describe target layouts, not measured viewport screenshots. Verify actual 320, 375, 768, 1440 and 1920px layouts, keyboard navigation, 200% zoom, dark/light/high contrast and reduced motion. Body text should be readable at normal scale; desktop controls need not all fit a phone's first viewport.

Keep seeded gameplay, save compatibility, hard-mode secrecy, existing share disclosure, pause/buy/timeout behavior, offline operation and absence of accounts. Progress steps remain informational, not links that undo a draft. No new runtime dependencies or network-loaded assets are needed for this visual pass.
