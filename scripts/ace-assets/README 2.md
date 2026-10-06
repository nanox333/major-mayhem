# ACE impact assets

Build the small GLB with Blender:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/ace-assets/textured.py
```

The generator builds a continuous, irregular shallow glass surface: a raised inner lip, recessed opening and flat peripheral sheet. The realistic fine fractures and chipped reflections come from the transparent detail plate documented in [PROMPTS.md](PROMPTS.md). The runtime uses a textured standard material, a moving directional light and a small HDR reflection probe. It masks reflections on the black cavity so the center absorbs light. There is no separate environment or movie. The active files are `impact-real.glb` (38 KB) and `glass-detail.webp` (242 KB), about 280 KB together. Earlier procedural prototypes remain for comparison and are not loaded.

The reference is the user's five-impact ACE storyboard: top-center hole, two side holes, two low holes framing a rough orange wordmark. Desktop uses that arrangement; phones have a tighter, smaller composition. The original ACE wordmark is inline vector artwork, with no extra font. Smoke uses locally generated noise on five narrow, twisted shader ribbons, inspired by Brad Woods’ [smoke tutorial](https://garden.bradwoods.io/notes/javascript/three-js/shaders/shaders-103-smoke). Thirty preallocated debris instances are shared across hits.

`src/ui/ace/timeline.ts` is the clock: a 0.78s suspense lead-in, fading to dark over 0.4s, then holding for 0.38s, then five hits at 780/1100/1420/1740/2100ms; reveal at 2.5s; player photo, nickname, team and map/round reveal at 2.72–3s; fade finishes at 4.9s. All visuals, fallback and debug seeking derive from elapsed seconds. Audio reuses the existing sound bank. The match's ACE detection and playback logic are unchanged; `onComplete` clears the existing highlight pause.

The tiny GLB is preloaded on entering the match. Each highlight owns its GPU geometry and materials, stops its animation clock, disconnects its observer, disposes the renderer and removes its canvas when closed. Failed WebGL initialization or context loss switches to the same realistic glass detail image and the same wordmark/timeline. Reduced motion gets a static composition with silent completion.

Review from Debug → Effects → Ace, or the Ace frame scrubber. A real match is available at `?debug&scenario=live-legend-ace`.

```sh
node scripts/ace-e2e.mjs
ACE_GPU=1 node scripts/ace-e2e.mjs
```

The second command selects Chromium's Metal backend for hardware measurements. The browser checks impact order, reveal, callbacks, early unmount, StrictMode effect replay, repeated events, mobile/tablet sizing, fallback, reduced motion, normal rounds and match resumption. Screenshots are in the ignored `output/playwright/ace/` directory. Tests assert fewer than 20 draw calls, fewer than 10k triangles and an asset below 1 MB. Hardware frame-rate measurements should be distinguished from software WebGL and contended machines.

The screen treatment uses a CSS colour grade, grain, warm wash, vignette and brief impact flashes. It mutes the existing UI while the brighter impacts and ACE take focus. No postprocessing render targets, bloom, blur pass or extra 3D environment are used. The five impacts unfold over 1.5 seconds, with time to read ACE and the player identity before the fade.

Damage matrices remain fixed from the instant each hit appears. Sparks, streaks and brief barrel-like smoke wisps move independently; no recoil transform is applied to the glass. Smoke is composited in front of the damage and stays local to each opening. Kenney, Cientos and Texturelabs images were considered but are not included or loaded. The player panel uses the actual event player ID resolved against the lineup. The debug scrubber uses an explicit sample player.
