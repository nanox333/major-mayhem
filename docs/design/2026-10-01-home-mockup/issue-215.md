# [UI concept] Give home mode cards traced case and pro artwork with clear actions

The current secondary cards repeat the lineup diagram for Free Play and use a thin outline head for Guess. Artwork sits to the left of the copy, unlike the mockup’s substantial case and orange-rimmed silhouette on the right. Both actions are visually reduced to isolated arrows.

### Image concept

Two substantial mode cards: Free Play with a black/orange equipment case; Guess with an orange-rimmed anonymous silhouette and separate question mark. Copy sits on the left and actions have visible labels.

### Implementation scope
- Recompose two desktop mode cards with left-aligned orange eyebrow, strong white headline, readable supporting copy and clear labelled action. Use restrained charcoal surfaces, fine borders and small corner radii; do not copy decorative bevels into controls.
- Replace repeated Free Play lineup art with an original rugged black/orange equipment case in the upper-right area. Replace Guess outline head with an anonymous shadowed player silhouette on the right; keep the orange question mark as a separate SVG/HTML layer. No invented real pro portrait or team branding.
- Generate source art, trace suitable cutouts into real SVG paths, simplify and compare at actual card size. Do not call an SVG wrapper around a raster a trace. Preserve originals and generation/tracing provenance. If an intricate trace bloats the offline bundle, use a deliberately simplified trace with a documented comparison.
- Show a visible outlined “Play now” / “Keep guessing” / “See today’s answer” button for Guess, with arrow icon. Its label must match the existing Guess state. Free Play’s control/action layout is owned by the companion setup issue.
- Decorative layers cannot cover copy, intercept input or create extra focus stops. Smaller screens reduce or omit art rather than squeezing copy and controls.

### Acceptance criteria
- [ ] Both cards resemble the supplied reference in art placement, copy hierarchy and visible action affordance.
- [ ] Case and silhouette ship with genuine SVG traces, source files, preview and reproducible tracing settings.
- [ ] Guess fresh/in-progress/solved/failed states retain truthful text and correct navigation without replacing an unfinished run.
- [ ] Card artwork can be removed with no loss of meaning; controls have at least 44px targets and readable focus in every theme.
- [ ] Raster versus simplified SVG size and visual quality are reviewed before production integration.

Related: #201, #116 and #213. Pair with #216 for Free Play controls; #112 owns brand identity. This is a follow-up to the merged editorial UI, not a claim that the earlier implementation never shipped.

### Visual reference

The user-supplied arena home mockup in the October 1 conversation is the layout target. See the [design brief and asset pack](https://github.com/nanox333/major-mayhem/blob/design/home-mockup-followups/docs/design/2026-10-01-home-mockup/README.md) for the comparison with current main and production-art candidates.

![Generated home artwork and genuine SVG trace previews](https://raw.githubusercontent.com/nanox333/major-mayhem/design/home-mockup-followups/docs/design/2026-10-01-home-mockup/asset-reference.jpg)

Artwork: [case.svg](https://github.com/nanox333/major-mayhem/blob/design/home-mockup-followups/docs/design/2026-10-01-home-mockup/assets/case.svg), [pro-silhouette.svg](https://github.com/nanox333/major-mayhem/blob/design/home-mockup-followups/docs/design/2026-10-01-home-mockup/assets/pro-silhouette.svg). Original PNGs, compressed raster alternatives and the reproducible tracing recipe are included in the asset pack.

### Reference boundaries

The artwork sheet is a design asset reference, not an implemented page or browser screenshot. Generated art supplies decoration only; copy, controls, brand marks and the lineup diagram remain real HTML/SVG. Traced assets contain actual vector paths. The arena may remain compressed raster to retain depth without an oversized trace.

Verify actual 320, 375, 768, 1440 and 1920px layouts, keyboard navigation, 200% zoom, dark/light/high contrast and reduced motion. Mobile controls remain at least 44px. Retain seeded gameplay, saved-run compatibility, local daily boundaries, unfinished-run guards, truthful stats, existing credits and offline single-file output. No application code is implemented by this planning/asset branch.
