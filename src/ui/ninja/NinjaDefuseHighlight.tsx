import React, { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { play } from '../sound';
import bombArt from '../../assets/legend/bomb.webp';
import { createNinjaScene } from './scene';
import { NINJA_DURATION, ninjaCues, ninjaLayout, ninjaTime } from './timeline';

export const ninjaDiagnostics = { renderers: 0, loops: 0, observers: 0, last: { calls: 0, triangles: 0, geometries: 0, textures: 0, fps: 0, dpr: 0 } };
if (typeof location !== 'undefined' && location.search.includes('debug')) Object.assign(window, { __mmNinja: ninjaDiagnostics });

/**
 * The NINJA DEFUSE highlight: one close-up of the bomb, the hands, the display counting down to the last hundredths, the click, DEFUSED, then
 * the title. Real-time three.js with two small GLBs (scripts/legend-3d/ninja_assets.py); the bar and the title are HTML so they stay crisp.
 * Elapsed seconds drive everything (timeline.ts), so the scrubber can show any frame. If WebGL or the assets fail, the same clock runs an HTML fallback.
 * `start` is the hundredths the display opens on (a very late defuse 11, an extremely late one lower).
 */
export function NinjaDefuseHighlight({ onComplete, at, still = false, start = 11 }: { onComplete?: () => void; at?: number | null; still?: boolean; start?: number }) {
  const root = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
  const done = useRef(onComplete); done.current = onComplete;
  const time = useRef(at); time.current = at;
  const redraw = useRef<(() => void) | null>(null);
  useEffect(() => {
    const el = root.current, c = canvas.current; if (!el || !c) return;
    let renderer: T.WebGLRenderer | undefined, world: Awaited<ReturnType<typeof createNinjaScene>> | undefined;
    let dead = false, finished = false, raf = 0, loop = false, frames = 0, lastTime = 0, observer: ResizeObserver | undefined, ready = false;
    const t0 = performance.now(), played = new Set<string>(), stops: (() => void)[] = [], cues = ninjaCues();
    const stopLoop = () => { cancelAnimationFrame(raf); if (loop) { loop = false; ninjaDiagnostics.loops--; } };
    const release = () => {
      world?.dispose(); world = undefined;
      if (renderer) { const r = renderer; r.dispose(); renderer = undefined; ninjaDiagnostics.renderers--; queueMicrotask(() => { if (!c.isConnected) r.forceContextLoss(); }); }
    };
    const fail = () => { release(); if (!dead) setFallback(true); };
    const lost = (e: Event) => { e.preventDefault(); fail(); };
    c.addEventListener('webglcontextlost', lost);
    const fit = () => {
      const r = el.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height), layout = ninjaLayout(w);
      el.dataset.size = layout.mobile ? 'phone' : 'wide'; el.style.setProperty('--ninja-bar', String(layout.bar));
      if (renderer && world) { renderer.setPixelRatio(layout.mobile ? 1 : Math.min(devicePixelRatio || 1, layout.dpr)); renderer.setSize(w, h, false); world.resize(w, h); }
    };
    /** Sounds fire once, when the clock first passes them; never while scrubbing. */
    const sounds = (t: number) => {
      if (time.current != null || still) return;
      const once = (id: string, when: number, fn: () => (() => void)) => { if (t >= when && !played.has(id)) { played.add(id); stops.push(fn()); } };
      cues.beeps.forEach((when, i) => once(`b${i}`, when, () => play('tick', { pitch: 1.1 + i * .12 })));
      once('tension', cues.tension, () => play('clutch', { pitch: .8 })); once('click', cues.click, () => play('click', { pitch: .85 }));
      once('confirm', cues.confirm, () => play('accept', { pitch: 1.25 })); once('sting', cues.sting, () => play('hit', { pitch: .9 }));
    };
    const draw = (seconds: number) => {
      if (dead) return;
      const t = still ? 1.3 : seconds, s = ninjaTime(t, start); lastTime = t;
      el.dataset.time = t.toFixed(4); el.dataset.timer = s.text; el.dataset.state = s.defused ? 'defused' : s.success ? 'click' : 'defusing'; el.dataset.title = String(s.ninja > 0);
      const set = (k: string, v: number | string) => el.style.setProperty(k, String(v));
      set('--ninja-fade', s.fade); set('--ninja-dim', s.dim); set('--ninja-vignette', s.vignette); set('--ninja-progress', s.progress);
      set('--ninja-critical', s.critical); set('--ninja-green', s.green > 0 ? 1 : 0);
      set('--ninja-title', s.ninja); set('--ninja-sub', s.defuse); set('--ninja-snap', 1.12 - .12 * s.ninja); set('--ninja-snap2', 1.12 - .12 * s.defuse);
      el.querySelectorAll<HTMLElement>('[data-ninja-text]').forEach((n) => { if (n.textContent !== s.text) n.textContent = s.text; });
      el.querySelectorAll<HTMLElement>('[data-ninja-label]').forEach((n) => { if (n.textContent !== s.label) n.textContent = s.label; });
      el.querySelectorAll<HTMLElement>('[data-ninja-pct]').forEach((n) => { const p = `${Math.round(s.progress * 100)}%`; if (n.textContent !== p) n.textContent = p; });
      if (renderer && world) {
        world.update(t); renderer.render(world.scene, world.camera);
        ninjaDiagnostics.last = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, fps: seconds > 0 ? frames / seconds : 0, dpr: renderer.getPixelRatio() };
      }
      sounds(t);
    };
    const tick = (now: number) => {
      if (dead) return; frames++;
      const t = Math.min((now - t0) / 1000, NINJA_DURATION);
      try { draw(t); } catch { fail(); }
      if (t >= NINJA_DURATION) { stopLoop(); if (!finished) { finished = true; done.current?.(); } } else raf = requestAnimationFrame(tick);
    };
    const begin = () => {
      ready = true; fit(); redraw.current = () => { try { draw(time.current ?? lastTime); } catch { fail(); } };
      if (time.current == null) { loop = true; ninjaDiagnostics.loops++; raf = requestAnimationFrame(tick); } else redraw.current();
    };
    redraw.current = () => draw(time.current ?? 0);
    observer = new ResizeObserver(() => { fit(); if (ready) redraw.current?.(); }); observer.observe(el); ninjaDiagnostics.observers++;
    fit();
    if (still) { setFallback(true); draw(1.3); }
    else {
      try {
        renderer = new T.WebGLRenderer({ canvas: c, antialias: true, alpha: false, powerPreference: 'high-performance' }); ninjaDiagnostics.renderers++;
        renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
        // if the assets are slow the fallback plays instead: the match must never wait for a highlight
        const slow = setTimeout(() => { if (!ready && !dead) { fail(); begin(); } }, 2500);
        createNinjaScene(start).then((w) => {
          if (dead || !renderer) { w.dispose(); return; }
          world = w; if (el.clientWidth < 600 || (navigator.hardwareConcurrency || 4) <= 4) world.setLow();
          clearTimeout(slow); if (ready) return; begin();
        }).catch(() => { clearTimeout(slow); fail(); if (!ready) begin(); });
        stops.push(() => clearTimeout(slow));
      } catch { fail(); begin(); }
    }
    return () => {
      dead = true; stopLoop(); redraw.current = null; observer?.disconnect(); ninjaDiagnostics.observers--; c.removeEventListener('webglcontextlost', lost);
      release(); stops.forEach((fn) => fn());
    };
  }, [still, start]);
  useEffect(() => { redraw.current?.(); }, [at]);
  return (
    <div ref={root} className="ninja-highlight" data-highlight="ninja" data-mode={fallback ? 'fallback' : 'webgl'} aria-hidden="true">
      <div className="ninja-dim" />
      <canvas ref={canvas} className="ninja-canvas" style={{ display: fallback ? 'none' : undefined }} />
      <div className="ninja-fallback" style={{ display: fallback ? 'block' : 'none' }}>
        <img src={bombArt} alt="" /><b className="ninja-fallback__lcd" data-ninja-text>0:00.11</b><i className="ninja-fallback__led" />
      </div>
      <div className="ninja-vignette" />
      <div className="ninja-frame" />
      <div className="ninja-bar">
        <span className="ninja-bar__row"><b data-ninja-label>DEFUSING...</b><i data-ninja-pct>55%</i></span>
        <span className="ninja-bar__track"><u /></span>
      </div>
      <div className="ninja-title"><b>NINJA</b><span>DEFUSE</span></div>
    </div>
  );
}
