The current home (`src/screens/Home.tsx`) spends a large area on a trophy illustration, puts the daily timer in its own panel, then repeats daily context in a mode card. Three similarly weighted boxes make the first action feel like a menu choice rather than today's game.

### Image concept

A large editorial headline, one daily action with its countdown alongside, an original five-starter/lineup graphic and compact secondary modes. The game should explain itself in a glance without a generic marketing feature grid.

### Implementation scope

- Replace the oversized arena/trophy scene with a restrained original lineup-to-tournament graphic. Five starters are illustrative; instructions must still mention coach and bench, seven total picks.
- Group daily number, status, action and next-daily time in one region. Remove the separate competing countdown card.
- Give free play and Guess the pro secondary row/card treatments with different original icon/diagram cues; use no decorative player-photo montage. Keep roster browser access as a smaller link.
- Use state-specific primary actions: start today's run, resume the current daily, or view its result. Handle abandoned/replayed/old daily states without falsely promising a scored attempt. Preserve unfinished-run protection.
- Show a first-visit record empty state; returning players get their actual record, not invented counters. Collapse the existing explanation appropriately rather than deleting help.

### Acceptance criteria

- [ ] At 375×812 and 320px width, the daily action and its status are visible before the illustrative art or secondary modes.
- [ ] Desktop daily context appears once; mode buttons do not all share orange primary styling.
- [ ] Fresh, in-progress, complete, abandoned, yesterday-in-progress and rollover states each have reviewed screenshots and correct existing behavior.
- [ ] Countdown remains accessible and uses the game's local daily boundary, not an assumed UTC cutoff.
- [ ] First-run and returning states remain useful with art omitted and at 200% zoom.

Related: #113 and #23. This changes composition and visual priority; it does not create another home-state engine or add modes.

### Visual reference

![Home desktop and phone concept](https://raw.githubusercontent.com/nanox333/major-mayhem/design/october-2026-concepts/docs/design/2026-10-01/home.png)

### Reference boundaries

These are AI-generated visual proposals, reviewed against the current UI, not executable layouts or production assets. Use existing credited portraits, logos, fonts and radar assets in implementation. Read roster dates, countries, roles and chemistry from the actual data. Some generated details remain inaccurate: the results timeline omits the Swiss loss shown in its ledger; the mobile radar repeats a marker and omits others; the draft example omits a shared-org chemistry link. The implementation must derive these from game state. Country codes must use neutral text, not arbitrary nationality colors or generated flags. Backgrounds/buttons should use flat fills despite residual shading in the images.

The board's “1440px/375px” labels describe target layouts, not measured viewport screenshots. Verify actual 320, 375, 768, 1440 and 1920px layouts, keyboard navigation, 200% zoom, dark/light/high contrast and reduced motion. Body text should be readable at normal scale; desktop controls need not all fit a phone's first viewport.

Keep seeded gameplay, save compatibility, hard-mode secrecy, existing share disclosure, pause/buy/timeout behavior, offline operation and absence of accounts. Progress steps remain informational, not links that undo a draft. No new runtime dependencies or network-loaded assets are needed for this visual pass.
