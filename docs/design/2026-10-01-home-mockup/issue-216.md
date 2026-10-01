# [UI concept] Make Free Play setup visible before opening a case

Free Play currently hides filters behind a small arrow. `startFree` resets the current run before revealing `ModePicker`. The mockup instead presents Era, Teams and difficulty options directly inside the card with a full-width Open case button. This is a real interaction change, not just CSS.

### Image concept

Free Play as a ready-to-use configuration card: aligned Era, Teams and role-label rows above a full-width Open case button. Choices can be explored without first replacing a saved run.

### Implementation scope
- Show Era (All / CS:GO / CS2), Teams (All / Champions / Underdogs) and role-label difficulty in labelled aligned segmented rows inside the Free Play card. Stage choices in local setup state; editing them must never reset or mutate an active run.
- Preserve the actual rules: current difficulty is Off versus No role labels. The mockup’s extra “Standard” option does not represent an implemented third rules mode and must not be invented for visual fidelity. Use truthful labels such as “Role labels: Shown / Hidden” with concise explanatory help.
- Reuse existing pool eligibility logic to disable combinations with too few rosters and explain why. Extract/reuse the presentation/validation where useful; do not mount the current dispatching picker against the active daily run.
- Only on “Open case” should the app confirm replacing an unfinished run, then initialize Free Play with the staged options and spin its first case. Cancelling confirmation keeps the run and staged preferences intact. Confirming must spin using the selected options, not a stale React state snapshot.
- An existing free run gets a clear Continue action; starting another is explicit and protected. Keep continuation state readable without silently clearing setup options.
- Use the mockup’s full-width orange action at the bottom of the Free Play card. Daily remains the first and strongest invitation through placement and scale; Guess stays outlined.

### Acceptance criteria
- [ ] Filters are discoverable without first starting/replacing a run; keyboard and pointer selection are equivalent.
- [ ] Editing any setup option leaves the active run/save unchanged. Cancelling replacement preserves it; confirmation starts exactly one correctly configured run.
- [ ] Current daily, yesterday’s daily and free-run guards still work, and completed/practice records are unaffected.
- [ ] No fake “Standard” difficulty, silently widened pool, or inaccessible selected state.
- [ ] At 320px and 200% zoom labels/options wrap cleanly without horizontal scrolling or sub-44px targets.
- [ ] Targeted interaction tests cover staged edits, cancellation, confirmation and use of the selected pool for the first offer.

Related: #201, #116, #182 and #183. Pair with #215 for the surrounding card layout. This is a follow-up to the merged editorial UI, not a claim that the earlier implementation never shipped.

### Visual reference

The user-supplied arena home mockup in the October 1 conversation is the layout target. See the [design brief and asset pack](https://github.com/nanox333/major-mayhem/blob/design/home-mockup-followups/docs/design/2026-10-01-home-mockup/README.md) for the comparison with current main and production-art candidates.

![Generated home artwork and genuine SVG trace previews](https://raw.githubusercontent.com/nanox333/major-mayhem/design/home-mockup-followups/docs/design/2026-10-01-home-mockup/asset-reference.jpg)

### Reference boundaries

The artwork sheet is a design asset reference, not an implemented page or browser screenshot. Generated art supplies decoration only; copy, controls, brand marks and the lineup diagram remain real HTML/SVG. Traced assets contain actual vector paths. The arena may remain compressed raster to retain depth without an oversized trace.

Verify actual 320, 375, 768, 1440 and 1920px layouts, keyboard navigation, 200% zoom, dark/light/high contrast and reduced motion. Mobile controls remain at least 44px. Retain seeded gameplay, saved-run compatibility, local daily boundaries, unfinished-run guards, truthful stats, existing credits and offline single-file output. No application code is implemented by this planning/asset branch.
