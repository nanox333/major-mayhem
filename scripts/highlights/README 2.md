# Real-time highlight kit

The no-scope uses a Blender-exported GLB, rendered by Three.js in React. It does not decode or display video. Its 4.1-second camera, projectile, effects and fall are calculated from elapsed seconds; the same scene supports seeking backwards in Debug → Effects.

Rebuild the kit from the repository root:

```sh
node scripts/highlights/texture-atlas.mjs
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/highlights/export-noscope.py -- --out public/assets/highlights/noscope --character /path/to/Meshy_AI_Full_body_generic_tac_1005150547_texture.glb
```

Blender +Y maps to browser −Z; Blender Z maps to browser Y. The environment, rifle and projectile are authored in Blender. The operator was generated with Meshy 6 Lite and downloaded by the project owner. `import-operator.py` preserves its PBR UVs, reduces it to 7,399 triangles, resizes maps to 1024px and adds a eight-bone reaction skeleton. The exported kit is approximately 1.6 MB, with 14,341 source triangles. The saved `assets/noscope.blend` contains the editable optimized assets and packed textures; the original GLB is supplied via `--character` when rebuilding. Omitting that option produces a primitive authoring placeholder, not the shipped character. JPEG texture compression keeps the kit small without a runtime geometry decoder.

The operator's rifle is part of the generated asset. No additional rifle is placed through its torso. See `LICENSES.md` for provenance.

The collapse uses Cannon physics: seven constrained rigid bodies with one floor collider. A short trajectory is calculated once at a fixed 120 Hz step and sampled by elapsed time. This provides gravity, joint limits, floor contact and settling without a persistent physics loop. The cached samples also support backwards scrubbing.

The CPU source loads after the initial interface paints. Each mounted scene clones its skeleton and owns its geometry, materials and textures. Only mounted highlights create a renderer, resize observer and animation loop; completion and unmount dispose them. The cached source never creates a renderer. Phones use DPR 1 and smaller shadows; desktop caps DPR at 1.5 and can downgrade when rendering is slow. There is one hemisphere light and one shadow-casting sun, 24 dust points, 12 speed lines and 10 impact sparks, eight dust puffs and a short expanding impact ring. The ACE-inspired finishing pass uses strong desaturation, charcoal shadows, smoky amber edges, temporal film grain and a deeper vignette. Desktop adds HDR bloom and brief impact chromatic separation. Projectile-only blur uses four short, low-intensity exposure samples with length and softness driven by the analytic acceleration of the flight path; the rest of the scene stays sharp. A small HDR probe supplies realistic metal and armor highlights, and a 256px planar capture is softly masked into damp floor patches. Phones skip that extra capture. The environment material balance and sky are darkened independently so the textured operator remains readable. Phones skip bloom but keep the grade. All render targets and passes are disposed on close. The projectile lingers just after firing, then accelerates sharply into the hit; FOV and speed lines follow that speed ramp. The physical fall uses a short impact hold; burst effects advance through that hold. A distressed Saira stencil title lands, holds, then the entire overlay crossfades back to the paused match before completion. The authored projectile diameter is below a third of the helmet diameter; its hard geometry is hidden beneath the short soft exposure silhouette.

The existing match event and completion callback still pause and resume the round. A failed GLB load, context loss or failed WebGL initialization shows the static NOSCOPE highlight and continues normally. Reduced motion uses that fallback immediately.

Run `npm test`, `npm run build` and `npm run e2e:legend`. Browser tests use the development server for the StrictMode lifecycle fixture, then exercise the actual match scenario. Set CHROMIUM_PATH when using a system browser. Diagnostics are available only with `?debug` as window.__mmHighlights.
