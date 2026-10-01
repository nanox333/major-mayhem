# [UI concept] Finish home with an illustrated archive strip and icon-led records

The bottom of Home already contains the right information, but its treatment diverges from the reference: archive is a plain icon row, stats put tiny icons inline with labels, and the footer is two undifferentiated text columns. These regions should finish the page with a deliberate hierarchy rather than repeating generic panels.

### Image concept

A slim illustrated archive strip, four icon-led record tiles, one-line returning-player explanation and a readable three-part footer. Values and credits remain real.

### Implementation scope
- Make archive a compact full-width strip with small decorative overlapping roster cards, concise title/description and a right arrow. Draw cards in SVG using neutral placeholder silhouettes rather than loading random historical portraits. Preserve the single existing browser entry action.
- Recompose returning-player stats as four compact desktop tiles: substantial orange icon beside value/label (best finish, daily streak, runs, achievements). Retain real browser-local values and the meaningful first-run empty state. Two columns or one column on narrow/zoomed layouts.
- Keep How it works as a slim separated summary for returning players with a labelled Show the steps action. Preserve first-visit expansion and the useful existing numbered steps.
- Use three clearly structured footer groups: Data and credits; Fan project (simulation and affiliation disclosure); Built by fans (brief human project description). Add existing drawn icons and understated vertical desktop separators; stack on phones. Preserve retrieval dates, actual source links, portrait/logo attribution and trademark text.
- Keep body/footer text comfortably readable; do not reproduce tiny raster screenshot type or invent statistics such as 8/21 achievements.

### Acceptance criteria
- [ ] Archive, populated stats, collapsed explanation and footer visually follow the supplied reference in hierarchy and density.
- [ ] Empty stats, long values, zero streak and actual achievement total all render honestly.
- [ ] Every link/disclosure/control works with keyboard and 44px targets; decoration has no redundant spoken content.
- [ ] Footer credits remain complete and readable in light/dark/high contrast, at 320px and 200% zoom.
- [ ] Comparison includes first-visit and returning-player screenshots without fabricated record data.

Related: #201, #118, #120, #153 and #213. Preserve the existing roster browser rather than building another one. This is a follow-up to the merged editorial UI, not a claim that the earlier implementation never shipped.

### Visual reference

The user-supplied arena home mockup in the October 1 conversation is the layout target. See the [design brief and asset pack](https://github.com/nanox333/major-mayhem/blob/design/home-mockup-followups/docs/design/2026-10-01-home-mockup/README.md) for the comparison with current main and production-art candidates.

![Generated home artwork and genuine SVG trace previews](https://raw.githubusercontent.com/nanox333/major-mayhem/design/home-mockup-followups/docs/design/2026-10-01-home-mockup/asset-reference.jpg)

### Reference boundaries

The artwork sheet is a design asset reference, not an implemented page or browser screenshot. Generated art supplies decoration only; copy, controls, brand marks and the lineup diagram remain real HTML/SVG. Traced assets contain actual vector paths. The arena may remain compressed raster to retain depth without an oversized trace.

Verify actual 320, 375, 768, 1440 and 1920px layouts, keyboard navigation, 200% zoom, dark/light/high contrast and reduced motion. Mobile controls remain at least 44px. Retain seeded gameplay, saved-run compatibility, local daily boundaries, unfinished-run guards, truthful stats, existing credits and offline single-file output. No application code is implemented by this planning/asset branch.
