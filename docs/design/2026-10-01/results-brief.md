The current results screen (`src/screens/Final.tsx`) has useful progressive disclosure, but desktop remains a narrow report inside a very wide enclosing panel. Placement, MVP, sharing and repeated finish labels lack a clear editorial composition. It feels like a form's confirmation page rather than the end of a tournament.

### Image concept

A large placement headline and share actions, one identified MVP portrait, a compact match ledger and flat analysis disclosure rows. Desktop uses its width; phone preserves result and share priority without a replay overlay.

### Implementation scope

- Compose placement and sharing together; place MVP as the adjacent desktop column and a compact supporting phone row. Use the existing credited portrait or a fallback, not the generated likeness as a shipped asset.
- Write truthful state-specific headlines for Swiss exit, quarterfinal, semifinal, runner-up, champion, duel outcomes and practice. Do not apply celebration treatment to every outcome.
- Derive the result path and ledger from actual matches, with W/L marks plus text. Keep series scores distinct from map scores and never imply an unplayed stage was won.
- Render roster/staff, team review and pick strength as simple disclosure rows with clear summaries. Preserve existing progressive disclosure, accurate bench contributors, side-specific ratings and hard-mode behavior.
- Reuse the established visual system in the exported image. An optional preview must reflect the actual export and existing spoiler policy, not expose a newly invented MVP/lineup reveal.
- Keep play again and friend challenge secondary; preserve first-tap native sharing and desktop clipboard/download behavior, including failures.

### Acceptance criteria

- [ ] At 375×812, placement and share actions fit in the first viewport; desktop uses a balanced two-column header without excessive blank side space.
- [ ] Champion, each elimination stage, duel win/loss, practice, no-new-achievement and long-name cases have reviewed screenshots.
- [ ] Ledger, displayed path and exported share result agree exactly with the same saved run. The generated timeline's missing Swiss loss must not be copied.
- [ ] Copy/save/native share/error states remain accessible. Opening a report or disclosure preserves focus and doesn't jump the page unexpectedly.
- [ ] Light/high-contrast layouts retain the same hierarchy; no fixed replay control covers analysis.

Builds on completed #195; related #98 and #23. Keep this a visual recap and share treatment rather than adding invented metrics or another results engine.

### Visual reference

![Results desktop and phone concept](https://raw.githubusercontent.com/nanox333/major-mayhem/design/october-2026-concepts/docs/design/2026-10-01/results.png)

### Reference boundaries

These are AI-generated visual proposals, reviewed against the current UI, not executable layouts or production assets. Use existing credited portraits, logos, fonts and radar assets in implementation. Read roster dates, countries, roles and chemistry from the actual data. Some generated details remain inaccurate: the results timeline omits the Swiss loss shown in its ledger; the mobile radar repeats a marker and omits others; the draft example omits a shared-org chemistry link. The implementation must derive these from game state. Country codes must use neutral text, not arbitrary nationality colors or generated flags. Backgrounds/buttons should use flat fills despite residual shading in the images.

The board's “1440px/375px” labels describe target layouts, not measured viewport screenshots. Verify actual 320, 375, 768, 1440 and 1920px layouts, keyboard navigation, 200% zoom, dark/light/high contrast and reduced motion. Body text should be readable at normal scale; desktop controls need not all fit a phone's first viewport.

Keep seeded gameplay, save compatibility, hard-mode secrecy, existing share disclosure, pause/buy/timeout behavior, offline operation and absence of accounts. Progress steps remain informational, not links that undo a draft. No new runtime dependencies or network-loaded assets are needed for this visual pass.
