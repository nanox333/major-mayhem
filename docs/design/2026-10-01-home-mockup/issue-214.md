# [UI concept] Compose the home hero around the arena artwork and daily action

`Home.tsx` and `editorial-home.css` currently place the headline and schematic lineup on an uninterrupted charcoal field. The target has a dark arena spanning the hero, a much stronger two-line headline, and the lineup nested into the scene. Simply adding a background image without recomposing the section would leave the same visual gap.

### Image concept

A dark arena spanning the hero, a deliberate two-line white/orange headline, one daily action with its countdown alongside, and the five-starter SVG diagram integrated into the right side of the scene.

### Implementation scope
- Add original arena artwork as a decorative layer spanning the hero behind both columns. Preserve a dark quiet text zone on the left; stage detail and tactical silhouette belong toward the right. Fade its lower edge into the page rather than boxing it as a banner.
- Keep the headline, daily number, intro, status, CTA and countdown as HTML. At the reference desktop width, keep “Five players.” / “One Major.” as two deliberate lines and the introductory sentence on one line when space permits. Use bundled display typography and normal body typography.
- Keep the five-card-to-Major diagram as real SVG, compact enough to sit over the right half of the arena, with fine visible connectors, subdued silhouettes and one decorative orange card outline. Plus signs and the outline are illustrative, not clickable slot selection. Seven picks still explicitly include coach and bench.
- Make the countdown a compact clock-labelled cluster beside the primary CTA, with a separator on desktop; maintain the local-midnight boundary and restrained screen-reader updates.
- On phones place truthful daily status and the full-width action before optional artwork; art can shrink or disappear. Keep unfinished previous-day runs, completion, abandoned/practice states and replace-run confirmation readable as the hero grows.
- Measure encoded artwork size in the offline build; use a compressed raster for arena depth if tracing produces excessive paths. No external image requests or image-embedded text.

### Acceptance criteria
- [ ] Desktop screenshot shows a single integrated arena hero, two-line headline, daily CTA/clock cluster and right-side SVG diagram matching the reference composition.
- [ ] Text/control contrast meets existing theme requirements over the art; light, high contrast and forced colors have deliberate art-free or adapted treatments.
- [ ] Daily action appears before decorative art at 320/375px and 200% zoom.
- [ ] Fresh, active, complete, abandoned, old daily and midnight-rollover screenshots preserve correct actions and existing run guards.
- [ ] PR records image compression, total build gzip delta and screenshots with artwork unavailable.

Related: #201, #200, #119 and #213. Coordinate with #217 for the shell and #215 for mode artwork. This is a follow-up to the merged editorial UI, not a claim that the earlier implementation never shipped.

### Visual reference

The user-supplied arena home mockup in the October 1 conversation is the layout target. See the [design brief and asset pack](https://github.com/nanox333/major-mayhem/blob/design/home-mockup-followups/docs/design/2026-10-01-home-mockup/README.md) for the comparison with current main and production-art candidates.

![Generated home artwork and genuine SVG trace previews](https://raw.githubusercontent.com/nanox333/major-mayhem/design/home-mockup-followups/docs/design/2026-10-01-home-mockup/asset-reference.jpg)

Artwork: [arena.webp](https://github.com/nanox333/major-mayhem/blob/design/home-mockup-followups/docs/design/2026-10-01-home-mockup/assets/arena.webp). Original PNGs, compressed raster alternatives and the reproducible tracing recipe are included in the asset pack.

### Reference boundaries

The artwork sheet is a design asset reference, not an implemented page or browser screenshot. Generated art supplies decoration only; copy, controls, brand marks and the lineup diagram remain real HTML/SVG. Traced assets contain actual vector paths. The arena may remain compressed raster to retain depth without an oversized trace.

Verify actual 320, 375, 768, 1440 and 1920px layouts, keyboard navigation, 200% zoom, dark/light/high contrast and reduced motion. Mobile controls remain at least 44px. Retain seeded gameplay, saved-run compatibility, local daily boundaries, unfinished-run guards, truthful stats, existing credits and offline single-file output. No application code is implemented by this planning/asset branch.
