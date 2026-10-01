# [UI concept] Give the home header and sections the mockup’s compact rhythm

The shared top bar currently reserves 76px and the home hero/cards have more vertical drift than the supplied reference. The mockup uses an approximately 50px header, a consistent centered content rail and tighter transitions from hero to modes to archive. The result should feel like a composed game homepage rather than a stack of unrelated sections.

### Image concept

A compact shared header above a consistently aligned content rail, with tighter transitions from arena hero to mode cards, archive and stats. Keep the stable shell introduced by #213.

### Implementation scope
- Bring desktop header toward a 52–56px rail while retaining 44px utility targets, centered Play / Roster archive / Guess navigation, and a strong two-tone wordmark. Avoid literal 50px clipping at enlarged text sizes.
- Keep the existing common shell width across all screens and shared header/content gutters; do not introduce a narrower Home-only app rail that resizes the game on navigation. The background may bleed beyond the content rail.
- Set an explicit spacing rhythm: hero bottom rule, 16px-ish inter-card gap, compact archive strip, stats and explanation/footer separators. Size by content rather than fixed screenshot heights.
- Use a restrained near-black arena treatment on Home and fine structural edges. Preserve semantic shared palette tokens; do not darken every gameplay screen or introduce disconnected one-off colors.
- Work with #112 for the eventual original mark/wordmark. Do not launch a parallel brand redesign or trace the screenshot’s mark into a claimed original logo.

### Acceptance criteria
- [ ] At the supplied desktop reference size, header, hero, mode cards and archive share one deliberate rail and compact rhythm.
- [ ] Header accommodates 44px controls, visible focus, long navigation text and active Twitch state without overlap.
- [ ] Phone navigation remains in the existing More menu; sound/help stay available.
- [ ] Layout remains stable across Home, Draft, Match, Results and dialogs, retaining #213’s common-width and scrollbar behavior.
- [ ] Desktop and phone screenshots compare actual geometry to the reference; no fixed-height truncation at 200% zoom.

Related: #200, #201, #101 and #213. #112 continues to own original brand identity. This is a follow-up to the merged editorial UI, not a claim that the earlier implementation never shipped.

### Visual reference

The user-supplied arena home mockup in the October 1 conversation is the layout target. See the [design brief and asset pack](https://github.com/nanox333/major-mayhem/blob/design/home-mockup-followups/docs/design/2026-10-01-home-mockup/README.md) for the comparison with current main and production-art candidates.

![Generated home artwork and genuine SVG trace previews](https://raw.githubusercontent.com/nanox333/major-mayhem/design/home-mockup-followups/docs/design/2026-10-01-home-mockup/asset-reference.jpg)

### Reference boundaries

The artwork sheet is a design asset reference, not an implemented page or browser screenshot. Generated art supplies decoration only; copy, controls, brand marks and the lineup diagram remain real HTML/SVG. Traced assets contain actual vector paths. The arena may remain compressed raster to retain depth without an oversized trace.

Verify actual 320, 375, 768, 1440 and 1920px layouts, keyboard navigation, 200% zoom, dark/light/high contrast and reduced motion. Mobile controls remain at least 44px. Retain seeded gameplay, saved-run compatibility, local daily boundaries, unfinished-run guards, truthful stats, existing credits and offline single-file output. No application code is implemented by this planning/asset branch.
