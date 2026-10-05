import React, { useEffect, useRef } from 'react';
import type { LegendKind } from '../../game/match';
import type { Scene3D } from './kit';

/** Which legendary moments have a 3D scene. The rest keep their 2D scene. */
export const HAS_3D: Partial<Record<LegendKind, () => Promise<{ default: (c: HTMLCanvasElement) => Scene3D }>>> = {
  noscope: () => import('./noscope').then((m) => ({ default: m.noscope })),
};

export const webglOk = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };
export const can3D = (k: LegendKind) => !!HAS_3D[k] && webglOk();

/**
 * Draws a 3D scene to a canvas that fills its box. With `at` set it draws that one frame (the debug scrubber); otherwise it plays from zero.
 * `onReady` fires once the scene is built, so the caller can start its clock then and not while the code is still loading.
 */
export function Stage({ kind, at, onReady }: { kind: LegendKind; at?: number | null; onReady?: (d: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Scene3D | null>(null);
  const atRef = useRef(at); atRef.current = at;
  useEffect(() => {
    let dead = false, raf = 0, ro: ResizeObserver | undefined;
    HAS_3D[kind]!().then((m) => {
      if (dead || !ref.current) return;
      const canvas = ref.current, s = m.default(canvas); scene.current = s; (canvas as HTMLCanvasElement & { scene3d?: Scene3D }).scene3d = s; // the debug contact sheet draws frames through this
      const fit = () => { const b = canvas.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 1.75); s.resize(Math.round(b.width * dpr), Math.round(b.height * dpr)); };
      fit(); ro = new ResizeObserver(() => { fit(); s.render(atRef.current ?? 0); }); ro.observe(canvas);
      onReady?.(s.duration);
      const t0 = performance.now();
      const tick = () => { s.render(atRef.current ?? (performance.now() - t0) / 1000); raf = requestAnimationFrame(tick); };
      tick();
    });
    return () => { dead = true; cancelAnimationFrame(raf); ro?.disconnect(); scene.current?.dispose(); scene.current = null; };
  }, [kind]);
  return <canvas ref={ref} className="lg3d" aria-hidden="true" />;
}
