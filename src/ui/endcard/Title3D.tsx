import React, { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { createTitle, type TitleName } from './titleScene';

/** The end-card title as real 3D letters (modelled in Blender), slammed in on the clock. The host sets `--endcard-age` (seconds since the
 *  title started, negative before) on any ancestor; this reads it each frame, so playback and the scrubber drive it the same way.
 *  If WebGL or the model fails it shows `fallback`. */
export function Title3D({ name, fallback }: { name: TitleName; fallback: React.ReactNode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    let dead = false, raf = 0, last = NaN, renderer: T.WebGLRenderer | undefined, title: Awaited<ReturnType<typeof createTitle>> | undefined, observer: ResizeObserver | undefined;
    const fit = () => {
      if (!renderer || !title) return;
      const r = canvas.getBoundingClientRect(); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false); title.resize(Math.max(1, r.width), Math.max(1, r.height)); last = NaN;
    };
    try {
      renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
      renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NoToneMapping; renderer.setClearColor(0x000000, 0);
    } catch { setFailed(true); return; }
    createTitle(name).then((t) => {
      if (dead || !renderer) { t.dispose(); return; }
      title = t; t.attach(renderer); observer = new ResizeObserver(fit); observer.observe(canvas); fit();
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const age = parseFloat(getComputedStyle(canvas).getPropertyValue('--endcard-age'));
        if (!Number.isFinite(age) || age === last) return; last = age;
        t.update(age); renderer!.render(t.scene, t.camera);
      };
      // compile every material and upload every texture now (three skips what is hidden, and most of the title is hidden at age 0), so the first landing does not stutter
      for (const warm of [.3, .8, 1.4, 2.4, -1]) { t.update(warm); renderer.render(t.scene, t.camera); }
      tick();
    }).catch(() => { if (!dead) setFailed(true); });
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setFailed(true); });
    return () => {
      dead = true; cancelAnimationFrame(raf); observer?.disconnect(); title?.dispose();
      if (renderer) { renderer.dispose(); if (!canvas.isConnected) renderer.forceContextLoss(); }
    };
  }, [name]);
  if (failed) return <>{fallback}</>;
  return <canvas ref={ref} className="endcard-title3d"  aria-hidden="true" />;
}
