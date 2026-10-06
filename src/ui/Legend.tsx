import { NoscopeCard } from './legend3d/NoscopeCard';
import { legendHold } from './legend3d/hold';
import { FULL_PAGE_LEGENDS } from './legend3d/kinds';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as G from '../game/logic';
import { Avatar, TeamBadge } from './art';
import { play } from './sound';
import { reduceMotion } from './util';
import { Stage, hasCinematic } from './legend3d/Stage';
import { smooth, noscopeTime, noscopeTitleAge, NOSCOPE_DURATION, NOSCOPE_HIT, NOSCOPE_SHOT } from './legend3d/timeline';
import { AceHighlight } from './ace/AceHighlight';
import { ACE_DURATION } from './ace/timeline';
import { NinjaDefuseHighlight } from './ninja/NinjaDefuseHighlight';
import { KnifeKillHighlight } from './knife/KnifeKillHighlight';
import { ClutchHighlight } from './clutch/ClutchHighlight';
import { CLUTCH_DURATION } from './clutch/timeline';
import { KNIFE_DURATION } from './knife/timeline';
import blast from '../assets/legend/blast.webp';
import flash2 from '../assets/legend/flash-2.webp';
import spark from '../assets/legend/spark.webp';
import slash1 from '../assets/legend/slash-1.webp';
import slash2 from '../assets/legend/slash-2.webp';
import bomb from '../assets/legend/bomb.webp';
import foe from '../assets/legend/foe.webp';

// Art for the scenes. The bullet hole, the blast, the C4 bomb and the AWP were made with ChatGPT's image generation and cut out here (scripts/legend-assets/PROMPTS.md);
// the muzzle flash, smoke, casing, spark, slashes and enemy are drawn in code (scripts/legend-assets/generate.html).
const FLASHES = [blast, flash2];
const SLASHES = [slash1, slash2];

type Info = { title: string; tag: string; how: string };
/** What each legendary moment is called on screen, the line under it, and how it happens (for the collection). */
export const LEGEND_INFO: Record<G.LegendKind, Info> = {
  ace: { title: 'Ace', tag: 'Five kills. One player.', how: 'One of your players takes all five kills in a round.' },
  clutch5: { title: '1v5 clutch', tag: 'Five of them. One player.', how: 'The last player alive wins the round against five.' },
  ninja: { title: 'Ninja defuse', tag: 'A tenth of a second to spare.', how: 'A 1v3 won by defusing with the clock almost out.' },
  noscope: { title: 'No-scope', tag: 'Never looked through the scope.', how: 'Your AWPer lands a long-range no-scope.' },
  knife: { title: 'Knife kill', tag: 'Not a bullet left to spare.', how: 'The last player standing is knifed to win the round.' },
  flawless: { title: 'Flawless victory', tag: '13–0. Not one round dropped.', how: 'A map won 13–0 against a side that was not far weaker.' },
  miracle: { title: 'Miracle comeback', tag: 'Down by eight or more, and still won.', how: 'A map won after trailing by eight or more rounds.' },
  marathon: { title: 'Marathon', tag: 'More than one overtime.', how: 'A map won after at least a second overtime.' },
};
export const LEGEND_TITLE = LEGEND_INFO;

/** How long the cinematic holds before it hands the match back: quick, because there is a match waiting. A still card holds as long. */
export const LEGEND_MS = 2000;
/** The defuse and rendered no-scope run longer; the other scenes hold for LEGEND_MS. */
export const legendMs = (kind: G.LegendKind) => (kind === 'ace' ? ACE_DURATION * 1000 : kind === 'ninja' ? 3600 : kind === 'knife' ? KNIFE_DURATION * 1000 : kind === 'clutch5' ? CLUTCH_DURATION * 1000 : kind === 'noscope' && hasCinematic(kind) ? NOSCOPE_DURATION * 1000 : LEGEND_MS);
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
    case 'ace': return null; // Dedicated transparent real-time overlay.
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
    case 'noscope': return null; // Real-time scene, or the static highlight if WebGL is unavailable.
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
    case 'ace': return []; // The ACE clock owns its audio cues.
    case 'clutch5': return [...at('beat', [0, 420, 840]), ...at('shot', [250, 420, 590, 760, 930])];
    case 'ninja': return [...at('tick', Array.from({ length: 9 }, (_, i) => 250 + i * 190)), ...at('shot', [1950])];
    case 'noscope': return [...at('shot', [NOSCOPE_SHOT * 1000]), ...at('clutch', [NOSCOPE_HIT * 1000])];
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
function LegendBody({ e, mine, map, onDone }: { e: G.MatchEvent; mine: G.Lineup[]; map: string; onDone: () => void }) {
  const kind = e.legend ?? 'ace';
  const who = mine.find((l) => l.player.id === e.playerId);
  const still = reduceMotion();
  const sparks = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ x: (i * 47) % 100, d: ((i * 13) % 9) / 14, s: 4 + (i % 4) * 2, t: 1.4 + ((i * 7) % 8) / 10 })), []);
  const [leaving, setLeaving] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [ready, setReady] = useState(still || !hasCinematic(kind));
  const mediaReady = useCallback(() => setReady(true), []);
  const mediaError = useCallback(() => { setMediaFailed(true); setReady(true); }, []);
  const reveal = useRef<HTMLDivElement>(null);
  const playedCues = useRef(new Set<number>());
  const mediaFrame = useCallback((t: number) => {
    if (closing.current) return;
    const state=noscopeTime(t);
    reveal.current?.style.setProperty('--reveal', String(state.reveal));
    reveal.current?.style.setProperty('--endcard-age', String(noscopeTitleAge(t)));
    reveal.current?.style.setProperty('--title-pop', String(state.titleScale));
    reveal.current?.parentElement?.style.setProperty('--noscope-fade',String(state.opacity));
    reveal.current?.style.setProperty('--dim', String(state.reveal * .45));
    for (const [when, sound] of [[NOSCOPE_SHOT, 'shot'], [NOSCOPE_HIT, 'clutch']] as const) {
      if (t >= when && !playedCues.current.has(when)) { playedCues.current.add(when); play(sound); }
    }
  }, []);
  const closing = useRef(false);
  // however it ends (the time is up, a key, a tap) it plays the way out first, unless motion is reduced
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (still || kind === 'noscope' || kind === 'ace' || kind === 'ninja' || kind === 'knife' || kind === 'clutch5') return onDone();
    setLeaving(true);
    setTimeout(onDone, LEGEND_EXIT_MS);
  }, []);
  useEffect(() => {
    const key = (ev: KeyboardEvent) => { ev.preventDefault(); ev.stopPropagation(); close(); };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, []);
  useEffect(() => {
    if (!ready || kind === 'ace' || kind === 'ninja' || kind === 'knife' || kind === 'clutch5') return;
    const done = setTimeout(close, still || mediaFailed ? LEGEND_MS : hasCinematic(kind) ? 9000 + LEGEND_LEAD_MS : legendMs(kind));
    const stops = still || mediaFailed || hasCinematic(kind) ? [] : scoreFor(kind);
    return () => { clearTimeout(done); stops.forEach((stop) => stop()); };
  }, [ready, mediaFailed]);
  if (kind === 'ninja') return (
    <div className="legend legend--ninja" role="status" aria-live="assertive" aria-label={`Legendary moment: Ninja defuse. ${e.text}`} onClick={close}>
      <NinjaDefuseHighlight onComplete={close} still={still} who={who} map={map} round={e.round} />
      <button type="button" className="legend__skip" onClick={(ev) => { ev.stopPropagation(); close(); }}>Continue</button>
    </div>
  );
  if (kind === 'knife') return (
    <div className="legend legend--knife" role="status" aria-live="assertive" aria-label={`Legendary moment: Knife kill. ${e.text}`} onClick={close}>
      <KnifeKillHighlight onComplete={close} still={still} who={who} map={map} round={e.round} />
      <button type="button" className="legend__skip" onClick={(ev) => { ev.stopPropagation(); close(); }}>Continue</button>
    </div>
  );
  if (kind === 'clutch5') return (
    <div className="legend legend--clutch5" role="status" aria-live="assertive" aria-label={`Legendary moment: 1v5 clutch. ${e.text}`} onClick={close}>
      <ClutchHighlight onComplete={close} still={still} who={who} map={map} round={e.round} />
      <button type="button" className="legend__skip" onClick={(ev) => { ev.stopPropagation(); close(); }}>Continue</button>
    </div>
  );
  if (kind === 'ace') return (
    <div className="legend legend--ace" role="status" aria-live="assertive" aria-label={`Legendary moment: Ace. ${e.text}`} onClick={close}>
      <AceHighlight onComplete={close} still={still} who={who} map={map} round={e.round} />
      <button type="button" className="legend__skip" onClick={(ev) => { ev.stopPropagation(); close(); }}>Continue</button>
    </div>
  );
  return (
    <div className={`legend legend--${kind} ${still || mediaFailed ? 'is-still' : ''} ${!ready && !leaving ? 'is-loading' : ''} ${leaving ? 'is-leaving' : ''}`} role="status" aria-live="assertive" aria-label={`Legendary moment: ${LEGEND_INFO[kind].title}. ${e.text}`} onClick={close}>
      <div className="legend__wash" aria-hidden="true" />
      {!still && !mediaFailed && (hasCinematic(kind) ? <Stage kind={kind} onReady={mediaReady} onError={mediaError} onFrame={mediaFrame} onEnded={close} /> : <Scene e={e} still={still} />)}
      {kind === 'noscope' ? <div ref={reveal} className="legend-noscope"><NoscopeCard who={who} map={map} round={e.round} /></div> : <><div className="legend__sparks" aria-hidden="true">{sparks.map((p, i) => <i key={i} style={{ left: `${p.x}%`, width: p.s, height: p.s, animationDelay: `${p.d + 0.5}s`, animationDuration: `${p.t}s` }} />)}</div>
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
      </>}
      <button type="button" className="legend__skip" onClick={(ev) => { ev.stopPropagation(); close(); }}>Continue</button>
    </div>
  );
}

const CINEMATIC = new Set<string>(FULL_PAGE_LEGENDS);
/** The full-page cinematics do not cut in over the match. The scene is mounted straight away underneath a lead-in (the match dims, letterbox bars close
 *  in) with its clock held at zero (legendHold), so its renderers are made and its shaders compiled while the bars move; then the lead-in lifts and the
 *  animation starts from its first frame, warm. LEGEND_LEAD_MS is when the clocks start; the cover is gone LEGEND_LIFT_MS later. */
export const LEGEND_LEAD_MS = 650, LEGEND_LIFT_MS = 400;
export function LegendOverlay(props: { e: G.MatchEvent; mine: G.Lineup[]; map: string; onDone: () => void }) {
  const kind = props.e.legend ?? 'ace';
  const lead = CINEMATIC.has(kind) && !reduceMotion();
  const [phase, setPhase] = useState<'hold' | 'lift' | 'gone'>(lead ? 'hold' : 'gone');
  legendHold.on = phase === 'hold';
  useEffect(() => {
    if (phase === 'gone') return;
    const id = setTimeout(() => setPhase(phase === 'hold' ? 'lift' : 'gone'), phase === 'hold' ? LEGEND_LEAD_MS : LEGEND_LIFT_MS);
    return () => clearTimeout(id);
  }, [phase]);
  useEffect(() => () => { legendHold.on = false; }, []);
  return (
    <>
      <LegendBody {...props} />
      {phase !== 'gone' && (
        <div className={`legend-lead legend-lead--${phase}`} aria-hidden="true" onClick={() => setPhase('gone')}>
          <i className="legend-lead__dim" /><i className="legend-lead__bar legend-lead__bar--top" /><i className="legend-lead__bar legend-lead__bar--bottom" />
        </div>
      )}
    </>
  );
}
