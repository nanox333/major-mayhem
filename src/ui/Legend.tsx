import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as G from '../game/logic';
import { Avatar, TeamBadge } from './art';
import { play } from './sound';
import { reduceMotion } from './util';
import { Stage, can3D } from './legend3d/Stage';
import hole from '../assets/legend/hole.webp';
import blast from '../assets/legend/blast.webp';
import flash2 from '../assets/legend/flash-2.webp';
import smoke1 from '../assets/legend/smoke-1.webp';
import casing from '../assets/legend/casing.webp';
import spark from '../assets/legend/spark.webp';
import slash1 from '../assets/legend/slash-1.webp';
import slash2 from '../assets/legend/slash-2.webp';
import bomb from '../assets/legend/bomb.webp';
import awp from '../assets/legend/awp.webp';
import foe from '../assets/legend/foe.webp';

// Art for the scenes. The bullet hole, the blast, the C4 bomb and the AWP were made with ChatGPT's image generation and cut out here (scripts/legend-assets/PROMPTS.md);
// the muzzle flash, smoke, casing, spark, slashes and enemy are drawn in code (scripts/legend-assets/generate.html).
const HOLES = [hole, hole, hole];
const FLASHES = [blast, flash2];
const SLASHES = [slash1, slash2];

type Info = { title: string; tag: string; how: string };
/** What each legendary moment is called on screen, the line under it, and how it happens (for the collection). */
export const LEGEND_INFO: Record<G.LegendKind, Info> = {
  ace: { title: 'Ace', tag: 'Five kills. One player.', how: 'One of your players takes all five kills in a round.' },
  clutch5: { title: '1v5 clutch', tag: 'Five of them. One player.', how: 'The last player alive wins the round against five.' },
  ninja: { title: 'Ninja defuse', tag: 'A tenth of a second to spare.', how: 'A 1v3 won by defusing with the clock almost out.' },
  noscope: { title: 'No-scope', tag: 'Never looked through the scope.', how: 'Your AWPer lands a no-scope collateral.' },
  knife: { title: 'Knife kill', tag: 'Not a bullet left to spare.', how: 'The last player standing is knifed to win the round.' },
  flawless: { title: 'Flawless victory', tag: '13–0. Not one round dropped.', how: 'A map won 13–0 against a side that was not far weaker.' },
  miracle: { title: 'Miracle comeback', tag: 'Down by eight or more, and still won.', how: 'A map won after trailing by eight or more rounds.' },
  marathon: { title: 'Marathon', tag: 'More than one overtime.', how: 'A map won after at least a second overtime.' },
};
export const LEGEND_TITLE = LEGEND_INFO;

/** How long the cinematic holds before it hands the match back: quick, because there is a match waiting. A still card holds as long. */
export const LEGEND_MS = 2000;
/** The defuse takes its time: the count-down has to be read. Every other moment holds LEGEND_MS. */
export const legendMs = (kind: G.LegendKind) => (kind === 'ninja' ? 3600 : kind === 'noscope' && can3D(kind) ? 3500 : LEGEND_MS);
/** The way out: the card drops away, the scene scales off and the screen clears, instead of cutting. */
export const LEGEND_EXIT_MS = 440;

/** A number that runs from `from` to `to` over `ms` after `delay` (all at once when motion is reduced). */
function useCount(from: number, to: number, ms: number, delay: number, still: boolean, digits = 0) {
  const [v, setV] = useState(still ? to : from);
  useEffect(() => {
    if (still) return;
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / ms));
      setV(from + (to - from) * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return digits ? v.toFixed(digits) : String(Math.round(v));
}

/** Where the five shots of an ace land (percent of the screen), which art each uses, and how it is turned and scaled. */
const SHOTS = [{ x: 24, y: 30, h: 0, f: 0, r: -12, s: 1 }, { x: 72, y: 24, h: 1, f: 1, r: 20, s: 1.1 }, { x: 47, y: 52, h: 2, f: 0, r: 70, s: .95 }, { x: 80, y: 62, h: 0, f: 1, r: -40, s: 1.15 }, { x: 30, y: 70, h: 1, f: 0, r: 8, s: 1 }];
const SHOT_GAP = 0.17;
/** The bomb display counts from this to this (seconds) while it is defused. */
const LEFT_AT = 0.07;
const ROUNDS_UP = (e: G.MatchEvent) => Number(/after (\d+) rounds/.exec(e.text)?.[1] ?? 36);
const BEHIND = (e: G.MatchEvent) => Number(/(\d+) rounds down/.exec(e.text)?.[1] ?? 9);

/** The part of the cinematic that is different for each moment. Decorative; the card under it says what happened. */
function Scene({ e, still }: { e: G.MatchEvent; still: boolean }) {
  const kind = e.legend ?? 'ace';
  const timer = useCount(0.6, LEFT_AT, 1700, 200, still, 2);
  const won = useCount(0, 13, 700, 150, still);
  const rounds = useCount(24, ROUNDS_UP(e), 1100, 100, still);
  const down = BEHIND(e);
  const lead = useCount(-down, 1, 1000, 150, still);
  switch (kind) {
    case 'ace':
      return (
        <div className="lg lg-ace" aria-hidden="true">
          {SHOTS.map((p, i) => (
            <div key={i} className="lg-shot" style={{ left: `${p.x}%`, top: `${p.y}%`, ['--d' as string]: `${i * SHOT_GAP}s`, ['--r' as string]: `${p.r}deg`, ['--k' as string]: p.s }}>
              <img className="lg-smoke" src={smoke1} alt="" />
              <img className="lg-hole" src={HOLES[p.h]} alt="" />
              <img className="lg-muzzle" src={FLASHES[p.f]} alt="" />
              <img className="lg-casing" src={casing} alt="" />
              <img className="lg-spark lg-spark--a" src={spark} alt="" /><img className="lg-spark lg-spark--b" src={spark} alt="" />
            </div>
          ))}
          <div className="lg-count">{[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ animationDelay: `${(n - 1) * SHOT_GAP}s` }}>{n}</span>)}</div>
          <span className="lg-cross" />
        </div>
      );
    case 'clutch5':
      return (
        <div className="lg lg-clutch" aria-hidden="true">
          <span className="lg-vignette" />
          <div className="lg-pips">
            <i className="lg-one" />
            <span>{[0, 1, 2, 3, 4].map((n) => <em key={n} style={{ animationDelay: `${0.25 + n * 0.17}s`, ['--d' as string]: `${0.25 + n * 0.17}s` }}><img className="lg-muzzle lg-muzzle--pip" src={FLASHES[n % 2]} alt="" /></em>)}</span>
          </div>
        </div>
      );
    case 'ninja':
      // A 1v3 with the bomb about to go off: three enemies, the C4 counting down on its display, a defuse bar filling, then it is defused.
      return (
        <div className="lg lg-ninja" aria-hidden="true">
          <div className="lg-ninja__foes"><span>{[0, 1, 2].map((n) => <img key={n} src={foe} alt="" />)}</span><b>1v3</b></div>
          <div className="lg-bomb">
            <img className="lg-bomb__pic" src={bomb} alt="" />
            <b className="lg-bomb__lcd">0:00.{timer.slice(2)}</b>
            <i className="lg-bomb__led" />
            <span className="lg-bomb__bar"><u /></span>
            <small className="lg-bomb__say">Defusing</small>
            <em className="lg-stamp">Defused</em>
            <span className="lg-bomb__spare">{LEFT_AT.toFixed(2)}s to spare</span>
          </div>
        </div>
      );
    case 'noscope':
      // An AWP fired without looking through the scope: a crossed-out scope sign, the rifle slides in, one shot goes across the screen and hits.
      return (
        <div className="lg lg-nos" aria-hidden="true">
          <div className="lg-nos__gun">
            <img className="lg-nos__awp" src={awp} alt="" />
            <span className="lg-nos__sign" />
            <img className="lg-muzzle lg-nos__flash" src={blast} alt="" />
            <img className="lg-casing lg-nos__casing" src={casing} alt="" />
            <span className="lg-nos__tracer" />
            <div className="lg-shot lg-nos__impact" style={{ ['--d' as string]: '0.8s', ['--r' as string]: '14deg', ['--k' as string]: 1.15 }}>
              <img className="lg-hole" src={hole} alt="" />
              <img className="lg-muzzle" src={blast} alt="" />
              <img className="lg-spark lg-spark--a" src={spark} alt="" /><img className="lg-spark lg-spark--b" src={spark} alt="" />
            </div>
          </div>
        </div>
      );
    case 'knife':
      return (
        <div className="lg lg-knife" aria-hidden="true">
          <img className="lg-slash lg-slash--a" src={SLASHES[0]} alt="" /><img className="lg-slash lg-slash--b" src={SLASHES[1]} alt="" /><img className="lg-slash lg-slash--c" src={SLASHES[0]} alt="" />
          <img className="lg-spark lg-spark--k1" src={spark} alt="" /><img className="lg-spark lg-spark--k2" src={spark} alt="" /><img className="lg-spark lg-spark--k3" src={spark} alt="" />
        </div>
      );
    case 'flawless':
      return (
        <div className="lg lg-flawless" aria-hidden="true">
          <div className="lg-score"><b>{won}</b><i>–</i><b>0</b></div>
          <div className="lg-ticks">{Array.from({ length: 13 }, (_, n) => <u key={n} style={{ animationDelay: `${0.1 + n * 0.045}s` }} />)}</div>
          <span className="lg-shine" />
        </div>
      );
    case 'miracle':
      return (
        <div className="lg lg-miracle" aria-hidden="true">
          <svg viewBox="0 0 240 120" preserveAspectRatio="none"><path className="lg-zero" d="M0 60H240" /><path className="lg-line" d="M0 112 L26 118 L50 104 L72 112 L100 88 L124 96 L150 64 L176 44 L204 24 L240 6" /></svg>
          <b className="lg-lead">{Number(lead) > 0 ? '+' : ''}{lead}</b>
        </div>
      );
    case 'marathon':
      return (
        <div className="lg lg-marathon" aria-hidden="true">
          <span className="lg-dial" />
          <b className="lg-rounds">{rounds}</b>
          <div className="lg-ots">{['OT 1', 'OT 2', 'OT 3'].map((t, i) => <i key={t} style={{ animationDelay: `${0.25 + i * 0.35}s` }}>{t}</i>)}</div>
        </div>
      );
  }
}

/** The sounds that go with each scene, scheduled once: shots for an ace, a heartbeat for a clutch, beeps for the bomb. */
function scoreFor(kind: G.LegendKind) {
  const at = (name: Parameters<typeof play>[0], ms: number[]) => ms.map((m) => play(name, { delay: m }));
  switch (kind) {
    case 'ace': return at('shot', [0, 170, 340, 510, 680]);
    case 'clutch5': return [...at('beat', [0, 420, 840]), ...at('shot', [250, 420, 590, 760, 930])];
    case 'ninja': return [...at('tick', Array.from({ length: 9 }, (_, i) => 250 + i * 190)), ...at('shot', [1950])];
    case 'noscope': return can3D(kind) ? [...at('shot', [0]), ...at('tick', [1230, 2300])] : at('shot', [570, 820]);
    case 'knife': return at('shot', [60, 200, 340]);
    case 'flawless': return at('tick', Array.from({ length: 13 }, (_, i) => 100 + i * 45));
    case 'miracle': return at('tick', [100, 300, 500, 700, 900]);
    case 'marathon': return at('beat', [250, 600, 950]);
  }
}

/**
 * A legendary moment (#292, #293): the match pauses for a short scene that is different for each kind (gunshots for an ace, a closing vignette
 * for a clutch, a bomb timer for a ninja defuse, a scope for a no-scope, slashes for a knife kill, a scoreboard for a flawless map, a rising
 * line for a comeback, a dial for a marathon), then the card. It never changes a result. Any key, a tap or the button ends it early. Reduced
 * motion gets the card alone.
 */
export function LegendOverlay({ e, mine, map, onDone }: { e: G.MatchEvent; mine: G.Lineup[]; map: string; onDone: () => void }) {
  const kind = e.legend ?? 'ace';
  const who = mine.find((l) => l.player.id === e.playerId);
  const still = reduceMotion();
  const sparks = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ x: (i * 47) % 100, d: ((i * 13) % 9) / 14, s: 4 + (i % 4) * 2, t: 1.4 + ((i * 7) % 8) / 10 })), []);
  const [leaving, setLeaving] = useState(false);
  const closing = useRef(false);
  // however it ends (the time is up, a key, a tap) it plays the way out first, unless motion is reduced
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (still) return onDone();
    setLeaving(true);
    setTimeout(onDone, LEGEND_EXIT_MS);
  }, []);
  useEffect(() => {
    const done = setTimeout(close, legendMs(kind));
    const key = (ev: KeyboardEvent) => { ev.preventDefault(); ev.stopPropagation(); close(); };
    window.addEventListener('keydown', key, true);
    const stops = still ? [] : scoreFor(kind);
    return () => { clearTimeout(done); window.removeEventListener('keydown', key, true); stops.forEach((st) => st()); };
  }, []);
  return (
    <div className={`legend legend--${kind} ${still ? 'is-still' : ''} ${leaving ? 'is-leaving' : ''}`} role="status" aria-live="assertive" aria-label={`Legendary moment: ${LEGEND_INFO[kind].title}. ${e.text}`} onClick={close}>
      <div className="legend__wash" aria-hidden="true" />
      {!still && (can3D(kind) ? <Stage kind={kind} /> : <Scene e={e} still={still} />)}
      <div className="legend__sparks" aria-hidden="true">{sparks.map((p, i) => <i key={i} style={{ left: `${p.x}%`, width: p.s, height: p.s, animationDelay: `${p.d + 0.5}s`, animationDuration: `${p.t}s` }} />)}</div>
      <div className="legend__sweep" aria-hidden="true" />
      <div className="legend__card">
        <p className="legend__kicker"><b>Legendary moment</b><span>{map} · Round {e.round}</span></p>
        <div className="legend__body">
          <span className="legend__pic" aria-hidden="true">{who ? <Avatar player={who.player} roster={who.roster} /> : <span className="legend__crest">★</span>}</span>
          <div className="legend__says">
            <strong className="legend__title">{LEGEND_INFO[kind].title}</strong>
            <span className="legend__tag">{LEGEND_INFO[kind].tag}</span>
            {who && <span className="legend__who"><TeamBadge roster={who.roster} size={22} /><b>{who.player.nick}</b><i>{who.roster.org} {who.roster.year}</i></span>}
          </div>
        </div>
        <span className="legend__bar" aria-hidden="true"><i style={{ animationDuration: `${legendMs(kind)}ms` }} /></span>
      </div>
      <button type="button" className="legend__skip" onClick={(ev) => { ev.stopPropagation(); close(); }}>Continue</button>
    </div>
  );
}
