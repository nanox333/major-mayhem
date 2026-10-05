import React, { useEffect, useMemo, useState } from 'react';
import type * as G from '../game/logic';
import { Avatar, TeamBadge } from './art';
import { play } from './sound';
import { reduceMotion } from './util';

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
export const LEGEND_MS = 2400;

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

const HOLES = [[22, 30], [70, 22], [46, 54], [80, 64], [28, 72]];
const ROUNDS_UP = (e: G.MatchEvent) => Number(/after (\d+) rounds/.exec(e.text)?.[1] ?? 36);
const BEHIND = (e: G.MatchEvent) => Number(/(\d+) rounds down/.exec(e.text)?.[1] ?? 9);

/** The part of the cinematic that is different for each moment. Decorative; the card under it says what happened. */
function Scene({ e, still }: { e: G.MatchEvent; still: boolean }) {
  const kind = e.legend ?? 'ace';
  const timer = useCount(0.6, 0.07, 900, 100, still, 2);
  const won = useCount(0, 13, 700, 150, still);
  const rounds = useCount(24, ROUNDS_UP(e), 1100, 100, still);
  const down = BEHIND(e);
  const lead = useCount(-down, 1, 1000, 150, still);
  switch (kind) {
    case 'ace':
      return (
        <div className="lg lg-ace" aria-hidden="true">
          {HOLES.map(([x, y], i) => <i key={`f${i}`} className="lg-flash" style={{ animationDelay: `${i * 0.17}s` }} />)}
          {HOLES.map(([x, y], i) => <b key={`h${i}`} className="lg-hole" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.17}s` }} />)}
          <div className="lg-count">{[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ animationDelay: `${(n - 1) * 0.17}s` }}>{n}</span>)}</div>
          <span className="lg-cross" />
        </div>
      );
    case 'clutch5':
      return (
        <div className="lg lg-clutch" aria-hidden="true">
          <span className="lg-vignette" />
          <div className="lg-pips">
            <i className="lg-one" />
            <span>{[0, 1, 2, 3, 4].map((n) => <em key={n} style={{ animationDelay: `${0.25 + n * 0.17}s` }} />)}</span>
          </div>
          {[0, 1, 2, 3, 4].map((n) => <i key={n} className="lg-flash" style={{ animationDelay: `${0.25 + n * 0.17}s` }} />)}
        </div>
      );
    case 'ninja':
      return (
        <div className="lg lg-ninja" aria-hidden="true">
          <div className="lg-bomb">
            <small>Defusing</small>
            <b>{timer}</b>
            <span className="lg-wires"><u /><u /><u /></span>
            <em className="lg-stamp">Defused</em>
          </div>
        </div>
      );
    case 'noscope':
      return (
        <div className="lg lg-scope" aria-hidden="true">
          <span className="lg-ring" />
          <span className="lg-trail" />
          <span className="lg-hit lg-hit--a" />
          <span className="lg-hit lg-hit--b" />
          <i className="lg-flash" style={{ animationDelay: '.55s' }} />
        </div>
      );
    case 'knife':
      return (
        <div className="lg lg-knife" aria-hidden="true">
          <span className="lg-slash lg-slash--a" /><span className="lg-slash lg-slash--b" /><span className="lg-slash lg-slash--c" />
          <i className="lg-flash" style={{ animationDelay: '.3s' }} />
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
    case 'ninja': return at('tick', [0, 180, 360, 540, 720, 900]);
    case 'noscope': return at('shot', [550]);
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
  useEffect(() => {
    const done = setTimeout(onDone, LEGEND_MS);
    const key = (ev: KeyboardEvent) => { ev.preventDefault(); ev.stopPropagation(); onDone(); };
    window.addEventListener('keydown', key, true);
    const stops = still ? [] : scoreFor(kind);
    return () => { clearTimeout(done); window.removeEventListener('keydown', key, true); stops.forEach((s) => s()); };
  }, []);
  return (
    <div className={`legend legend--${kind} ${still ? 'is-still' : ''}`} role="status" aria-live="assertive" aria-label={`Legendary moment: ${LEGEND_INFO[kind].title}. ${e.text}`} onClick={onDone}>
      <div className="legend__wash" aria-hidden="true" />
      {!still && <Scene e={e} still={still} />}
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
        <span className="legend__bar" aria-hidden="true"><i style={{ animationDuration: `${LEGEND_MS}ms` }} /></span>
      </div>
      <button type="button" className="legend__skip" onClick={(ev) => { ev.stopPropagation(); onDone(); }}>Continue</button>
    </div>
  );
}
