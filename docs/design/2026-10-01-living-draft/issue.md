The draft already has real roster data, player portraits, role eligibility, chemistry previews, saved runs, keyboard navigation and a functional opening animation. It still looks like a collection of flat interface panels. The supplied references have a much stronger sense of place: a dark arena, hard directional light, photographic team compositions, glowing mechanical reveal lanes and a selected-player panel that feels connected to the team above it.

This issue owns that **artwork and effects pass**, including the transition from opening a case to choosing a player. The goal is to make the actual game approach the reference's atmosphere and visual richness. Moving panels around or adding one background image does not finish it.

**Status:** detailed design/implementation brief with generated studies; no application implementation in this issue's asset branch. Reviewed against main `b879ba8` and the existing Home hero work in #224 on October 1, 2026.

### Image concept

A Counter-Strike Major drafting room inside an arena. The environment supplies anticipation; the roster cards supply team identity; a warm local highlight supplies selection; the decision panel supplies clarity. The opening sequence uses three vertical roster-identity lanes in the same places the three roster cards will occupy after landing. The atmosphere remains recognizable when motion is disabled.

The desktop references supplied in the conversation are the visual target for both the settled draft and the rolling state. The following generated studies translate that target into a more explicit brief. **They are static concepts, not screenshots of implemented software.** Their anonymous faces, abstract/generated emblems, flags, event text and example roster names are illustrative; production must use the repository's real data and credited media. Do not turn a generated mockup into an authoritative roster source.

![Selected-player desktop art-direction study](https://raw.githubusercontent.com/nanox333/major-mayhem/design/living-draft-art-direction/docs/design/2026-10-01-living-draft/mockups/01-selected-desktop.png)

*Study 1: the settled decision. Team montages and directional light create identity and depth, while the reading surfaces stay calm. There is one selected candidate and no chemistry bonus for an empty lineup.*

![Three-lane case-opening art-direction study](https://raw.githubusercontent.com/nanox333/major-mayhem/design/living-draft-art-direction/docs/design/2026-10-01-living-draft/mockups/02-opening-desktop.png)

*Study 2: the opening. Each vertical lane occupies a future roster-card position, and Show case remains available. Passing rows are blurred; the landing window is crisp. The generated header emblems and coloured frames are illustrative, not permission to expose a final identity early or hard-mode information.*

![Opening-to-decision motion storyboard](https://raw.githubusercontent.com/nanox333/major-mayhem/design/living-draft-art-direction/docs/design/2026-10-01-living-draft/mockups/03-motion-storyboard.png)

*Study 3: a static storyboard showing the relationship between start, travel, land and choose. It does not demonstrate working timing, performance or skip behavior.*

![Phone and reduced-motion studies](https://raw.githubusercontent.com/nanox333/major-mayhem/design/living-draft-art-direction/docs/design/2026-10-01-living-draft/mockups/04-phone-studies.png)

*Study 4: preserving atmosphere on a phone while keeping decisions readable. Compact stacked reveal windows are the preferred opening treatment; settled play exposes one readable roster at a time. Any image-generation deviations from the written behavior below must be corrected in implementation.*

[Design pack, originals, prompts and provenance](https://github.com/nanox333/major-mayhem/tree/design/living-draft-art-direction/docs/design/2026-10-01-living-draft).

### The feeling to reach

**Anticipation before a choice; confidence during the choice.** Opening a case is the short theatrical moment. Choosing a player is the quiet, deliberate moment. A user should feel that the three historical teams have arrived on a stage, then be able to read names, compare legal roles and commit without competing animation.

The reference's energy comes largely from its still-image composition. It has a foreground, a middle ground and a distant arena. Orange lights have visible sources. Team portraits overlap emblem and texture layers. The selected portrait is large enough to establish a human focal point. Thin, crisp text sits against substantially darker material. Glows occur around edges and release points, leaving the centre of the interface readable.

The feeling should be **tense, warm, physical and grounded in esports photography**. Think stage lights catching a metal edge, a dark jersey emerging from a team-coloured backdrop, or a reel slowing under a precise stop marker. The interface can feel exciting without bobbing, sparkling or breathing continuously.

| Intended impression | Concrete visual cause | What would weaken it |
| --- | --- | --- |
| A real place with depth | Crowd/stage background, darker copy zone, foreground silhouette, controlled atmospheric haze | A uniformly bright wallpaper behind every line of text |
| A team with a recognizable identity | Correct logo, the actual roster's portrait montage, org-colour lighting and specific event caption | The same anonymous banner repeated for every roster |
| A chosen candidate | One orange perimeter, localized warm light, corresponding large portrait and explicit selected state | Two orange-selected rows or a glow that appears on every hover |
| Weight and anticipation | Fast early travel, visible deceleration, crisp centre marker, short localized landing release | Endless random scrolling, springy overshoot or a slow forced wait |
| A deliberate decision | Stable panel boundaries, sharp names, clear role/chemistry explanation, one dominant Draft action | Animated body copy, blurred facts or decorative effects across controls |
| A cared-for game rather than a generic generated dashboard | Purpose-built photographic compositions, restrained corner radii, consistent geometry and honest state | Purple ambient gradients, oversized pills, translucent cards everywhere, generic neon on every panel |

A successful still screenshot should already have most of the reference's character. Motion should reinforce it, rather than carry the whole design.

### Current implementation and the actual gap

![Actual current dark draft](https://raw.githubusercontent.com/nanox333/major-mayhem/design/living-draft-art-direction/docs/design/2026-10-01-living-draft/current-draft-1440.png)

This baseline is a real Chromium capture of the current draft, with a fixed free-play fixture and a selected candidate. The draft source matches main `b879ba8`; it was captured from the #224 review build, whose application changes are Home-specific. The [phone baseline](https://raw.githubusercontent.com/nanox333/major-mayhem/design/living-draft-art-direction/docs/design/2026-10-01-living-draft/current-draft-375.png) is also included.

What exists and should be retained:

- `CaseCards` presents three real offers, legal main/secondary-role states, a separate candidate selection and commit, live chemistry and roster/source access.
- `DraftBar` uses actual selected-player identity, role fit and `chemPreview`; it already reserves space for the decision.
- `Avatar` and `TeamBadge` use cached portraits/logos and honest fallbacks. `RoleIcon` supplies real role primitives.
- `CaseReel` is a single horizontal strip, visually landing on `s.offer[0]`, then handing off to all three roster cards. Its travel uses `REEL_MS = 2400` and a decelerating curve; its final completion timer is currently 2900ms.
- Show case, Fast case reveals, reduced motion, sound mute and lifecycle cleanup are already implemented. #74 and #196 established the skip/static-reveal behavior; those are foundations to preserve.
- The reducer already determines the actual offer when `spin` is dispatched. The animation is presentation, not a second draw.

What is missing:

- A shared arena composition for the active draft view, rather than a Home-only backdrop.
- Actual team montages and useful selected-player portrait compositions.
- A layered, deliberate lighting system with restrained active-state effects.
- A three-lane reveal of all three predetermined roster identities.
- A stable visual relationship between those lanes, the resulting cards and the bottom decision panel.
- Responsive art direction, rather than shrinking the desktop poster into a phone.

The merged editorial work improved hierarchy and stability. This follow-up adds the photographic and atmospheric finish; it should not reopen already-solved stability or reveal-skip issues as though they never shipped.

### Implementation scope

#### 1. Build a scene, with controlled depth and light

Compose the active draft from several layers with clear responsibilities:

| Layer | Treatment and purpose |
| --- | --- |
| Arena plate | Original arena artwork, including stage/crowd depth; the existing prepared arena is a starting candidate, not a requirement to generate a new one for every screen |
| Copy scrim | A dark, directional gradient whose strength is set by legibility over the brightest possible source pixels |
| Foreground edge | Anonymous tactical silhouette or structural shadow at the outer right edge; it must not occupy the player-row reading area |
| Atmosphere | Very restrained haze and fine grain; static by default, with a small animated light response only when a real interaction occurs |
| Architecture | Sparse diagonal amber rails/edge reflections at the margins, creating a frame without a thick decorative border around every control |
| Interface surfaces | Nearly opaque charcoal reading zones with thin separation lines; grain and lighting may catch their edges but do not sit over text |
| Event effects | Local selection glow, short landing release and clear commit feedback; removed when the event has ended |

The scene can reach behind the slim draft header, but the header still needs a dark legible surface and a visible active tab. Add an explicit scope for the **active draft view**. A saved run can have `phase === 'draft'` while the user is on Home or Guess, so styling only `.phase-draft` as a full-page arena would spill into unrelated screens. Keep #214/#224's Home composition and the shared content rail intact.

Provide at least two crop rules: the wide desktop composition and a quieter phone crop. Keep the left reading zone dark. Adapt brightness/scrim strength as the section grows for first-visit help, alternate roles or coach/bench states. Do not stretch a short hero texture into unreadable bright seams at taller heights.

A static arena plate, composited portraits, SVG accents and small CSS effects should be sufficient. A video background or 3D scene is not needed for this target. Preserve the self-contained offline build.

#### 2. Give each roster a real photographic identity

The team header should be a composed editorial strip with three distinct readings: emblem and name at the left; placement/event metadata beneath; a roster montage and team-coloured light toward the right. It should remain recognizably team-specific even before the user reads every player row.

Compose the montage from **that roster's actual five players**, not a generic group photo labelled with a team name. Reuse existing credited portraits as clipped image layers where quality allows. Apply colour through the backdrop, rim/accent layer and jersey-edge treatment; preserve enough natural face detail for identification. Avoid tinting all faces into a red/cyan/yellow silhouette by default.

The reference's red/cyan/gold combination belongs to its example teams. Production takes identity colours from roster data, so three different offers may have three similar colours. Logos and names must still distinguish them. Do not assign permanent red, cyan and yellow skins to lane positions just because the concept happens to show that combination.

Use enlarged, subdued logo geometry as a watermark, then a sharper smaller logo for identification. Keep event text as HTML. Do not bake names, years, placements, countries, role labels or outcomes into an image. Preserve the existing View roster & sources action.

**Source-size work is required:** `build-media.mjs` currently outputs approximately 168px Commons portraits, 176px bo3.gg portraits and 96px logos. Those support small rows but are not automatically suitable for a 180px portrait bay at 2× density or a large banner. Inspect originals in `assets-src` before enlarging. Derive an appropriate higher-resolution crop from an existing credited source where available; if the source is small or absent, use a clean honest fallback. Do not invent a face, uniform, tournament-era jersey or teammate photo to complete a montage.

A reused source portrait may be more recent than the roster's event. Preserve identity and source credit; do not present a generated or retouched jersey as a documented historical photo. Use the graphic treatment to integrate the source, and keep captions factual.

#### 3. Make the player rows belong to those compositions

Rows should look integrated with their team card: real portrait at the left, strong nickname, country indicator with readable code, role/fit information and a clear selectable affordance. Keep the five rows aligned across cards where content allows. The team-coloured portrait edge is a small identity cue, not a permanent selection highlight.

The orange state belongs to the candidate the user actually selected. Hover and keyboard preview must remain distinct from a pressed selection. A focus ring needs its own legible treatment, so keyboard users can distinguish focused, selected and unavailable rows.

Use a local warm gradient behind the selected row, a fine orange perimeter and a small controlled edge glow. Text remains crisp. The glow must not overlap adjacent rows or change their height. Unavailable or already-drafted players retain truthful explanatory states; dimming alone is insufficient.

Keep main-role, secondary-role and already-filled-slot information from the existing helpers. In hard mode, hide all role/fit/strength information currently concealed, including any decorative icon or copy that would reveal it. Team colours identify teams; they must not imply hidden player strength or rarity.

Flags can use the existing infrastructure owned by #106, but this issue does not invent full-name fields or replace that issue's data work. Countries remain player facts, not a flag guessed from an organization's home country.

#### 4. Turn the decision panel into a portrait composition

Keep a stable wide decision strip below the three roster panels. Its portrait bay, facts area, reasoning area and controls should have a useful relationship before selection, during selection and after a reroll.

The selected portrait can be larger than the row image, backed by an oversized team emblem, a limited repeating motif or jersey-colour reflection. Match its light direction to the selected card. The portrait feels visually lifted from that roster rather than pasted into an unrelated square. The image must not push actions offscreen or grow the panel on each candidate switch.

The reasoning area should say what this pick changes, using actual `chemPreview`, legal slots and fit helpers. Examples:

| State | Honest decision-panel copy |
| --- | --- |
| First pick, no teammates yet | Fills AWP slot; Main role; No chemistry links yet |
| Actual shared country link | Name the already-drafted player(s) involved and the actual resulting chemistry change |
| Actual duo link | Show the current model's named duo and effect, only if the other player is in the lineup |
| Secondary role | Explain that the main slot is filled and show the legal secondary slot with its real fit penalty |
| Hard mode | Let the user choose an open slot, with no hidden main-role or fit information leaked by copy/art |
| Coach | Correct coach identity and the real coach effects; no fake player-role row |
| Bench | Bench-specific action and eligibility; no starter-slot bonus implied |

The supplied selected-state reference shows chemistry with Ax1Le/Hobbit alongside an empty `0 / 7` lineup. That visual richness is useful as art direction, but those bonuses are not a valid first-pick state. Also, only one candidate is selected: two separate orange rows must not imply two simultaneous selections.

The first action should clearly commit the selected candidate and legal slot. Keep the current specific wording where useful (for example, Draft sh1ro as AWP). The quieter Spin again action shows the actual remaining count. Its placement can move into the decision strip, but it must keep the reducer's existing guards and never look like a paid spin.

#### 5. Replace the one-strip opening with three vertical roster-identity lanes

The user-supplied rolling reference is the target for this part. Each lane is the visual predecessor of one of the three final cards. **The rolling items are historical roster identities, not a random scroll of player portraits or role assignments.**

The reducer's `s.offer[0..2]` is already the real result. The presentation reads those IDs and lands lane 1/2/3 on the corresponding IDs. Decorative passing entries may come from the existing permitted pool, but cannot affect eligibility, `seen`, seed, rerolls or draw probabilities. Do not dispatch another draw at the end of an animation.

Keep the lineup rail, draft context and decision-strip footprint in place while the lanes move. The heading changes to Opening your case; the selected count does not change. Use **0 / 7 picks made**, rather than 0 / 7 players selected, because the seven picks include a coach and bench.

Each lane needs:

- An overflow-clipped travel area occupying exactly its final card footprint.
- A visible centre/landing window, with a thin stop marker and small exterior direction indicators.
- Roster identity rows: logo, org/year and compact event context where readable.
- Vertical transform travel with a rapid beginning and a meaningful deceleration.
- Edge fades, so clipped passing cards do not appear as accidental content cut-offs.
- A controlled sense of motion away from the centre, while the item in the centre remains identifiable.
- A final crisp roster identity, followed by the actual five-player card or coach/bench treatment.

Header identity must agree with the phase. While travelling, use neutral Roster 1/2/3 labels or the current passing-item presentation; do not show a fixed final team header above a lane whose centre depicts a different team. If a border tint follows the centred passing item, settle it to the actual roster colour on landing. Hard mode uses whatever neutral treatment is necessary to conceal its hidden metadata.

The generated opening study still has illustrative emblems in its neutral lane headers and exaggerated travel glow. Those are visual exploration, not implementation requirements: production should remove premature identity cues and calibrate the effect intensity.

Keep a visible, enabled **Show case** button during the entire animated opening. It must be reachable by keyboard and touch immediately. Draft and reroll are unavailable during that opening, but explain the waiting state rather than leaving a silent grey action. The reroll count is not spent by the animation.

Use Revealing three rosters as the status. The reference's Scanning Major history spinner suggests a background lookup even though the actual result is already drawn locally. The new presentation should not pretend to be loading or searching data.

#### 6. Specify motion with a beginning and an end

Suggested initial motion budget, to be tuned in the browser rather than treated as measured behavior:

| Phase | Suggested interval | Visible behavior | Interaction/state contract |
| --- | --- | --- | --- |
| Prepare | 0–120ms | Lanes appear in their reserved bounds, edge light wakes subtly | Offer is already determined; Show case is usable |
| Travel | roughly 120–1700ms | Rapid vertical transform travel; masked passing rows convey speed | Lineup, count and saved offer do not change |
| Decelerate | roughly 1700–2400ms | Travel visibly slows; centre cards sharpen | No additional draw or probability adjustment |
| Land | approximately 2400–2650ms | Three actual roster identities align; lanes may finish with at most a small ~80ms stagger | Each lane's result matches its corresponding offer ID |
| Release | approximately 2650–2900ms | One brief local rim-light release fades; identity panels transition to rows | All three cards become readable together; hand off focus predictably |
| Choose | until the next action | Still artwork, static selected/focused states and readable player lists | No continuing reel, sparks or pulse competing with the decision |

Keep the complete normal opening around the current ~2.9-second envelope. Do not triple it to give each lane a full serial animation. Repeated opening should remain tolerable; Fast case reveals and Show case should never feel like avoiding a penalty.

Suggested small event timings: hover/focus surface response around 80–120ms; selected-portrait/edge-light transition around 120–180ms; commit feedback around 120–220ms. These are starting values, not a requirement to animate every element. Touch and keyboard interactions must convey the same state without relying on hover.

A landing pulse is local to a frame or narrow edge. No full-screen white flash, repeated high-contrast flicker, shaking text or perpetual idle shimmer. Decorative particles should be rare, small, masked to the margins and cleared when the reveal ends.

**Blur is a motion cue, not a reading style.** Prefer masked layers or a small precomposed trail around transformed strips. Do not apply an expensive full-page blur or leave the centre landing names smeared. Do not animate giant box shadows, dozens of filters or large particle DOM trees every frame.

#### 7. Define the opening state machine and lifecycle explicitly

| Presentation state | Available actions and visible facts |
| --- | --- |
| Ready to open | Real Open case action; current lineup and pick count; no fabricated selected portrait |
| Opening | Show case available; Draft and Spin again unavailable; offer already saved; counts unchanged |
| Landed, no candidate | All three offers readable; explain that the user can select a candidate; real reroll action restored |
| Hover/focus preview | Preview-only portrait/chemistry treatment, clearly different from selected |
| Candidate selected | One selected row; actual role choice, chemistry and Draft action |
| Committed | Lineup records the actual pick; normal next-round state; brief local feedback ends |
| Reroll | One guarded pending operation; previous selection/preview cleared as appropriate; actual new offer shown |
| Reload/navigate away | Clear stale visual timers; restore the current saved offer without replaying or drawing a different one |

Use the existing run/case identity (`offerKey`, `rerollKey`, run identity/stamp) to prevent old callbacks from completing a new case. Clear timers, RAF callbacks, temporary effects and audio on unmount, skip, replacement and case change. Animation completion should only change presentation state.

Fast case reveals and reduced motion should go directly to the same actual offers, retaining a static border/identity cue. Repeated keyboard activation, double clicks, slow images, background tabs, screen changes and a resize mid-roll must not spend extra rerolls or change the draw. Return focus to a sensible exposed candidate/card control after completion or Show case; never leave focus in a hidden decorative strip.

During motion, mark decorative scrolling content as hidden from assistive technology. Announce the start and the completed offer concisely; do not announce every passing team or send per-frame live-region updates. Keep semantic controls outside decorative layers.

#### 8. Give sound the same restraint as light

The existing reel already schedules real ticks from its travel curve and a landing chime. Preserve the current sound preference and first-interaction requirements. A three-lane reveal should not become three overlapping machine-gun tick tracks.

Use one coherent tick stream, or merge near-coincident marker crossings, with a capped density and balanced volume. A small stagger can give the final three arrivals weight, but the sound should match visible landing rather than count a false result. Mute remains silent; skipping or leaving the screen cancels scheduled reveal sounds. Fast/reduced-motion modes retain the existing appropriate static behavior, not an unavoidable celebratory delay.

Do not add an announcer, ambient crowd loop or background music as part of this issue. Those are separate product decisions, and the requested visual richness does not require them.

#### 9. Preserve the atmosphere on phones and in alternate themes

At 320/375px, settled play should continue to show one readable roster at a time, with explicit access to all three offers. A compact lineup summary can open the existing full-lineup sheet; do not compress seven desktop cards into seven tiny touch targets. The currently selected candidate remains identifiable as the user changes visible rosters.

For opening, prefer **three compact full-width identity windows stacked vertically**, each using vertical travel within its own short viewport. This keeps all three results represented without three unreadable 100px columns. Keep the complete opening time the same as desktop. If a narrower treatment is chosen, it must still expose all three resulting offers and preserve their order, without making the user wait through three serial animations.

Reduce foreground-silhouette coverage, haze, particles and bloom on narrow screens. Keep strong team identity in the visible banner, while small text and controls sit against opaque enough surfaces. The selected portrait can be smaller, but should still share the selected team's light/motif. Reserve space for bottom actions and device safe areas; never hide the last row behind a sticky decision strip.

Fast and reduced-motion screens should look intentionally designed: same composition and team art, crisp immediate offers, static focus/selection indicators, no rolling blur or sparks. “No motion” should not revert to an unrelated bare theme.

Light mode should retain real photos, team identity and the same hierarchy on lighter opaque reading surfaces with adapted accents. A subdued photographic backdrop or art-free arena treatment is acceptable; do not force the whole app back into dark mode. High contrast/forced colors may omit atmosphere and motion entirely while preserving facts, borders and clear state. Team hue is never the only differentiator.

### Asset plan and production boundaries

| Asset/composition | Production approach | Required record/fallback |
| --- | --- | --- |
| Arena | Reuse or refine the original generated arena as compressed raster; inspect the actual draft crop | Original source, prompt/provenance, compressed dimensions/bytes; art-free fallback |
| Margin haze/grain/light | Small reusable static texture or CSS/SVG masks; effect confined to edges | Document purpose and cost; can be removed without losing information |
| Team-header montage | Compose actual credited portrait layers with real logo and data-driven org colour | Correct roster membership; media provenance; clean incomplete-montage fallback |
| Selected-player portrait bay | Real source portrait/crop, team emblem/motif and separate directional lighting | Source-size audit and identity fidelity; honest missing-photo silhouette |
| Frame/marker/role controls | Real SVG/CSS primitives and HTML | No raster typography or fake focus/control pixels |
| Reveal motion/trails | Transforms, masks and limited layers | Lifecycle cleanup; static/fast/reduced-motion equivalent |

Generated art may supply anonymous environmental decoration, texture, light and a neutral silhouette. It must not become a synthetic photo of a named pro, a made-up official render, an invented team logo or a fabricated historical jersey. Use correct real logo assets for identification; preserve source/credit links. Existing media source notes are not proof that every new source is freely licensed.

For simple decorative cutouts, a genuine simplified SVG trace is acceptable if its paths are reviewed at display size. A raster embedded inside an SVG wrapper is not a trace. Keep originals and a reproducible recipe when tracing. Retain detailed arena depth in a compressed raster if tracing produces an excessive path count.

The design studies on this branch are not production asset bundles. Their anonymous portraits, approximate emblems and generated text must not be copied into the live game as real roster media.

### Performance and offline budget

Record the baseline and final `dist/index.html` byte and gzip sizes. Main `b879ba8` is approximately 2,866.46 KB / 1,747.30 KB gzip; #224's prepared arena integration adds about 51 KB gzip. Those are reference measurements, not a promised budget for this larger pass.

Set an initial **additional-art target of no more than ~200 KB gzip beyond the corresponding merged baseline**, and report an explicit asset breakdown. Revisit the composition if it requires hundreds of separately baked roster-banner images. This is a design target to guide tradeoffs, not a claim that the current generated mockup PNGs are small enough to ship.

Reuse existing portrait/logo URLs across rows, banners and the decision bay. Prefer runtime composition to a separate high-resolution composite for every historical lineup. Reuse the arena URL through one shared declaration so Home/desktop/phone variants do not inline identical large data URLs repeatedly. A selected-portrait source variant needs a deliberate size/quality tradeoff; enlarging every cached photo by default will undermine the offline budget.

Generate only visible effects and stop them when inactive or hidden. Measure frame behavior on a representative mid-range phone and desktop, with all three lanes moving. Keep the main travel on transforms, avoid per-frame layout reads, and confirm that source image decoding cannot block the reveal completion/skip behavior. Treat a sustained ~60fps desktop and usable phone behavior as goals to verify, not inferred properties of a static concept.

No remote artwork requests, autoplay media download, new heavy animation framework or production dependency should be introduced merely to reproduce a screenshot effect. The page must still work from its self-contained offline output.

### Implementation seams and suggested sequence

| Area | Existing source / responsibility |
| --- | --- |
| View-specific composition/header/lineup geometry | `src/App.tsx`, `src/screens/Draft.tsx`, shared shell; preserve shared width and saved-run navigation |
| Roster identity / eligibility / candidate states | `CaseCards`, `DraftBar`, `src/game/draftui.ts`; keep facts and legality from their current helpers |
| Reveal presentation and cleanup | `DraftStage`, `CaseReel`, `useReroll`, `src/ui/reel.ts` |
| Portraits, badges and icons | `src/ui/art.tsx`, `src/ui/icons.tsx`, cached media / `assets-src` |
| Scoped styling | `src/styles/editorial-draft.css`; add a narrowly scoped art/motion layer rather than unrelated global selectors |
| Sound | `src/ui/sound.ts` and curve-based tick scheduling |
| Data and hidden-role safeguards | `src/game/state.ts`, roster data, existing hard-mode/eligibility helpers; no rule changes |

Deliver in reviewable phases within this parent issue:

1. **Scene and still-art spike:** active-view scope, arena crop/scrim, one accurate team montage and one selected portrait composition. Show a screenshot with all effects frozen/disabled. Validate portrait-source quality and bundle cost before applying it to every roster.
2. **Settled draft composition:** seven-slot desktop rail, three real cards, one selected candidate, full decision strip; mobile roster navigation and alternate themes. Cover no-selection, legal secondary role, unavailable, coach, bench and hard-mode variants.
3. **Three-lane reveal:** mount in final card bounds, derive all final identities from the current saved offer, vertical motion, precise landing and transition to real rows. Keep Show case and the existing fast/reduced-motion contract.
4. **Effects and sound calibration:** local glow/trails/landing release, restrained tick behavior and media decoding. Review readable centre windows and effects disabled, not just the most dramatic mid-roll frame.
5. **Verification and handoff:** baseline/final browser screenshots and short recordings, state-invariance checks, actual performance/size results, credits and final asset inventory.

The written implementation checklist can later be split into child issues if useful, but this issue remains the canonical art-direction reference. Do not create separate issues that merely restate “add glow” or “make it cinematic” without a concrete component/state outcome.

### Acceptance criteria

#### Visual and artwork

- [ ] Settled desktop screenshots show an integrated arena scene, distinctive real-roster team montages, a larger selected portrait composition and coherent lighting approaching the supplied references.
- [ ] The still frame remains rich and intentional with motion and particles disabled; text, centre identities and controls remain crisp.
- [ ] One chosen candidate is visually selected. Focus, hover preview, unavailable and selected states are distinguishable without relying only on hue.
- [ ] Real logos/photos/roster membership and metadata come from actual sources; no generated stand-in is shipped as a real pro or official asset.
- [ ] Missing portrait/logo/arena assets have deliberate readable fallbacks and preserve all actions, facts and source access.
- [ ] Typography, panel heights and portrait/row alignment are reviewed at actual display sizes; no decorative layer changes hit targets or covers body text.

#### Rolling system and game-state correctness

- [ ] Three vertical roster-identity lanes land on `s.offer[0]`, `[1]`, `[2]` in the actual offer order, without changing seeds, probabilities, seen history or eligibility.
- [ ] Opening, deceleration, landing and settled cards share reserved geometry; the transition does not jerk the page or move the decision strip.
- [ ] Show case is immediately available throughout the opening; normal, skipped, fast, reduced-motion and reloaded paths expose exactly the same saved offer.
- [ ] Animation completion is presentation-only; rapid presses, double reroll activation, resize, hidden tabs and stale callbacks cannot consume extra rerolls or alter a new case/run.
- [ ] The count says picks, correctly includes coach/bench, and changes only after an actual committed pick.
- [ ] Chemistry, main/secondary-role copy and coach/bench treatment reflect the current model; an empty lineup does not display fictitious teammate bonuses.
- [ ] Hard-mode hidden role/fit/strength/rarity information does not leak through icons, colours, banners, sound or decorative copy.
- [ ] Desktop and phone openings take the same bounded time; skip, mute and visual cleanup leave no delayed flash, audio or callback behind.

#### UX, access and themes

- [ ] 320/375/768/1440/1920px states are reviewed with real browser screenshots; phones keep readable roster rows, access to all three offers and 44px controls.
- [ ] Keyboard focus/selection/commit, roster inspection, lineup sheet and Escape behavior remain coherent; focus returns to exposed controls after reveal/skip.
- [ ] Normal dark, light, both high-contrast palettes and forced colors have deliberate presentations, with sufficient text/control contrast over their backgrounds.
- [ ] Reduced motion and Fast case reveals provide immediate crisp offers while retaining the designed atmosphere and truthful state.
- [ ] Decorative scrolling content is excluded from repetitive screen-reader announcements; status is concise and facts/actions remain semantic.
- [ ] 200% browser zoom and enlarged text are actually checked and distinguished in the evidence. No unperformed manual/device checks are described as completed.

#### Delivery evidence and performance

- [ ] PR includes real settled/opening/landing screenshots or a short recording, a phone recording, effects-off/missing-art captures and the relevant hard/coach/bench/secondary-role variants.
- [ ] Original generated environmental sources, exact production media sources, source-size decisions, any genuine tracing recipe and credits are retained.
- [ ] Final offline byte/gzip delta, asset breakdown and representative frame/performance results are recorded; no full-resolution design mockup is imported into the game.
- [ ] Validation matches the change: normal fast CI plus targeted reveal/state checks; full playback and relevant game invariants are run when the reveal/commit plumbing changes. Do not restore expensive full simulations on every unrelated UI iteration.

### Related work and scope boundaries

- #97 tracks the wider visual refresh; this is the canonical detailed draft artwork/effects follow-up.
- #98 owns broader screen/phone concepts. These studies cover the draft and opening sequence, not a completed redesign of every screen.
- #200/#202 and merged #213 established the shared editorial and draft foundations; their completed work is retained.
- #214/#224 own the Home arena hero. Coordinate asset reuse and active-view scoping; this issue does not duplicate their Home implementation.
- #215/#220 own Home's traced mode artwork. Reuse provenance/process where appropriate, not those same pictures as factual roster art.
- #106 owns flags/real-name data; #112 owns final brand identity. Use the existing interim mark and real country data while those proceed.
- #74/#196 own existing static-reveal/skip behavior, now established. Preserve that contract in the richer reveal.
- #172 owns the draft-duel fairness contract. A more dramatic animation does not fix or validate that separate gameplay problem.
- #208/#209 concern code/style organization; #210 concerns e2e module organization. Split implementation where it clarifies the new seams, without turning the artwork pass into a repository-wide refactor.
- #216's staged Free Play configuration and #221's lean CI remain separate.

### Reference boundaries

The supplied rolling image communicates atmosphere and layout, not a validated probability model or exact state machine. The generated PNGs are design studies: they cannot prove contrast, frame rate, input behavior, historical accuracy or source licensing. Written state/source requirements take precedence over incidental generated labels, colours, icons, portraits and controls. Acceptance requires comparison of implemented browser output with the references at real sizes, including calm settled frames and reduced-motion equivalents, rather than judging only a dramatic opening still.
