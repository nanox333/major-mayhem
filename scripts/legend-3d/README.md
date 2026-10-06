# Historical Blender video prototype

The no-scope video pipeline below is retired. The game now uses the real-time GLB kit documented in [the highlight README](../highlights/README.md). These scripts remain historical authoring references; their videos are not shipped or played.

# Blender legendary cinematics

The no-scope is rendered ahead of time in Blender 5.2.2. It uses a blend of illustrated color and physical shading, warm directional/key lighting, cool rim lights, volumetric haze, per-shot depth of field, and a baked vignette. Clean bevels and physical shadows replace the former comic outline pass; `--ink` is available for illustrated variants. The model includes tapered clothing, armor straps, helmet rails, and scope/receiver details.

The game and debug scrubber decode the committed MP4s in `public/legend/` off the DOM, drawing each decoded frame to canvas. This keeps the cinematic out of generic hover-media previews. Decorative images are also excluded from pointer hit testing; their containing buttons/cards remain interactive.

Vite copies the videos separately, so they download on demand and are not part of the inline HTML bundle. A standalone copy of the HTML without the videos falls back to the static legendary card. Blender and ffmpeg are needed only when changing the scene.

Rebuild both orientations from the repository root:

```sh
sh scripts/legend-3d/render.sh /tmp/major-mayhem-render
```

Set `BLENDER` to override the executable path. The script writes 146 frames per orientation at 30 fps. Landscape is native 3840×2160 with 32 samples; portrait is native 1440×2560 with 32 samples. H.264 is encoded at CRF 16 with yuv420p, fast-start metadata and a keyframe every eight frames for responsive seeking. GPU denoising removes sampling grain before the vignette; GPU compositing uses a separable blur. Scratch frames are not committed.

For individual frames, run Blender with `--list 0,20,65,90,115,140`; use `--portrait --res 720x1280` for a quick portrait framing check. `noscope.py` builds the scene once and evaluates each requested time independently. Production and previews use 30 fps.

Timing is stretched by `SLOW = 1.25`: shot at 0.5s, impact at 2.875s, final cut at 3.875s, marker at 4.438s. The video lasts 146/30 seconds. The overlay waits for actual playback before starting card animation; sounds follow decoded video time and the card appears at 3.6s so the impact remains visible, and completion follows a 0.9s hold after the end of the clip. A failed load (including a twelve-second timeout) shows the card alone. Reduced motion never loads the video.

Run `npm run e2e:legend` after building to check desktop/phone playback, frame seeking, delayed/failed loading, reduced motion, and media hit testing. Screenshots are saved in `shots/legend/`.

The rifle sits outside the shooter’s right hip; `Blender -b -P scripts/legend-3d/verify-pose.py` checks evaluated weapon meshes against the body and verifies reachable grips across all 146 frames. The impact combines a luminous burst, two delayed expanding rings, 32 sparks, dust, a short warm light pulse, bloom and a decaying camera punch. Effects use presentation time while the falling body uses slowed world time.

## 1v5 CLUTCH

`clutch_assets.py` builds `public/assets/highlights/clutch/arena.glb` (a floor, a back wall with an opening, two side structures; three meshes, about 250 polygons):

```
Blender -b -P scripts/legend-3d/clutch_assets.py -- public/assets/highlights/clutch
```

The survivor and the five enemies are the operator from the no-scope kit (`noscope/kit.glb`, the `Target` node only), posed on its bones and dropped with the same ragdoll, so no second character model is shipped. The 3D title is `title3d.py ... clutch` (`title-clutch.glb`). The scene is `src/ui/clutch/scene.ts`, the clock `src/ui/clutch/timeline.ts`.
