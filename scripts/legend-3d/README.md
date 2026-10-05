# Blender legendary cinematics

The no-scope is rendered ahead of time in Blender 5.2.2. It uses a blend of illustrated color and physical shading, warm directional/key lighting, cool rim lights, volumetric haze, per-shot depth of field, and a baked vignette. Clean bevels and physical shadows replace the former comic outline pass; `--ink` is available for illustrated variants. The model includes tapered clothing, armor straps, helmet rails, and scope/receiver details.

The game and debug scrubber decode the committed MP4s in `public/legend/` off the DOM, drawing each decoded frame to canvas. This keeps the cinematic out of generic hover-media previews. Decorative images are also excluded from pointer hit testing; their containing buttons/cards remain interactive.

Vite copies the videos separately, so they download on demand and are not part of the inline HTML bundle. A standalone copy of the HTML without the videos falls back to the static legendary card. Blender and ffmpeg are needed only when changing the scene.

Rebuild both orientations from the repository root:

```sh
sh scripts/legend-3d/render.sh /tmp/major-mayhem-render
```

Set `BLENDER` to override the executable path. The script writes 292 frames per orientation at 60 fps. Landscape is native 3840×2160 with 32 samples; portrait is native 1440×2560 with 32 samples. H.264 is encoded at CRF 16 with yuv420p, fast-start metadata and a keyframe every quarter second for responsive seeking. GPU denoising removes sampling grain before the vignette; GPU compositing uses a separable blur. Scratch frames are not committed.

For individual frames, run Blender with `--list 0,40,130,180,230,280`; use `--portrait --res 720x1280` for a quick portrait framing check. `noscope.py` builds the scene once and evaluates each requested time independently. `--fps 30` is available for cheaper preview renders; production uses 60 fps.

Timing is stretched by `SLOW = 1.25`: shot at 0.5s, impact at 2.875s, final cut at 3.875s, marker at 4.438s. The video lasts 292/60 seconds. The overlay waits for actual playback before starting card animation; sounds follow decoded video time and completion follows the end of the clip. A failed load (including a twelve-second timeout) shows the card alone. Reduced motion never loads the video.

Run `npm run e2e:legend` after building to check desktop/phone playback, frame seeking, delayed/failed loading, reduced motion, and media hit testing. Screenshots are saved in `shots/legend/`.
