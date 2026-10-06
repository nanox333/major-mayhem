import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../../styles/knife.css';
import { play } from '../sound';
import type { Lineup } from '../../game/logic';
import { Avatar, TeamBadge } from '../art';
import { BrushMark } from '../BrushMark';
import { Title3D } from '../endcard/Title3D';
import { legendHold } from '../legend3d/hold';
import { BRACKETS, RETICLE } from './shapes';
import { DEBRIS, KNIFE, SCRATCHES, SLASHA, SLASHB, SOLDIER, SPLAT1, SPLAT2, SPLAT3, type Traced } from './traced';
import { KNIFE_DURATION, knifeCues, knifeLayout, knifeTime } from './timeline';

export const knifeDiagnostics = { loops: 0, listeners: 0 };
if (typeof location !== 'undefined' && location.search.includes('debug')) Object.assign(window, { __mmKnife: knifeDiagnostics });

const ORANGE = '#f37a30', HOT = '#ff5a1a', BONE = '#f1e7da';
/** Slash axes: the first runs top-left to bottom-right, the second bottom-left to top-right, as in the mockup. */
const SLASH_A = { angle: 24, x: 800, y: 440 }, SLASH_B = { angle: -27, x: 800, y: 460 };
/** The title starts slamming in when the word KNIFE lands in the knife kill's own timeline. */
const KNIFE_TITLE_AT = knifeCues().knifeWord;
const KNIFE_FROM = { x: -420, y: 330 }, KNIFE_TO = { x: 660, y: 400 };
const seeded = (i: number, k: number) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
/** Place a traced asset: centred on (0,0), turned and scaled. */
const place = (a: Traced, sx: number, sy = sx, rot = 0) => `scale(${sx} ${sy}) rotate(${rot}) translate(${-a.cx} ${-a.cy})`;

/**
 * The KNIFE KILL highlight: a 2D motion-graphics sequence in SVG. The slashes, the knife, the soldier, the splatters and the debris are vector
 * traces of a generated art sheet, moved with transforms and clips; the title and the player line are SVG text. One `knifeTime` clock drives all
 * of it, so the scrubber can show any frame. Particles are a fixed pool that is reused every frame, and the loop and its listeners are released
 * when the highlight ends or unmounts.
 */
export function KnifeKillHighlight({ onComplete, at, still = false, who, map, round }: { onComplete?: () => void; at?: number | null; still?: boolean; who?: Lineup; map?: string; round?: number }) {
  const root = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null);
  const done = useRef(onComplete); done.current = onComplete;
  const time = useRef(at); time.current = at;
  const redraw = useRef<(() => void) | null>(null);
  const layout = useMemo(() => knifeLayout(typeof innerWidth === 'number' ? innerWidth : 1280, typeof innerHeight === 'number' ? innerHeight : 720), []);
  /** The heavy stack (edge roughening and bloom) is for desktops; phones get the cheap overlays only. */
  const [lite, setLite] = useState(false);
  const full = !layout.mobile && !still && !lite;
  useEffect(() => {
    const el = root.current, sv = svg.current; if (!el || !sv) return;
    let dead = false, finished = false, raf = 0, loop = false, t0 = performance.now(), observer: ResizeObserver | undefined, grainStep = -1;
    const grain = document.createElement('canvas'); grain.width = grain.height = 128;
    const gctx = grain.getContext('2d');
    if (gctx) { const px = gctx.createImageData(128, 128); let r = 91; for (let i = 0; i < px.data.length; i += 4) { r = (r * 1664525 + 1013904223) >>> 0; const v = r >>> 24; px.data[i] = px.data[i + 1] = px.data[i + 2] = v; px.data[i + 3] = 110; } gctx.putImageData(px, 0, 0); el.style.setProperty('--knife-grain', `url(${grain.toDataURL()})`); }
    const played = new Set<string>(), cues = knifeCues(), stops: (() => void)[] = [];
    const n: Record<string, SVGElement> = {};
    sv.querySelectorAll<SVGElement>('[data-k]').forEach((x) => { n[x.dataset.k!] = x; });
    const debris = Array.from(sv.querySelectorAll<SVGElement>('[data-d]')), embers = Array.from(sv.querySelectorAll<SVGElement>('[data-e]'));
    const op = (k: string, v: number) => n[k]?.setAttribute('opacity', v.toFixed(3));
    const tf = (k: string, v: string) => n[k]?.setAttribute('transform', v);
    const clipTo = (k: string, u: number) => n[k].setAttribute('width', String(Math.max(0.01, 2400 * u)));
    const sounds = (t: number) => {
      if (time.current != null || still) return;
      const once = (id: string, when: number, fn: () => () => void) => { if (t >= when && !played.has(id)) { played.add(id); stops.push(fn()); } };
      once('a', cues.slashA, () => play('shot', { pitch: 1.5 })); once('b', cues.slashB, () => play('shot', { pitch: 1.25 }));
      once('k', cues.knife, () => play('tick', { pitch: 1.6 })); once('h', cues.hit, () => play('hit', { pitch: .8 }));
      once('w', cues.knifeWord, () => play('clutch', { pitch: .9 })); once('l', cues.killWord, () => play('accept', { pitch: 1.1 }));
    };
    const draw = (t: number) => {
      if (dead) return;
      const s = knifeTime(t); el.dataset.time = t.toFixed(4);
      el.style.setProperty('--knife-dim', String(s.dim)); el.style.setProperty('--knife-slam', s.slam.toFixed(3)); el.style.setProperty('--knife-bleed', s.bleed.toFixed(3));
      el.style.setProperty('--knife-split', layout.mobile ? '0px' : `${s.split.toFixed(1)}px`);
      tf('shake', `translate(${s.shakeX.toFixed(2)} ${s.shakeY.toFixed(2)})`);
      op('hud', s.hud); op('dust', s.hud); op('hold', s.hold * s.fade); op('scratch', s.hud * .5 * s.fade);
      // slashes: a clip sweeps along each axis, then they stay (quieter) under the title
      clipTo('clipA', s.slashA); clipTo('clipB', s.slashB);
      op('slashA', s.slashA > 0 ? s.slashHold * s.fade : 0); op('slashB', s.slashB > 0 ? s.slashHold * s.fade : 0);
      // the burst where they cross: a white-hot flash and a splat that pops, then settles
      const b = s.burst, bu = Math.max(0, b);
      op('flash', b >= 0 ? Math.max(0, 1 - b / .12) * s.fade : 0); tf('flash', `translate(800 450) scale(${(1 + b * 14).toFixed(2)})`);
      op('burst', b >= 0 ? (.95 - .3 * Math.min(1, bu / .5)) * s.slashHold * s.fade : 0); tf('burst', `translate(800 452) scale(${(.3 + .7 * (1 - (1 - Math.min(1, bu / .09)) ** 3)).toFixed(3)}) rotate(${(bu * 30).toFixed(1)})`);
      // the knife: a fast sweep with a short trail, then it sits in the target while it fades
      const ku = 1 - (1 - s.knife) ** 3;
      for (let i = 0; i < 4; i++) {
        const lag = Math.max(0, ku - i * .07), x = KNIFE_FROM.x + (KNIFE_TO.x - KNIFE_FROM.x) * lag, y = KNIFE_FROM.y + (KNIFE_TO.y - KNIFE_FROM.y) * lag;
        tf(`knife${i}`, `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(8)`);
        op(`knife${i}`, i === 0 ? s.knifeShown * s.fade : s.knifeShown * s.fade * (s.knife < 1 ? .32 / (i + .6) : 0));
      }
      op('target', s.helmet * s.fade);
      const hu = 1 - (1 - Math.min(1, s.splat * 1.6)) ** 3;
      op('hit', s.splat > 0 || s.knife >= 1 ? (1 - .3 * s.splat) * s.slashHold * s.fade : 0); tf('hit', `translate(1010 420) scale(${(.2 + .8 * hu).toFixed(3)}) rotate(${(-8 + 8 * hu).toFixed(1)})`);
      // debris: a fixed pool thrown out of the cut with drag, settling
      const ag = s.debris, k = 5;
      for (let i = 0; i < debris.length; i++) {
        const ang = seeded(i, 1) * Math.PI * 2, sp = 280 + seeded(i, 2) * 620, travel = (1 - Math.exp(-k * ag)) / k * sp, sz = .5 + seeded(i, 3) * .7, spin = (seeded(i, 4) - .5) * 900 * ag;
        const ox = i % 2 ? 1010 : 800, oy = i % 2 ? 420 : 452;
        debris[i].setAttribute('transform', `translate(${(ox + Math.cos(ang) * travel).toFixed(1)} ${(oy + Math.sin(ang) * travel + 90 * ag * ag).toFixed(1)}) rotate(${spin.toFixed(0)}) scale(${sz.toFixed(2)})`);
        debris[i].setAttribute('opacity', (ag > 0 ? (1 - Math.min(1, ag / .8) ** 2) * s.fade : 0).toFixed(3));
      }
      // titles (HTML, in the ACE highlight's style): each word comes in large and blurred and settles, then the player plate slides in
      const kn = 1 - (1 - s.knifeWord) ** 3, kl = 1 - (1 - s.killWord) ** 3;
      el.style.setProperty('--knife-a', kn.toFixed(3)); el.style.setProperty('--knife-b', kl.toFixed(3)); el.style.setProperty('--knife-snap', (1.12 - .12 * kn).toFixed(3)); el.style.setProperty('--knife-fade', String(s.fade));
      el.style.setProperty('--endcard-age', (s.real - KNIFE_TITLE_AT).toFixed(3));
      el.style.setProperty('--ace-person', s.person.toFixed(3)); el.style.setProperty('--ace-person-y', `${((1 - s.person) * 18).toFixed(1)}px`);
      op('titleSplat', s.knifeWord > 0 ? Math.min(1, s.knifeWord * 3) * s.fade : 0); tf('titleSplat', `translate(790 330) scale(${(.4 + .6 * kn).toFixed(3)}) rotate(-8)`);
      op('killSplat', s.killWord > 0 ? Math.min(1, s.killWord * 3) * s.fade : 0); tf('killSplat', `translate(900 480) scale(${(.4 + .6 * kl).toFixed(3)}) rotate(14)`);
      // hold: embers drift up, a scan line runs, the grain steps at 12 fps
      for (let i = 0; i < embers.length; i++) {
        const sp = 18 + seeded(i, 5) * 40, x = 120 + seeded(i, 6) * 1360 + Math.sin(s.real * 2 + i) * 14, y = 880 - ((seeded(i, 7) * 900 + s.real * sp * 2) % 900);
        embers[i].setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`); embers[i].setAttribute('opacity', (s.hold * (.3 + .7 * seeded(i, 8)) * s.fade).toFixed(3));
      }
      tf('scan', `translate(0 ${(70 + (s.real * 260) % 760).toFixed(0)})`);
      const g = Math.floor(t * 12); if (g !== grainStep) { grainStep = g; n.grain.setAttribute('patternTransform', `translate(${(seeded(g, 1) * 180).toFixed(0)} ${(seeded(g, 2) * 180).toFixed(0)})`); }
      // the grain jumps at 12 fps
      const gstep = Math.floor(t * 12);
      el.style.setProperty('--knife-gx', `${(seeded(gstep, 3) * 128).toFixed(0)}px`); el.style.setProperty('--knife-gy', `${(seeded(gstep, 4) * 128).toFixed(0)}px`);
      sounds(t);
    };
    let frames = 0, seen = 0, probe = 0, prev = 0;
    const tick = (now: number) => {
      if (dead) return;
      // a slow machine drops the heavy filter stack after a short look at the frame rate (the first frames pay for setup and are ignored)
      if (++frames > 8 && frames <= 48) { probe += now - prev; seen++; if (seen === 40 && probe / seen > 26) setLite(true); }
      prev = now;
      if (legendHold.on) t0 = now;
      const t = Math.min((now - t0) / 1000, KNIFE_DURATION);
      draw(t);
      if (t >= KNIFE_DURATION) { stop(); if (!finished) { finished = true; done.current?.(); } } else raf = requestAnimationFrame(tick);
    };
    const stop = () => { cancelAnimationFrame(raf); if (loop) { loop = false; knifeDiagnostics.loops--; } };
    redraw.current = () => draw(time.current ?? 0);
    observer = new ResizeObserver(() => redraw.current?.()); observer.observe(el); knifeDiagnostics.listeners++;
    if (still) { draw(4.0); const wait = setTimeout(() => { if (!finished) { finished = true; done.current?.(); } }, 2200); stops.push(() => clearTimeout(wait)); }
    else if (time.current != null) draw(time.current);
    else { loop = true; knifeDiagnostics.loops++; raf = requestAnimationFrame(tick); }
    return () => { dead = true; stop(); redraw.current = null; observer?.disconnect(); knifeDiagnostics.listeners--; stops.forEach((fn) => fn()); };
  }, [still]);
  useEffect(() => { redraw.current?.(); }, [at]);
  const scatter = (count: number, seed: number) => Array.from({ length: count }, (_, i) => ({ x: seeded(i, seed) * 2200 - 1100, y: (seeded(i, seed + 1) - .5) * 70, r: 1 + seeded(i, seed + 2) * 2.4 }));
  const dotsA = useMemo(() => scatter(90, 30), []), dotsB = useMemo(() => scatter(90, 40), []);
  const grainDots = useMemo(() => Array.from({ length: 110 }, (_, i) => <rect key={i} x={seeded(i, 60) * 180} y={seeded(i, 61) * 180} width={1 + seeded(i, 62) * 2} height={1 + seeded(i, 63) * 2} fill="#fff" opacity={.2 + seeded(i, 64) * .5} />), []);
  const gridDots = useMemo(() => Array.from({ length: 70 }, (_, i) => <circle key={i} cx={110 + (i % 14) * 14} cy={100 + Math.floor(i / 14) * 14} r="1.5" fill={ORANGE} opacity=".55" />), []);
  // slashes are traced pointing up-right: un-tilt them to run along +x, stretch to cross the screen, thin them
  const slashes = [
    { k: 'slashA', ...SLASH_A, clip: 'A', art: SLASHA, tilt: 19.4, dots: dotsA }, { k: 'slashB', ...SLASH_B, clip: 'B', art: SLASHB, tilt: 18.3, dots: dotsB },
  ];
  return (
    <div ref={root} className="knife-highlight" data-highlight="knife" aria-hidden="true">
      <div className="knife-dim" />
      <svg ref={svg} className="knife-svg" viewBox={layout.mobile ? '330 0 940 900' : '0 0 1600 900'} preserveAspectRatio="xMidYMid meet">
        <defs>
          <clipPath id="knife-clipA"><rect data-k="clipA" x="-1200" y="-400" width="0.01" height="800" /></clipPath>
          <clipPath id="knife-clipB"><rect data-k="clipB" x="-1200" y="-400" width="0.01" height="800" /></clipPath>
          <linearGradient id="knife-orange" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffa040" /><stop offset=".5" stopColor={HOT} /><stop offset="1" stopColor="#c8300c" /></linearGradient>
          <linearGradient id="knife-bone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffaf0" /><stop offset="1" stopColor="#cfc3b4" /></linearGradient>
          <pattern data-k="grain" id="knife-grain" width="180" height="180" patternUnits="userSpaceOnUse">{grainDots}</pattern>
          <g id="knife-content">
<g data-k="shake">
          <g data-k="hud" opacity="0" fill="none" stroke={ORANGE}>
            <path d={BRACKETS} strokeWidth="3" /><path d="M70,150 V750 M1530,150 V750 M160,60 H1440 M160,840 H1440" strokeWidth="1" opacity=".35" />
            <path d={RETICLE} strokeWidth="2" opacity=".8" /><path d="M100,420 h20 m-10,-10 v20 M1480,420 h20 m-10,-10 v20 M780,70 h40 M780,830 h40" strokeWidth="2" opacity=".7" />
            <g stroke="none">{gridDots}</g>
          </g>
          <g data-k="dust" opacity="0" fill="#c8481a">{Array.from({ length: 26 }, (_, i) => { const p = DEBRIS[i % DEBRIS.length]; return <path key={i} d={p.d} opacity={.12 + seeded(i, 70) * .2} transform={`translate(${(seeded(i, 71) * 1500 + 50).toFixed(0)} ${(seeded(i, 72) * 800 + 50).toFixed(0)}) rotate(${(seeded(i, 73) * 360).toFixed(0)}) ${place(p, .25 + seeded(i, 74) * .4)}`} />; })}</g>
          <g data-k="scratch" opacity="0" fill={ORANGE}>
            <path d={SCRATCHES.d} transform={`translate(1230 760) ${place(SCRATCHES, 2.1)}`} opacity=".22" /><path d={SCRATCHES.d} transform={`translate(330 180) ${place(SCRATCHES, 1.9, 1.9, 180)}`} opacity=".18" /><path d={SCRATCHES.d} transform={`translate(800 470) ${place(SCRATCHES, 3.2, 2.2, 35)}`} opacity=".07" />
          </g>
          <g data-k="target" opacity="0" transform="translate(1050 530)">
            <path d={SOLDIER.d} transform={place(SOLDIER, 1.5)} fill="none" stroke={HOT} strokeWidth="12" strokeOpacity=".25" strokeLinejoin="round" />
            <path d={SOLDIER.d} transform={place(SOLDIER, 1.5)} fill="#120b08" stroke="#ff8a3a" strokeWidth="3.5" strokeLinejoin="round" />
          </g>
          {/* the two slashes: each is drawn along a horizontal axis, clipped by a sweeping rectangle, then rotated into place */}
          {slashes.map((sl) => (
            <g key={sl.k} data-k={sl.k} opacity="0" transform={`translate(${sl.x} ${sl.y}) rotate(${sl.angle})`}>
              <g clipPath={`url(#knife-clip${sl.clip})`}>
                <path d={sl.art.d} transform={place(sl.art, 3.1, .85, sl.tilt)} fill="none" stroke={HOT} strokeWidth="14" strokeOpacity=".3" strokeLinejoin="round" />
                <path d={sl.art.d} transform={place(sl.art, 3.1, .85, sl.tilt)} fill="url(#knife-orange)" />
                <path d={sl.art.d} transform={place(sl.art, 3.1, .3, sl.tilt)} fill="#fff1d6" opacity=".95" />
                {sl.dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={i % 3 ? ORANGE : '#ffd9a0'} />)}
              </g>
            </g>
          ))}
          <g data-k="burst" opacity="0" transform="translate(800 452)"><path d={SPLAT1.d} transform={place(SPLAT1, 1.35)} fill="url(#knife-orange)" /></g>
          <circle data-k="flash" opacity="0" transform="translate(800 450)" r="60" fill="#fff4dc" />
          <g data-k="hit" opacity="0" transform="translate(1010 420)"><path d={SPLAT2.d} transform={place(SPLAT2, 1.35)} fill="#e0341a" /></g>
          {[3, 2, 1, 0].map((i) => (
            <g key={i} data-k={`knife${i}`} opacity="0" transform="translate(-420 330) rotate(8)">
              <path d={KNIFE.d} transform={place(KNIFE, 1.1)} fill="#0a0605" stroke={HOT} strokeWidth="10" strokeOpacity=".3" strokeLinejoin="round" />
              <path d={KNIFE.d} transform={place(KNIFE, 1.1)} fill="#0a0605" stroke="#ff9a3a" strokeWidth="3" strokeLinejoin="round" />
            </g>
          ))}
          <g data-k="titleSplat" opacity="0" transform="translate(790 330)"><path d={SPLAT3.d} transform={place(SPLAT3, 2.5)} fill="#7a1d0c" opacity=".7" /></g>
          <g data-k="killSplat" opacity="0" transform="translate(900 480)"><path d={SPLAT1.d} transform={place(SPLAT1, 2.1)} fill="#6a160a" opacity=".7" /></g>
          {Array.from({ length: layout.debris }, (_, i) => { const p = DEBRIS[i % DEBRIS.length]; return <path key={i} data-d={i} opacity="0" d={p.d} transform={place(p, .6)} fill={i % 4 ? HOT : '#ffd9a0'} />; })}
          <g data-k="hold" opacity="0">
            {Array.from({ length: layout.particles }, (_, i) => <circle key={i} data-e={i} r={1.3 + seeded(i, 9) * 2.2} fill={i % 3 ? ORANGE : '#ffd9a0'} opacity="0" />)}
            <rect data-k="scan" x="70" y="0" width="1460" height="2" fill={ORANGE} opacity=".35" />
          </g>
        </g>
          </g>
          <filter id="knife-post" x="-4%" y="-4%" width="108%" height="108%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency=".85 .85" numOctaves="2" seed="7" result="grit" />
            <feDisplacementMap in="SourceGraphic" in2="grit" scale="4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="knife-bloom" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="16" /><feColorMatrix type="matrix" values="1.7 0 0 0 0  0 1.1 0 0 0  0 0 .8 0 0  0 0 0 1.4 0" />
          </filter>
        </defs>
        {full ? <>
          <g filter="url(#knife-post)"><use href="#knife-content" /></g>
          <use href="#knife-content" filter="url(#knife-bloom)" opacity=".5" style={{ mixBlendMode: 'screen' }} />
        </> : <use href="#knife-content" />}
        <rect x="-300" y="-200" width="2200" height="1300" fill="url(#knife-grain)" opacity=".22" style={{ mixBlendMode: 'screen' }} />
      </svg>
      <div className="knife-vig" /><div className="knife-scan" /><div className="knife-grit" /><div className="knife-slam" />
      <Title3D name="knife" fallback={<div className="knife-title"><BrushMark label="Knife kill" lines={[{ text: 'KNIFE', size: 190, width: 480 }, { text: 'KILL', size: 170, width: 330, className: 'knife-title__sub' }]} /></div>} />
      {who && <div className="ace-person">
        <div className="ace-person__portrait"><Avatar player={who.player} roster={who.roster} /></div>
        <div className="ace-person__info"><span className="ace-person__kicker">Not a bullet left to spare.</span><strong>{who.player.nick}</strong>
          <span className="ace-person__team"><TeamBadge roster={who.roster} size={20} />{who.roster.org} · {who.roster.year}</span>
          {map && <span className="ace-person__round">{map}{round != null ? ` · Round ${round}` : ''}</span>}
        </div>
        <span className="ace-person__kills" aria-hidden="true"><i /><i /></span>
      </div>}
    </div>
  );
}
