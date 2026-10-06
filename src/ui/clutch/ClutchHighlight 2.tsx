import React, { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { play } from '../sound';
import type { Lineup } from '../../game/lineup';
import { Avatar, TeamBadge } from '../art';
import { BrushMark } from '../BrushMark';
import { Title3D } from '../endcard/Title3D';
import { legendHold } from '../legend3d/hold';
import { createClutchScene } from './scene';
import { CLUTCH_DURATION, clutchCues, clutchLayout, clutchTime } from './timeline';
import '../../styles/clutch.css';

export const clutchDiagnostics = { renderers: 0, loops: 0, observers: 0, last: { calls: 0, triangles: 0, geometries: 0, textures: 0, dpr: 0 } };
if (typeof location !== 'undefined' && location.search.includes('debug')) Object.assign(window, { __mmClutch: clutchDiagnostics });

/** A flat person: the markers of the situation graphic and of the tally. */
const Person = ({ foe, i }: { foe?: boolean; i?: number }) => (
  <span className={`clutch-icon${foe ? ' clutch-icon--foe' : ''}`} data-foe={i}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4.2" fill="currentColor" /><path d="M3.5 22c0-5.2 3.6-8.6 8.5-8.6s8.5 3.4 8.5 8.6z" fill="currentColor" /></svg>
  </span>
);

/**
 * The 1v5 CLUTCH highlight: a short real-time scene (the survivor and five enemies in an abstract arena, lit from behind), a thin HUD, five quick kills, a
 * blackout and a hero shot with the 3D "1V5 / CLUTCH" title. One `clutchTime` clock drives the WebGL scene, the HTML over it, the sounds and the scrubber.
 * If WebGL or the assets fail, the same HUD plays over a dark warm background and the match carries on.
 */
export function ClutchHighlight({ onComplete, at, still = false, who, map, round }: { onComplete?: () => void; at?: number | null; still?: boolean; who?: Lineup; map?: string; round?: number }) {
  const root = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
  const done = useRef(onComplete); done.current = onComplete;
  const time = useRef(at); time.current = at;
  const redraw = useRef<(() => void) | null>(null);
  useEffect(() => {
    const el = root.current, c = canvas.current; if (!el || !c) return;
    let renderer: T.WebGLRenderer | undefined, world: Awaited<ReturnType<typeof createClutchScene>> | undefined;
    let dead = false, finished = false, raf = 0, loop = false, frames = 0, ready = false, lastTime = 0, t0 = performance.now(), observer: ResizeObserver | undefined;
    const played = new Set<string>(), stops: (() => void)[] = [], cues = clutchCues();
    const layout = clutchLayout(el.clientWidth || innerWidth, el.clientHeight || innerHeight);
    const grain = document.createElement('canvas'); grain.width = grain.height = 128;
    const g = grain.getContext('2d');
    if (g) { const px = g.createImageData(128, 128); let r = 53; for (let i = 0; i < px.data.length; i += 4) { r = (r * 1664525 + 1013904223) >>> 0; const v = r >>> 24; px.data[i] = px.data[i + 1] = px.data[i + 2] = v; px.data[i + 3] = 110; } g.putImageData(px, 0, 0); el.style.setProperty('--clutch-grain', `url(${grain.toDataURL()})`); }
    const stopLoop = () => { cancelAnimationFrame(raf); if (loop) { loop = false; clutchDiagnostics.loops--; } };
    const release = () => {
      world?.dispose(); world = undefined;
      if (renderer) { const r = renderer; r.dispose(); renderer = undefined; clutchDiagnostics.renderers--; queueMicrotask(() => { if (!c.isConnected) r.forceContextLoss(); }); }
    };
    const fail = () => { release(); if (!dead) setFallback(true); };
    const lost = (e: Event) => { e.preventDefault(); fail(); };
    c.addEventListener('webglcontextlost', lost);
    const fit = () => {
      const r = el.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height), l = clutchLayout(w, h);
      el.dataset.size = l.mobile ? 'phone' : 'wide';
      if (renderer && world) { renderer.setPixelRatio(l.mobile ? 1 : Math.min(devicePixelRatio || 1, l.dpr)); renderer.setSize(w, h, false); world.resize(w, h); }
    };
    /** Sounds fire once, when the clock first passes them; never while scrubbing. */
    const sounds = (t: number) => {
      if (time.current != null || still) return;
      const once = (id: string, when: number, fn: () => () => void) => { if (t >= when && !played.has(id)) { played.add(id); stops.push(fn()); } };
      once('open', cues.open, () => play('clutch', { pitch: .7 })); once('lock', cues.lock, () => play('tick', { pitch: 1.4 }));
      cues.kills.forEach((when, i) => once(`k${i}`, when, () => play(i === 4 ? 'hit' : 'shot', { pitch: [1.05, 1.1, 1.18, 1.28, .8][i] })));
      once('dip', cues.dip, () => play('hit', { pitch: .6 })); once('title', cues.title, () => play('clutch', { pitch: .9 }));
    };
    const tally = Array.from(el.querySelectorAll<HTMLElement>('.clutch-tally .clutch-icon')), vs = Array.from(el.querySelectorAll<HTMLElement>('.clutch-versus .clutch-icon--foe'));
    const draw = (seconds: number) => {
      if (dead) return;
      const t = still ? 1.9 : seconds, s = clutchTime(t); lastTime = t;
      el.dataset.time = t.toFixed(4); el.dataset.kills = String(s.kills); el.dataset.shot = s.shot; el.dataset.title = String(s.title);
      const set = (k: string, v: number | string) => el.style.setProperty(k, String(v));
      set('--cl-reveal', s.reveal); set('--cl-versus', s.versus); set('--cl-frame', s.frame); set('--cl-flash', s.flash); set('--cl-black', s.black); set('--cl-ret', 0);
      set('--cl-fade', still ? 1 : s.fade); set('--cl-counter', s.counterOn * (1 - s.black)); set('--cl-title', Math.max(0, Math.min(1, s.titleAge * 2)));
      set('--ace-person', s.person); set('--ace-person-y', `${(1 - s.person) * 16}px`); set('--endcard-age', s.titleAge);
      tally.forEach((n, i) => { const m = s.markers[i]; n.style.opacity = String(1 - .85 * m.gone); n.style.setProperty('--x', String(m.hit ? Math.min(1, m.flash > .2 ? 0 : 1) : 0)); n.style.color = m.flash > .15 ? '#ffd9a0' : ''; n.style.transform = `scale(${1 + .5 * m.flash})`; });
      vs.forEach((n, i) => { n.style.opacity = String(1 - .6 * s.markers[i].gone); });
      const out = el.querySelector('.clutch-tally output'); if (out && out.textContent !== s.counter) out.textContent = s.counter;
      if (renderer && world) {
        const w = world.update(t); renderer.render(world.scene, world.camera);
        // the reticle sits on the head of whichever enemy is being tracked
        set('--cl-ret', w.reticle.on); set('--cl-lock', w.reticle.lock); set('--cx', `${(w.screen.x * 100).toFixed(2)}%`); set('--cy', `${(w.screen.y * 100).toFixed(2)}%`);
        clutchDiagnostics.last = { ...world.stats(renderer), dpr: renderer.getPixelRatio() };
      }
      sounds(t);
    };
    const tick = (now: number) => {
      if (dead) return; frames++;
      if (legendHold.on) t0 = now;
      const t = Math.min((now - t0) / 1000, CLUTCH_DURATION);
      try { draw(t); } catch { fail(); draw(t); }
      if (t >= CLUTCH_DURATION) { stopLoop(); if (!finished) { finished = true; done.current?.(); } } else raf = requestAnimationFrame(tick);
    };
    const begin = () => {
      /* the clock starts when the picture is ready, not when the highlight mounted */
      ready = true; t0 = performance.now(); fit();
      redraw.current = () => { try { draw(time.current ?? lastTime); } catch { fail(); draw(time.current ?? lastTime); } };
      if (time.current == null) { loop = true; clutchDiagnostics.loops++; raf = requestAnimationFrame(tick); } else redraw.current();
    };
    redraw.current = () => draw(time.current ?? 0);
    observer = new ResizeObserver(() => { fit(); if (ready) redraw.current?.(); }); observer.observe(el); clutchDiagnostics.observers++;
    fit();
    if (still) { setFallback(true); draw(1.9); }
    else {
      try {
        renderer = new T.WebGLRenderer({ canvas: c, antialias: true, alpha: false, powerPreference: 'high-performance' }); clutchDiagnostics.renderers++;
        renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
        // if the assets are slow the fallback plays instead: the match must never wait for a highlight
        const slow = setTimeout(() => { if (!ready && !dead) { fail(); begin(); } }, 3500);
        createClutchScene(layout.dust).then(async (w) => {
          if (dead || !renderer) { w.dispose(); return; }
          world = w; fit();
          // compile every material and draw each beat once (shot, hit, hero) before the clock starts, so nothing compiles in the middle of the animation
          await renderer.compileAsync(world.scene, world.camera);
          for (const warm of [.5, 2.0, 2.75, 3.9, 6.2, 7.6, 0]) { world.update(warm); renderer.render(world.scene, world.camera); }
          if (dead) return; clearTimeout(slow); begin();
        }).catch(() => { clearTimeout(slow); if (!dead) { fail(); begin(); } });
      } catch { fail(); begin(); }
    }
    return () => {
      dead = true; stopLoop(); redraw.current = null; observer?.disconnect(); clutchDiagnostics.observers--;
      c.removeEventListener('webglcontextlost', lost); release(); stops.forEach((fn) => fn());
    };
  }, [still]);
  useEffect(() => { redraw.current?.(); }, [at]);
  return <div ref={root} className="clutch-highlight" data-highlight="clutch" data-mode={fallback ? 'fallback' : 'webgl'} aria-hidden="true">
    <canvas ref={canvas} className="clutch-canvas" />
    <div className="clutch-fallback" />
    <div className="clutch-vig" /><div className="clutch-grain" />
    <div className="clutch-frame"><i /><i /><i /><i /></div>
    <div className="clutch-versus">
      <span className="clutch-versus__side"><Person /></span>
      <span className="clutch-versus__vs">1 VS 5<small>Round on the line</small></span>
      <span className="clutch-versus__side">{[0, 1, 2, 3, 4].map((i) => <Person key={i} foe i={i} />)}</span>
    </div>
    <div className="clutch-tally"><span className="clutch-tally__marks">{[0, 1, 2, 3, 4].map((i) => <Person key={i} foe i={i} />)}</span><output>0 / 5</output></div>
    <div className="clutch-reticle"><i /><i /><i /><i /><b /></div>
    <div className="clutch-flash" /><div className="clutch-black" />
    <Title3D name="clutch" fallback={<div className="clutch-title"><BrushMark label="1v5 clutch" lines={[{ text: '1V5', size: 200, width: 360 }, { text: 'CLUTCH', size: 150, width: 460, className: 'clutch-title__sub' }]} /></div>} />
    {who && <div className="ace-person">
      <div className="ace-person__portrait"><Avatar player={who.player} roster={who.roster} /></div>
      <div className="ace-person__info"><span className="ace-person__kicker">Five of them. One player.</span><strong>{who.player.nick}</strong>
        <span className="ace-person__team"><TeamBadge roster={who.roster} size={20} />{who.roster.org} · {who.roster.year}</span>
        {map && <span className="ace-person__round">{map}{round != null ? ` · Round ${round}` : ''}</span>}
      </div>
      <span className="ace-person__kills" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <i key={i} />)}</span>
    </div>}
    <div className="clutch-fade" />
  </div>;
}
