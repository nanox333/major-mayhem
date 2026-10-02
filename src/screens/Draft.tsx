import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ROLE_LABEL, ROLE_SHORT, Player, Role, Roster, ROSTERS, playerLiquipedia } from '../data/rosters';
import * as G from '../game/logic';
import { ChemPreview, Preview, chemPreview, defaultSlot, placementLabel, playerState, sameCandidate } from '../game/draftui';
import { Action, MIN_POOL, Opts, Run, dailyDate, dailyNumber, draftRounds, poolCheck, roundNumber, roundOf, slotsFor, today } from '../game/state';
import { Stats, dailyStreak } from '../game/stats';
import { REACHED } from './Stats';
import { pageUrl } from '../game/share';
import { NextDaily } from '../ui/Countdown';
import { ShareBar } from './Final';
import { Avatar, RoleIcon, Sr, TeamBadge } from '../ui/art';
import { rarity, reduceMotion, useMedia } from '../ui/util';
import { COUNTRY, coachKnows, draftHints } from '../game/synergy';
import { useChatVote } from '../ui/ChatVote';
import { REEL_CURVE, REEL_MS, reelTickTimes } from '../ui/reel';
import { play, playTicks } from '../ui/sound';
import { HowSteps, Tip, useTipSeen } from '../ui/tips';
import { ArrowRightIcon, CaseIcon, MedalIcon, RefreshIcon, TrophyIcon } from '../ui/icons';
import { DailyDone } from './Modes';
import { usePrefs } from '../ui/prefs';
import { RosterBrowser } from '../ui/RosterBrowser';
import { ArrivalFocus } from '../ui/ArrivalFocus';
import { Flag } from '../ui/flags';
import { CaseReady, HowStrip } from '../ui/CaseReady';

/**
 * The draft (#180): the stage for the round, with a short announcement of where you are for a screen reader each time it changes, and keyboard focus
 * handed on to the next decision when a screen replaces the one you were on.
 */
export function DraftScreen(props: { s: Run; dispatch: React.Dispatch<Action>; reelFor: number | null; setReelFor: (n: number | null) => void; stats: Stats; onPreview: (p: Preview | null) => void; /** Opens the free-play setup page (era, teams, hard mode). */ toSetup: () => void }) {
  const s = props.s;
  const round = roundOf(s);
  const what = s.step === 'spin' ? 'open the case' : round === 'coach' ? 'pick a coach' : round === 'bench' ? 'pick a bench player' : 'pick a player';
  return (
    <>
      <span className="sr" role="status">{`Round ${roundNumber(s)} of ${draftRounds(s)}: ${what}.`}</span>
      <DraftStage {...props} />
    </>
  );
}

function DraftStage({ s, dispatch, reelFor, setReelFor, stats, onPreview, toSetup }: {
  s: Run; dispatch: React.Dispatch<Action>; reelFor: number | null; setReelFor: (n: number | null) => void; stats: Stats;
  /** Tells the lineup and the chemistry panel which player or coach you are pointing at (#143). */
  onPreview: (p: Preview | null) => void;
  toSetup: () => void;
}) {
  const prefs = usePrefs();
  const caseRoot = useRef<HTMLDivElement>(null);
  // Which case's cards took over from a reveal that ran to its end: they are already on screen as the reels' previews, so they must not animate in again.
  const [arrived, setArrived] = useState<string | null>(null);
  useEffect(() => {
    if (s.step === 'spin') caseRoot.current?.querySelector<HTMLElement>('button.cta')?.focus({ preventScroll: true });
    if (s.step === 'teams' && (prefs.fastReveals || reduceMotion()) && reelFor === s.offerKey) setReelFor(null);
    if (s.step === 'teams' && (reelFor === null || prefs.fastReveals || reduceMotion())) caseRoot.current?.querySelector<HTMLElement>('button.prow, .case-item--coach')?.focus({ preventScroll: true });
  }, [s.offerKey, s.rerollKey, reelFor, s.step, prefs.fastReveals]);
  if (s.step === 'spin') {
    const date = dailyDate(s);
    const played = date ? stats.daily[date] : undefined;
    const todayN = dailyNumber(today());
    const doneToday = stats.daily[today()];
    return (
      <div ref={caseRoot} className="spin-stage case-ready anim-in" key={`spin-${s.picks.length}`}>
        {s.picks.length === 0 && s.offerKey === 0 && <HowStrip />}
        <CaseReady s={s} onOpen={() => { setReelFor(s.offerKey + 1); dispatch({ type: 'spin' }); }} />
        {s.picks.length === 0 && s.mode === 'daily' && (
          <p className="muted small">
            Daily #{dailyNumber(date!)}: everyone gets the same cases today.
            {played && ` You already finished this one (${played.placement}); replays don't change your record.`}
          </p>
        )}
        <ArrivalFocus selector=".spin-stage .cta" />
        {s.picks.length === 0 && s.rerolls === 2 && s.mode === 'daily' && (
          <button type="button" className="ready-switch" onClick={() => { dispatch({ type: 'reset', mode: 'free' }); toSetup(); }}><span>Switch to free play</span><ArrowRightIcon size={20} /></button>
        )}
        {s.picks.length === 0 && s.rerolls === 2 && s.mode === 'free' && !doneToday && (
          <button type="button" className="ready-switch" onClick={() => dispatch({ type: 'reset', mode: 'daily' })}><span>Play Daily #{todayN} instead</span><ArrowRightIcon size={20} /></button>
        )}
        {s.picks.length === 0 && s.mode === 'free' && doneToday && <DailyDone d={doneToday} n={todayN} />}
      </div>
    );
  }
  if (s.step === 'teams') {
    const coach = roundOf(s) === 'coach';
    if (reelFor === s.offerKey && !reduceMotion() && !prefs.fastReveals) return <CaseReveal offer={s.offer} hard={!!s.opts?.hard} coach={coach} picks={s.picks.length} total={draftRounds(s)} onDone={(ran) => { setArrived(ran ? `${s.offerKey}:${s.rerollKey}` : null); setReelFor(null); }} />;
    // Spin again plays the reels again for the new three: the case is the same one, so the reel key is the offer's own.
    const rolled = () => setReelFor(s.offerKey);
    return <div ref={caseRoot}>{coach ? <CoachChoices s={s} dispatch={dispatch} onPreview={onPreview} onRolled={rolled} /> : <CaseCards s={s} dispatch={dispatch} onPreview={onPreview} onRolled={rolled} arrived={arrived === `${s.offerKey}:${s.rerollKey}`} />}</div>;
  }
  return s.team ? <PlayerChoices roster={G.rosterById.get(s.team)!} s={s} bench={roundOf(s) === 'bench'} dispatch={dispatch} /> : null;
}

/** Items in each lane and where the real roster stops. The reducer already drew the offer; this is only what the lanes show on the way. */
const LANE_LAND = 34, LANE_EXTRA = 4;
/** When each lane locks (ms after they all start together), the share of that time the lane spends travelling (the rest is the overshoot settling back), and its size. */
const LANE_MS = [2300, 2800, 3400];
const TRAVEL_SHARE = 0.93, OVERSHOOT_PX = 7;
/** After the last lane locks: the winners are held, the other rows fade and the winner's card appears where its row was, then the card moves up to full size. */
const HOLD_MS = 380, FADE_MS = 200, GROW_MS = 340;
/** One lock sound per reel, each its own and each a little stronger than the last. They depend on the reel's position, never on who landed, so nothing is given away. */
const LOCK_SFX = ['milspec', 'restricted', 'classified'] as const;
/** Vertical motion blur strengths (the y deviation of an SVG blur), picked per row from the reel's speed and the row's distance from the line. */
/** How far round the drum each row is turned (radians per row). */
const DRUM_RAD = 0.7;
const MOTION_BLUR = [1.6, 3.4, 5.6, 8.5, 12.5];

/** "PGL Major Stockholm 2021" -> "PGL Major Stockholm": the year is shown on its own. */
const eventName = (r: Roster) => r.event.replace(/\s*\b(19|20)\d{2}\s*$/, '');
const blurLevel = (speed: number, rows: number) => {
  const base = speed > 9 ? 5 : speed > 5 ? 4 : speed > 2.6 ? 3 : speed > 0.9 ? 2 : speed > 0.22 ? 1 : 0;
  return Math.max(0, Math.min(5, base + (rows > 1.6 ? 1 : 0) - (rows < 0.6 ? 2 : rows < 1.15 ? 1 : 0)));
};

/** The winning roster's card as it will look, drawn inside its reel, so that the reel visibly becomes the card (the real, clickable card replaces it right after). */
function CardPreview({ roster: r, hard }: { roster: Roster; hard: boolean }) {
  return (
    <div className="lane__preview" aria-hidden="true">
      <article className="case-card case-card--preview" style={{ ['--team' as string]: r.color }}>
        <div className="case-card__top">
          <Montage roster={r} />
          <TeamBadge roster={r} size={64} />
          <div className="case-card__id">
            <h3 className="case-card__name" title={`${r.year} ${r.org}`}><span>{r.year}</span><b>{r.org}</b></h3>
            <div className="case-card__meta"><Placement roster={r} /></div>
            <p className="case-card__major" title={r.event}>{eventName(r)}</p>
          </div>
        </div>
        <ul className="case-players">
          {r.players.map((p, i) => (
            <li key={p.id}>
              <div className="prow" style={{ ['--i' as string]: i }}>
                <span className="prow__face"><Avatar player={p} roster={r} /></span>
                <span className="prow__main">
                  <span className="prow__name"><b>{p.nick}</b><em className="prow__cc"><Flag code={p.country} size={11} decorative />{p.country}</em></span>
                  <span className="prow__meta">{!hard && <span className="prow__role"><RoleIcon role={p.roles[0]} size={13} /> {ROLE_SHORT[p.roles[0]]}</span>}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
        <span className="roster-details-link">View roster &amp; sources</span>
      </article>
    </div>
  );
}

/**
 * The case opening (#225): three vertical reels, one per roster in the offer, side by side where the three cards will be. They start together and lock one
 * after another, each stopping on the roster `offer[i]`, with a little overshoot and a settle. Rows sharpen, grow and brighten as they near the line and
 * blur vertically while the reel is fast. It is presentation only. The offer is already drawn and saved, the passing rosters come from the whole pool and
 * touch no game state, and finishing (or Skip animation) only hands over to the cards, so skipping, reloading or a late timer can never change what the case holds.
 * `onDone(true)` is a reveal that ran to its end, so the cards can take over from the previews without animating in again.
 */
function CaseReveal({ offer, hard, coach, picks, total, onDone }: { offer: string[]; hard: boolean; /** The coach round shows coach cards, not rosters, so its reels simply give way to them. */ coach: boolean; picks: number; total: number; onDone: (ran: boolean) => void }) {
  const phone = useMedia('(max-width: 860px)');
  const step = phone ? 76 : 92;
  // Phones and low-power devices get a lighter reel: no motion-blur filters, fewer styled rows, every other frame.
  const lite = useMemo(() => phone || (navigator.hardwareConcurrency ?? 8) <= 4 || ((navigator as { deviceMemory?: number }).deviceMemory ?? 8) <= 4, [phone]);
  const lanes = useMemo(() => offer.map((id) => {
    const pool = G.shuffle(ROSTERS.filter((r) => r.id !== id));
    const arr = Array.from({ length: LANE_LAND + LANE_EXTRA }, (_, i) => pool[i % pool.length]);
    arr[LANE_LAND] = G.rosterById.get(id)!;
    return arr;
  }), [offer.join('|')]);
  const wins = useRef<(HTMLDivElement | null)[]>([]);
  const strips = useRef<(HTMLDivElement | null)[]>([]);
  const previews = useRef<(HTMLDivElement | null)[]>([]);
  const [locked, setLocked] = useState<boolean[]>([false, false, false]);
  const animsRef = useRef<Animation[]>([]);
  const [skipping, setSkipping] = useState(false);
  // Skip animation: the reels race to their stops, a flash sweeps across them, and then the cards appear, in under half a second.
  const skip = () => {
    if (skipping) return;
    setSkipping(true);
    animsRef.current.forEach((a) => { try { a.updatePlaybackRate(9); } catch { /* not supported: the flash still plays */ } });
    setTimeout(() => onDone(false), 460);
  };
  const [phase, setPhase] = useState<'turn' | 'hold' | 'fade' | 'grow'>('turn');
  const [heights, setHeights] = useState<number[]>([]);
  // Measure each card preview as soon as it is on screen, so its reel can grow to exactly the card's height.
  useLayoutEffect(() => {
    if (phase === 'fade') setHeights(previews.current.map((el) => el?.firstElementChild?.getBoundingClientRect().height ?? 0));
  }, [phase]);
  useLayoutEffect(() => {
    const h = wins.current[0]?.clientHeight ?? 430;
    const target = LANE_LAND * step + step / 2 - h / 2;
    const anims: Animation[] = [];
    animsRef.current = anims;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)); };
    strips.current.forEach((el, i) => {
      if (!el) return;
      const ms = LANE_MS[i];
      if (typeof el.animate !== 'function') { el.style.transform = `translateY(${-target}px)`; }
      else {
        // Fast away, a long deceleration to a few pixels past the stop line, then back onto it.
        anims.push(el.animate([
          { transform: 'translateY(0)', offset: 0, easing: `cubic-bezier(${REEL_CURVE.join(',')})` },
          { transform: `translateY(${-(target + OVERSHOOT_PX)}px)`, offset: TRAVEL_SHARE, easing: 'cubic-bezier(.3,0,.4,1)' },
          { transform: `translateY(${-target}px)`, offset: 1 },
        ], { duration: ms, fill: 'forwards' }));
      }
      later(() => setLocked((l) => l.map((v, k) => (k === i ? true : v))), ms);
    });
    const last = LANE_MS[LANE_MS.length - 1];
    later(() => setPhase('hold'), last);
    if (coach) later(() => onDone(false), last + HOLD_MS);
    else {
      later(() => setPhase('fade'), last + HOLD_MS);
      later(() => setPhase('grow'), last + HOLD_MS + FADE_MS);
      later(() => onDone(true), last + HOLD_MS + FADE_MS + GROW_MS);
    }
    // Per frame: how far each row is from the line decides its size, brightness and blur, so rows sharpen and swell as they approach and shrink and dim as they leave.
    const speed = [0, 0, 0], prev = [0, 0, 0], styled: Set<HTMLElement>[] = [new Set(), new Set(), new Set()];
    const cache = new WeakMap<HTMLElement, string>();
    const span = lite ? 3 : 5;
    let before = performance.now(), raf = 0, tick = 0;
    const put = (row: HTMLElement, t: string, o: string, f: string) => {
      const key = `${t}|${o}|${f}`;
      if (cache.get(row) === key) return;
      cache.set(row, key);
      row.style.transform = t; row.style.opacity = o; row.style.filter = f;
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // Small or older devices style every other frame: the reels still move on the compositor at full rate.
      if (lite && (tick++ & 1)) return;
      const dt = Math.max(1, now - before); before = now;
      // Read every reel's position first, then write: mixing them makes the browser recalculate styles once per reel.
      const ys = strips.current.map((el, i) => (!el ? 0 : anims[i]?.playState === 'finished' ? prev[i] : -new DOMMatrixReadOnly(getComputedStyle(el).transform).m42));
      strips.current.forEach((el, i) => {
        if (!el) return;
        const y = ys[i];
        speed[i] = speed[i] * 0.6 + (Math.abs(y - prev[i]) / dt) * 0.4; prev[i] = y;
        const centre = y + h / 2;
        const from = Math.max(0, Math.floor((centre - span * step) / step)), to = Math.min(el.children.length - 1, Math.ceil((centre + span * step) / step));
        const now2 = new Set<HTMLElement>();
        for (let k = from; k <= to; k++) {
          const row = el.children[k] as HTMLElement;
          const off = ((k + 0.5) * step - centre) / step;
          const d = Math.abs(off);
          const lvl = lite ? 0 : blurLevel(speed[i], d);
          // A drum seen from the front: each row sits on a cylinder, so it tilts back, sinks and is squeezed together as it turns away from the line.
          const th = Math.max(-1.4, Math.min(1.4, off * DRUM_RAD));
          const radius = step / DRUM_RAD;
          const lift = radius * Math.sin(th) - off * step;
          const depth = -radius * (1 - Math.cos(th));
          const shade = Math.max(0.12, Math.pow(Math.cos(th), 2.2));
          put(row, `translateY(${lift.toFixed(1)}px) translateZ(${depth.toFixed(1)}px) rotateX(${(-th).toFixed(3)}rad) scale(${(1.03 + (d < 0.5 ? 0.02 : 0)).toFixed(3)})`, shade.toFixed(2), lvl ? `url(#mv-${lvl})` : 'none');
          now2.add(row);
        }
        styled[i].forEach((row) => { if (!now2.has(row)) { cache.delete(row); row.style.transform = ''; row.style.opacity = ''; row.style.filter = ''; } });
        styled[i] = now2;
      });
    };
    raf = requestAnimationFrame(frame);
    // One stream of ticks, following the longest reel, so three reels don't make three overlapping machines; then a lock sound as each one stops.
    const ticks = playTicks(reelTickTimes(target, h / 2, step, last * TRAVEL_SHARE), 40);
    const locks = LANE_MS.map((ms, i) => play('reveal', { rarity: LOCK_SFX[i], delay: ms + 30 }));
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); anims.forEach((a) => a.cancel()); ticks(); locks.forEach((c) => c()); };
  }, [lanes, step]);
  const morph = phase === 'fade' || phase === 'grow';
  return (
    <div className={`case reveal is-${phase} ${skipping ? 'is-skipping' : ''} ${lite ? 'is-lite' : ''}`} style={{ ['--step' as string]: `${step}px` }}>
      <svg className="reveal__defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>{MOTION_BLUR.map((v, i) => <filter key={i} id={`mv-${i + 1}`} x="-4%" y="-90%" width="108%" height="280%" colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation={`0 ${v}`} /></filter>)}</defs>
      </svg>
      <span className="sr" role="status">Revealing three rosters.</span>
      <div className="reveal__bar">
        <button type="button" className="st-btn st-btn--quiet reveal__skip" disabled={skipping} onClick={skip}>Skip animation</button>
      </div>
      <div className="teams-col reveal__lanes" aria-hidden="true">
        {lanes.map((items, i) => (
          <div key={i} className={`lane ${locked[i] ? 'is-locked' : ''}`}>
            <p className="lane__label">Roster {i + 1}</p>
            <div className="lane__window" ref={(el) => { wins.current[i] = el; }} style={phase === 'grow' && heights[i] ? { height: heights[i] } : undefined}>
              <div className="lane__strip" ref={(el) => { strips.current[i] = el; }}>
                {items.map((r, k) => (
                  <div key={k} className={`lane__item ${locked[i] && k === LANE_LAND ? 'is-winner' : ''}`}>
                    <TeamBadge roster={r} size={48} />
                    <span><strong>{r.org}</strong><small>{r.year} · {eventName(r)}</small></span>
                  </div>
                ))}
              </div>
              <i className="lane__fade lane__fade--top" />
              <i className="lane__fade lane__fade--bottom" />
              <i className="lane__marker" />
              {morph && <div ref={(el) => { previews.current[i] = el; }} className={`lane__slot ${phase === 'grow' ? 'is-grown' : ''}`}><CardPreview roster={lanes[i][LANE_LAND]} hard={hard} /></div>}
            </div>
          </div>
        ))}
      </div>
      <div className="draft-decision">
        <div className="draft-decision-empty is-compact"><b>Revealing three rosters</b><span>Skip animation jumps ahead to the same three. Opening a case never spends a spin.</span></div>
      </div>
    </div>
  );
}

/**
 * Spin again (#174). A reroll is one pending operation: while it is under way any further press, by mouse, touch or keyboard, does nothing, so a quick
 * double click spends one of the two rerolls and not both. It is dropped if the page leaves the screen or the run or case has changed in the meantime
 * (`stamp` says which run and case it was made for), so a delayed reroll can never land on a different run.
 * `onRolled` runs only for a reroll that went through, so the reels play again for the new three; reduced motion goes straight to them.
 */
function useReroll(dispatch: React.Dispatch<Action>, stamp: string, onRolled?: () => void) {
  const [out, setOut] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(stamp);
  live.current = stamp;
  useEffect(() => () => { if (pending.current) clearTimeout(pending.current); }, []);
  const reroll = () => {
    if (pending.current) return;
    if (reduceMotion()) return dispatch({ type: 'reroll' });
    const madeFor = stamp;
    setOut(true);
    pending.current = setTimeout(() => {
      pending.current = null;
      if (live.current === madeFor) { dispatch({ type: 'reroll' }); onRolled?.(); }
      setOut(false);
    }, 160);
  };
  return { out, reroll };
}
const stampOf = (s: Run) => `${s.attempt}:${s.offerKey}:${s.rerollKey}`;

/** "Spin again" with the real number of spins left (#103). */
function SpinAgain({ s, reroll, busy }: { s: Run; reroll: () => void; busy?: boolean }) {
  return (
    <div className="reroll-row anim-in" style={{ animationDelay: '220ms' }}>
      <button className="ghost-btn ghost-btn--big" data-sfx="reroll" onClick={reroll} disabled={s.rerolls <= 0 || busy}>
        <RefreshIcon size={14} /> Spin again · {s.rerolls <= 0 ? 'no spins left' : `${s.rerolls} spin${s.rerolls === 1 ? '' : 's'} left`}
      </button>
    </div>
  );
}

/**
 * The team's header art (#225): that roster's own five players, side by side from the right edge, behind a wash of the team's colour, with the logo
 * enlarged as a watermark. It is decoration made from the same credited portraits the rows use; a player without a photo is simply left out, and with
 * fewer than three the strip is dropped so a card never shows a half-empty montage. Names, years and results stay HTML.
 */
function Montage({ roster }: { roster: Roster }) {
  const faces = roster.players.filter((p) => p.portrait);
  return (
    <span className="montage" aria-hidden="true">
      {roster.logo && <img className="montage__mark" src={roster.logo} alt="" loading="lazy" />}
      {faces.length >= 3 && <span className="montage__faces">{faces.map((p) => <img key={p.id} src={p.portrait} alt="" loading="lazy" />)}</span>}
    </span>
  );
}

/** A team's result as a placement badge: an icon and the words ("1st place"), so the colour of the card is never the only signal (#104). */
function Placement({ roster }: { roster: Roster }) {
  const word = ({ Champions: 'Champion', 'Runner-up': 'Finalist' } as Record<string, string>)[roster.result] ?? roster.result;
  return <span className="place" title={placementLabel(roster.result)}>{roster.result === 'Champions' ? <TrophyIcon size={14} /> : <MedalIcon size={14} />}{word}</span>;
}

/** The coach round: three coaches, each shown with the Major they coached at. */
function CoachChoices({ s, dispatch, onPreview, onRolled }: { s: Run; dispatch: React.Dispatch<Action>; onPreview: (p: Preview | null) => void; onRolled: () => void }) {
  const { out, reroll } = useReroll(dispatch, stampOf(s), onRolled);
  useEffect(() => () => onPreview(null), []);
  const pointAt = (id: string | null) => {
    if (!id) return onPreview(null);
    const c = G.rosterById.get(id)!.coach!;
    onPreview({ slot: 'coach', rosterId: id, coach: c, chem: chemPreview({ picks: s.picks, coach: s.coach }, { picks: s.picks, coach: c }, !!s.opts?.hard) });
  };
  const drafted = s.picks.map((pk) => G.rosterById.get(pk.rosterId)!.players.find((x) => x.id === pk.playerId)!);
  useChatVote(`coach-${s.offerKey}-${s.rerollKey}`, s.offer.map((id) => { const c = G.rosterById.get(id)!.coach!; return { id, label: c, aliases: [c] }; }),
    (id) => dispatch({ type: 'coach', rosterId: id }));
  return (
    <div className="case">
      <ArrivalFocus selector=".case-item--coach" />
      <div className={`teams-col ${out ? 'is-out' : ''}`}>
        {s.offer.map((id, i) => {
          const r = G.rosterById.get(id)!;
          const knows = drafted.filter((p) => coachKnows(r.coach!, p.id));
          return (
            <button key={`${id}-${s.rerollKey}`} className={`case-item case-item--coach rar-${s.opts?.hard ? 'milspec' : rarity(r)} anim-in`} data-sfx="draft" style={{ animationDelay: `${i * 70}ms`, ['--team' as string]: r.color }} onClick={() => dispatch({ type: 'coach', rosterId: id })}
              onMouseEnter={() => pointAt(id)} onMouseLeave={() => pointAt(null)} onFocus={() => pointAt(id)} onBlur={() => pointAt(null)}>
              <div className="case-item__top">
                <TeamBadge roster={r} size={44} />
                <div className="case-item__id">
                  <div className="case-item__name">{r.coach}</div>
                  <div className="case-item__meta"><span>Coach · {r.org} {r.year}</span><Placement roster={r} /></div>
                </div>
              </div>
              {knows.length > 0 && <span className="hint hint--good"><i aria-hidden="true">+</i> <Sr>Bonus: </Sr>Coached {knows.map((p) => p.nick).join(', ')}</span>}
              <div className="case-item__event">{r.event}</div>
            </button>
          );
        })}
      </div>
      <SpinAgain s={s} reroll={reroll} busy={out} />
    </div>
  );
}

type Chosen = { r: Roster; p: Player };

/**
 * The case (#102 to #105): three team cards with all fifteen players in view. Pick a player, see the slot and what it means, then draft.
 * It drafts through the same two steps as before (open the team, then draft the player), so a seed plays out exactly as it did.
 */
function CaseCards({ s, dispatch, onPreview, onRolled, arrived }: { s: Run; dispatch: React.Dispatch<Action>; onPreview: (p: Preview | null) => void; /** Spin again went through: play the reels for the new three. */ onRolled: () => void; /** The cards replace the reels' previews of them, so they do not animate in. */ arrived?: boolean }) {
  const [details, setDetails] = useState<string | null>(null);
  const { out, reroll } = useReroll(dispatch, stampOf(s), onRolled);
  const bench = roundOf(s) === 'bench';
  const hard = !!s.opts?.hard;
  const taken = G.draftedIds(s.picks);
  const drafted = s.picks.map((pk) => G.rosterById.get(pk.rosterId)!.players.find((x) => x.id === pk.playerId)!);
  const can = (p: Player) => (bench ? !taken.has(p.id) : slotsFor(s, p).length > 0);
  const [sel, setSel] = useState<Chosen | null>(null);
  const [slot, setSlot] = useState<Role | null>(null);
  // Pointing at a player (mouse or keyboard) previews them; pressing one keeps the preview until you draft or pick someone else (#143).
  const [hov, setHov] = useState<Chosen | null>(null);
  // Choosing a player with the keyboard moves focus to the Draft button, so the next Enter drafts them (#77).
  const [focusDraft, setFocusDraft] = useState(false);
  useEffect(() => { if (focusDraft && sel) { document.querySelector<HTMLElement>('.draftbar .cta')?.focus(); setFocusDraft(false); } }, [focusDraft, sel]);
  // On a phone a compact selector exposes the eligible counts; only its roster is visible. Wider screens show all three.
  const phone = useMedia('(max-width: 860px)');
  const [openId, setOpenId] = useState<string | null>(s.offer[0] ?? null);
  // On a phone the three rosters sit in a swipeable rail: the selector scrolls to a roster, and swiping to one updates the selector (never a pick).
  const rail = useRef<HTMLDivElement>(null);
  const railBusy = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showRoster = (id: string) => {
    setOpenId(id); setHov(null);
    if (!phone) return;
    if (railBusy.current) clearTimeout(railBusy.current);
    railBusy.current = setTimeout(() => { railBusy.current = null; }, 600);
    rail.current?.querySelector<HTMLElement>(`[data-roster="${id}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
  };
  useEffect(() => () => { if (railBusy.current) clearTimeout(railBusy.current); }, []);
  const onRailScroll = () => {
    const el = rail.current;
    if (!phone || !el || railBusy.current) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best: string | null = null, gap = Infinity;
    el.querySelectorAll<HTMLElement>('[data-roster]').forEach((c) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < gap) { gap = d; best = c.dataset.roster ?? null; } });
    if (best && best !== openId) setOpenId(best);
  };
  // A new case, or a spin again, clears the choice.
  useEffect(() => { setSel(null); setSlot(null); setHov(null); setOpenId(s.offer[0] ?? null); }, [s.offerKey, s.rerollKey]);

  const cand = hov ?? sel;
  // A pick is a person *and* the roster they are offered from: the same player in two rosters has different teammates, era and chemistry (#173).
  const isSel = sameCandidate(cand, sel);
  const candSlot: Role | 'bench' | null = !cand ? null : bench ? 'bench' : isSel ? slot : defaultSlot(slotsFor(s, cand.p), cand.p.roles[0], hard);
  const chem: ChemPreview | null = useMemo(() => {
    if (!cand || bench) return null;
    const use = candSlot && candSlot !== 'bench' ? candSlot : slotsFor(s, cand.p)[0];
    return use ? chemPreview({ picks: s.picks, coach: s.coach }, { picks: [...s.picks, { slot: use, rosterId: cand.r.id, playerId: cand.p.id }], coach: s.coach }, hard) : null;
  }, [cand?.p.id, cand?.r.id, candSlot, s.picks, s.coach, hard]);
  useEffect(() => { onPreview(cand ? { slot: candSlot, rosterId: cand.r.id, playerId: cand.p.id, chem } : null); }, [cand?.p.id, cand?.r.id, candSlot, chem]);
  useEffect(() => () => onPreview(null), []);

  const choose = (c: Chosen) => { setSel(c); setOpenId(c.r.id); setSlot(bench ? null : defaultSlot(slotsFor(s, c.p), c.p.roles[0], hard)); };
  const draft = () => {
    if (!sel) return;
    dispatch({ type: 'team', id: sel.r.id });
    if (bench) dispatch({ type: 'bench', player: sel.p });
    else if (slot) dispatch({ type: 'draft', player: sel.p, slot });
  };

  // Chat votes once, on a player (by number or name); the slot is their main role when it's open, else the first open one they cover.
  const chatOptions = s.offer.flatMap((id) => {
    const r = G.rosterById.get(id)!;
    return r.players.filter(can).map((p) => ({ id: `${id}::${p.id}`, label: `${p.nick} (${r.tag} ${r.year})`, aliases: [p.nick, `${p.nick} ${r.tag}`] }));
  });
  useChatVote(`case-${s.offerKey}-${s.rerollKey}-${bench}`, chatOptions, (key) => {
    const [rid, pid] = key.split('::');
    const r = G.rosterById.get(rid)!;
    const p = r.players.find((x) => x.id === pid)!;
    // Hard mode is a test of which role each player fits, and chat votes for a person only: the winner is chosen on screen and waits for the host to
    // pick the slot and confirm, and nothing infers the role from the hidden main one (#176).
    if (hard && !bench) return choose({ r, p });
    dispatch({ type: 'team', id: rid });
    if (bench) return dispatch({ type: 'bench', player: p });
    const slots = slotsFor(s, p);
    dispatch({ type: 'draft', player: p, slot: slots.includes(p.roles[0]) ? p.roles[0] : slots[0] });
  });

  return (
    <div className="case">
      <ArrivalFocus selector=".case-card button.prow" />
      {!bench && (hard
        ? <Tip id="fit" title="Hard mode" anchor="left" short="No role labels: put each player where you think they fit.">There are no role labels: put each player where you think they fit best. A slot that doesn't suit them costs you, but nothing tells you which is which.</Tip>
        : <Tip id="fit" title="Roles and fit" anchor="left" short="Main-role picks give the best fit.">Each player has a main role: draft them there for the best fit. A role they also cover costs a little, and the card says so ("2nd role"). The + and − marks are chemistry: a shared country, a famous duo, a second AWPer.</Tip>)}
      {phone && (
        <div className="roster-selector" role="group" aria-label="Choose a roster to view">
          {s.offer.map(id => {
            const r = G.rosterById.get(id)!;
            return (
              <button key={id} type="button" aria-pressed={openId === id} aria-controls={`players-${id}`}
                onClick={() => showRoster(id)}>
                <span>{r.tag}</span><small>{r.year} · {r.players.filter(can).length} available</small>
                <span className="sr case-card__sum">{cardSummary(r, s, taken, bench, hard)}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className={`teams-col ${out ? 'is-out' : ''} ${phone ? 'is-rail' : ''}`} ref={rail} onScroll={onRailScroll}>
        {s.offer.map((id, i) => {
          const r = G.rosterById.get(id)!;
          const top = (
            <>
              <Montage roster={r} />
              <TeamBadge roster={r} size={64} />
              <div className="case-card__id">
                <h3 className="case-card__name" title={`${r.year} ${r.org}`}><span>{r.year}</span><b>{r.org}</b></h3>
                <div className="case-card__meta"><Placement roster={r} /></div>
                <p className="case-card__major" title={r.event}>{eventName(r)}</p>
              </div>
            </>
          );
          return (
            <article key={`${id}-${s.rerollKey}`} className={`case-card ${hard ? '' : 'case-card--revealed'} rar-${hard ? 'milspec' : rarity(r)} ${sel?.r.id === id ? 'is-sel' : ''} ${arrived ? '' : 'anim-in'}`} data-roster={id} style={{ animationDelay: `${i * 70}ms`, ['--team' as string]: r.color }} aria-label={`${r.org} ${r.year}`}>
              <div className="case-card__top">{top}</div>
              <ul className="case-players" id={`players-${id}`}>
                {r.players.map((p) => {
                  const ok = can(p);
                  const on = sel?.r.id === id && sel.p.id === p.id;
                  const hints = !hard && ok && !bench ? draftHints(drafted, p) : [];
                  const st = bench ? { state: ok ? 'main' : 'unavailable', would: null, taken: null } as const : playerState(p, slotsFor(s, p), hard);
                  const body = (
                    <>
                      <span className="prow__face"><Avatar player={p} roster={r} /></span>
                      <span className="prow__main">
                        <span className="prow__name"><b>{p.nick}</b><em className="prow__cc" title={COUNTRY[p.country] ?? p.country}><Flag code={p.country} size={11} decorative />{p.country}</em></span>
                        <span className="prow__meta">
                          {!ok && <small className="prow__why" title={unavailableReason(p, s, taken)}>{rowReason(p, s, taken)}</small>}
                          {ok && !hard && st.state === 'main' && <span className="prow__role" title="Main role"><RoleIcon role={p.roles[0]} size={13} /> <Sr>Main role: </Sr>{ROLE_SHORT[p.roles[0]]}</span>}
                          {ok && !hard && st.state === 'secondary' && (
                            <>
                              <span className="prow__role is-taken" title={`${ROLE_LABEL[st.taken]} is already filled`}><RoleIcon role={st.taken} size={13} /> <s>{ROLE_SHORT[st.taken]}</s> taken<Sr>: {ROLE_LABEL[st.taken]}, their main role, is already filled. </Sr></span>
                              <span className="prow__role is-second" title={`Would play ${ROLE_LABEL[st.would]} as a second role`}><RoleIcon role={st.would} size={13} /> {ROLE_SHORT[st.would]} 2nd role<Sr>: would play {ROLE_LABEL[st.would]} as a second role. </Sr></span>
                            </>
                          )}
                          {hints.map((h) => <span key={h.text} className={`hint ${h.good ? 'hint--good' : 'hint--bad'}`}><i aria-hidden="true">{h.good ? '+' : '−'}</i> <Sr>{h.good ? 'Bonus: ' : 'Penalty: '}</Sr>{h.text}</span>)}
                        </span>
                      </span>
                    </>
                  );
                  return (
                    <li key={p.id}>
                      {ok
                        ? <button type="button" className={`prow ${on ? 'is-sel' : ''} ${st.state === 'secondary' ? 'is-second' : ''}`} aria-pressed={on} data-sfx="select" onClick={(e) => { choose({ r, p }); if (e.detail === 0) setFocusDraft(true); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' && on) { e.preventDefault(); draft(); } }}
                          onMouseEnter={() => setHov({ r, p })} onMouseLeave={() => setHov(null)} onFocus={() => setHov({ r, p })} onBlur={() => setHov(null)}>{body}</button>
                        : <div className="prow is-off">{body}</div>}
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="roster-details-link" onClick={() => setDetails(id)} aria-label={`View roster: ${r.org} ${r.year}`}>View roster & sources</button>
            </article>
          );
        })}
      </div>
      <span className="sr" role="status">{sel ? `${sel.p.nick} selected.${chem && isSel ? (chem.before === chem.after ? ' Chemistry stays the same.' : ` Chemistry would go from ${chem.before} to ${chem.after}.`) : ''} Choose a slot, then draft.` : ''}</span>
      <div className="draft-decision">
        {!sel && !hov && (
          <div className="draft-decision-empty is-compact">
            <b>Select a player</b><span>{bench ? 'Choose a bench player from any roster.' : 'Point at a player to see where they fit.'}</span>
          </div>
        )}
        {!sel && hov && <PeekBar s={s} cand={hov} slot={candSlot} chem={chem} bench={bench} hard={hard} />}
        {sel && <DraftBar s={s} sel={sel} slot={slot} setSlot={setSlot} bench={bench} hard={hard} onDraft={draft} />}
        <SpinAgain s={s} reroll={reroll} busy={out} />
      </div>
      {details && <RosterBrowser initialId={details} hard={hard} onClose={() => setDetails(null)} />}
    </div>
  );
}

type Why = { key: string; text: string; role?: Role; sign?: '+' | '−' };

/**
 * The reasons under "Why pick" (#225), all from the real model: the slot they would fill and how well it suits them, and each chemistry link their pick
 * would add or break, named as the model names it. Hard mode keeps its promise: no fit and no chemistry, only the slot you chose.
 */
function whyLines(s: Run, cand: Chosen, slot: Role | 'bench' | null, chem: ChemPreview | null, bench: boolean, hard: boolean): Why[] {
  if (bench) return [{ key: 'bench', text: 'Joins as your bench player' }, { key: 'sub', text: "Subs in for a starter who's off form" }];
  const out: Why[] = [];
  if (slot && slot !== 'bench') {
    const note = G.fitNote(cand.p, slot);
    out.push({ key: 'slot', role: slot, text: hard ? `Would play ${ROLE_LABEL[slot]}` : `Fills ${ROLE_LABEL[slot]} slot · ${note.kind === 'main' ? 'main role' : note.text}` });
  } else out.push({ key: 'slot', text: 'Choose a slot' });
  if (!hard) {
    if (chem && (chem.added.length || chem.removed.length)) {
      // A shared-country link says who it is shared with, from your actual picks; every other link keeps the model's own wording.
      const mates = s.picks.map((pk) => G.rosterById.get(pk.rosterId)!.players.find((x) => x.id === pk.playerId)!).filter((p) => p && p.country === cand.p.country).map((p) => p.nick);
      chem.added.forEach((x, i) => out.push({ key: `a${i}`, sign: x.value < 0 ? '−' : '+', text: x.kind === 'nation' && mates.length ? `Same country as ${mates.join(', ')}` : x.label }));
      chem.removed.forEach((x, i) => out.push({ key: `r${i}`, sign: '−', text: `Loses ${x.label}` }));
      if (chem.capped) out.push({ key: 'cap', text: 'Chemistry is already at its maximum' });
    } else out.push({ key: 'none', text: s.picks.length === 0 ? 'No chemistry links yet' : 'No new chemistry links' });
  }
  return out;
}

function WhyList({ lines }: { lines: Why[] }) {
  return (
    <ul className="why">
      {lines.map((x) => (
        <li key={x.key} className={x.sign ? (x.sign === '+' ? 'is-good' : 'is-bad') : ''}>
          <span className="why__mark" aria-hidden="true">{x.role ? <RoleIcon role={x.role} size={15} /> : x.sign ?? '•'}</span>
          <span>{x.sign && <Sr>{x.sign === '+' ? 'Bonus: ' : 'Penalty: '}</Sr>}{x.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** The portrait, name and team of whoever you are pointing at or have chosen: one block, so the two states look like the same panel. */
function Candidate({ cand, hard, state }: { cand: Chosen; hard: boolean; state: string }) {
  return (
    <div className="draftbar__identity">
      <span className="draftbar__portrait" style={{ ['--team' as string]: cand.r.color }}>
        {cand.r.logo && <img className="draftbar__emblem" src={cand.r.logo} alt="" />}
        <Avatar player={cand.p} roster={cand.r} />
      </span>
      <p className="draftbar__who">
        <b>{cand.p.nick}</b>
        <span className="draftbar__meta"><Flag code={cand.p.country} size={13} decorative /> {cand.p.country}{!hard && <> · <RoleIcon role={cand.p.roles[0]} size={13} /> {ROLE_SHORT[cand.p.roles[0]]}</>}</span>
        <span>{cand.r.org} {cand.r.year}</span>
        <small>{state}</small>
      </p>
    </div>
  );
}

/** Pointing at a player before choosing anyone: the same panel, opened up, without the commit. */
function PeekBar({ s, cand, slot, chem, bench, hard }: { s: Run; cand: Chosen; slot: Role | 'bench' | null; chem: ChemPreview | null; bench: boolean; hard: boolean }) {
  return (
    <div className="peekbar anim-in" aria-label={`${cand.p.nick}, not selected`} style={{ ['--team' as string]: cand.r.color }}>
      <Candidate cand={cand} hard={hard} state="Preview · press to select" />
      <div className="draftbar__chem"><small className="draftbar__why">Why pick {cand.p.nick}?</small><WhyList lines={whyLines(s, cand, slot, chem, bench, hard)} /></div>
      <p className="peekbar__hint">Select to draft</p>
    </div>
  );
}

/** What you are about to do: the player, why (the slot and the chemistry it would make), the slot choice, and the strongest button on the page. */
function DraftBar({ s, sel, slot, setSlot, bench, hard, onDraft }: { s: Run; sel: Chosen; slot: Role | null; setSlot: (r: Role) => void; bench: boolean; hard: boolean; onDraft: () => void }) {
  const slots = bench ? [] : slotsFor(s, sel.p);
  const nick = sel.p.nick;
  const st = bench ? null : playerState(sel.p, slots, hard);
  const preview = !hard && !bench && slot ? chemPreview({ picks: s.picks, coach: s.coach }, { picks: [...s.picks, { slot, rosterId: sel.r.id, playerId: sel.p.id }], coach: s.coach }, false) : null;
  return (
    <div className="action-bar draftbar anim-in" role="region" aria-label={`Draft ${nick}`} style={{ ['--team' as string]: sel.r.color }}>
      <Candidate cand={sel} hard={hard} state="Selected candidate · not yet drafted" />
      <div className="draftbar__chem">
        <small className="draftbar__why">Why pick {nick}?</small>
        <WhyList lines={whyLines(s, sel, bench ? 'bench' : slot, preview, bench, hard)} />
        {preview && preview.before !== preview.after && <p className="draftbar__total">Chemistry: {preview.before} → {preview.after}</p>}
      </div>
      {/* The slot choice is shown when there is a choice to make (more than one open slot, a second role, or hard mode); with one obvious slot it is already picked and named above. */}
      {slots.length > 0 && (hard || slots.length > 1 || st?.state === 'secondary') && (
        <div className="draftbar__slots" role="group" aria-label={`Slot for ${nick}`}>
          {!hard && st?.state === 'secondary' && (
            <button type="button" disabled className="slot-chip slot-chip--draft is-taken" aria-label={`${ROLE_LABEL[st.taken]}: already filled`}>
              <span><RoleIcon role={st.taken} size={12} /> <s>{ROLE_SHORT[st.taken]}</s></span><small className="fit">already filled</small>
            </button>
          )}
          {slots.map((sl) => {
            const note = G.fitNote(sel.p, sl);
            return (
              <button key={sl} type="button" aria-pressed={slot === sl} data-sfx="select" className={`slot-chip slot-chip--draft ${slot === sl ? 'is-on' : ''} ${!hard && note.kind === 'main' ? 'slot-chip--main' : ''}`} onClick={() => setSlot(sl)}
                aria-label={`${ROLE_LABEL[sl]}${hard ? '' : `, ${note.text}`}`}>
                <span><RoleIcon role={sl} size={12} /> {ROLE_SHORT[sl]}</span>
                {!hard && <small className={`fit fit--${note.kind}`} title={note.text}>{note.kind === 'main' ? 'main role' : note.kind === 'secondary' ? 'secondary' : 'off-role'}</small>}
              </button>
            );
          })}
        </div>
      )}
      <button type="button" className="cta cta--orange" data-sfx="draft" disabled={!bench && !slot} onClick={onDraft}>
        <span className="cta__stack">
          <b>{bench || slot ? `Draft ${nick}` : 'Choose a slot'}</b>
          <small>{bench ? 'as Bench' : slot ? `as ${ROLE_LABEL[slot]}` : `for ${nick}`}</small>
        </span>
        <ArrowRightIcon size={22} />
      </button>
    </div>
  );
}

function PlayerChoices({ roster, s, bench, dispatch }: { roster: Roster; s: Run; bench?: boolean; dispatch: React.Dispatch<Action> }) {
  const picks = s.picks;
  const hard = !!s.opts?.hard;
  const draftedIds = G.draftedIds(picks);
  const can = (p: Roster['players'][number]) => (bench ? !draftedIds.has(p.id) : slotsFor(s, p).length > 0);
  const players = roster.players.filter(can);
  const drafted = picks.map((pk) => G.rosterById.get(pk.rosterId)!.players.find((x) => x.id === pk.playerId)!);
  const taken = roster.players.filter((p) => !can(p));
  // Chat votes on the player; the slot is their main role when it's open, else the first open one they cover.
  useChatVote(`player-${roster.id}-${picks.length}-${bench}`, players.map((p) => ({ id: p.id, label: p.nick, aliases: [p.nick] })), (id) => {
    const p = players.find((x) => x.id === id)!;
    if (bench) return dispatch({ type: 'bench', player: p });
    const slots = slotsFor(s, p);
    dispatch({ type: 'draft', player: p, slot: slots.includes(p.roles[0]) ? p.roles[0] : slots[0] });
  });
  return (
    <div className="players-col">
      <div className={`team-heading rar-${hard ? 'milspec' : rarity(roster)}`}>
        <TeamBadge roster={roster} size={40} />
        <div>
          <div className="team-heading__name">{roster.org} <span>{roster.year}</span></div>
          <div className="team-heading__event">{roster.result} · {roster.event}</div>
          <div className="src-links">
            <a href={roster.liquipediaUrl} target="_blank" rel="noreferrer">Liquipedia</a>
            <a href={roster.sourceUrl} target="_blank" rel="noreferrer">Source: Wikipedia</a>
            <a href={reportUrl(roster)} target="_blank" rel="noreferrer">Report incorrect data</a>
          </div>
        </div>
      </div>
      {!bench && (hard
        ? <Tip id="fit" title="Hard mode" short="No role labels: put each player where you think they fit.">There are no role labels: put each player where you think they fit best. A slot that doesn't suit them costs you, but nothing tells you which is which.</Tip>
        : <Tip id="fit" title="Roles and fit" short="Main-role picks give the best fit.">Each player has a main role. Draft them there for the best fit: another role they cover costs a little, and an off-role costs more. The line under each Draft button says which. The + and − chips are chemistry: a shared country, a famous duo, a second AWPer.</Tip>)}
      <div className="players-grid">
        {players.map((p, i) => {
          const slots = slotsFor(s, p);
          return (
            <div className="agent anim-in" style={{ animationDelay: `${i * 55}ms` }} key={p.id} role="group" aria-label={p.nick}>
              <div className="agent__photo">
                <Avatar player={p} roster={roster} className="agent__img" />
                {!hard && <span className="agent__main" title="Main role"><RoleIcon role={p.roles[0]} size={12} /> {ROLE_SHORT[p.roles[0]]}</span>}
                <span className="agent__flag" title={COUNTRY[p.country] ?? p.country}>{p.country}</span>
              </div>
              <div className="agent__body">
                {/* The name is just the name; the reference link is a separate, smaller control, so it can't be mistaken for drafting (#17). */}
                <span className="agent__name">{p.nick}
                  <a className="agent__ref" href={playerLiquipedia(p.nick)} target="_blank" rel="noreferrer" aria-label={`${p.nick} on Liquipedia`} title="Liquipedia">↗</a>
                </span>
                {!hard && <span className="agent__role muted small">Main role: {ROLE_LABEL[p.roles[0]]}</span>}
                {!hard && draftHints(drafted, p).map((h) => <span key={h.text} className={`hint ${h.good ? 'hint--good' : 'hint--bad'}`}><i aria-hidden="true">{h.good ? '+' : '−'}</i> <Sr>{h.good ? 'Bonus: ' : 'Penalty: '}</Sr>{h.text}</span>)}
                <div className="agent__slots">
                  {bench && <button className="slot-chip slot-chip--main" data-sfx="draft" onClick={() => dispatch({ type: 'bench', player: p })}>⇄ Draft as Bench</button>}
                  {!bench && slots.map((slot) => {
                    const note = G.fitNote(p, slot);
                    return (
                      <button key={slot} className={`slot-chip slot-chip--draft ${!hard && note.kind === 'main' ? 'slot-chip--main' : ''}`} data-sfx="draft" onClick={() => dispatch({ type: 'draft', player: p, slot })}
                        aria-label={`Draft ${p.nick} as ${ROLE_LABEL[slot]}${hard ? '' : `, ${note.text}`}`}>
                        <span><RoleIcon role={slot} size={12} /> Draft as {ROLE_SHORT[slot]}</span>
                        {!hard && <small className={`fit fit--${note.kind}`}>{note.text}</small>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {taken.length > 0 && (
        <ul className="unavailable muted small" aria-label="Unavailable players">
          {taken.map((p) => <li key={p.id}><b>{p.nick}</b>: {unavailableReason(p, s, draftedIds)}</li>)}
        </ul>
      )}
    </div>
  );
}

/** The same reason, short enough to sit under a name on a team card. */
function rowReason(p: Roster['players'][number], s: Run, drafted: Set<string>): string {
  if (drafted.has(p.id)) return 'already on your team';
  if (s.opts?.hard) return 'no open slot left';
  return `${p.roles.map((r) => ROLE_LABEL[r]).join(' and ')} already filled`;
}

/** Why a player can't be picked, exactly (#17). Hard mode doesn't name their roles. */
function unavailableReason(p: Roster['players'][number], s: Run, drafted: Set<string>): string {
  if (drafted.has(p.id)) {
    const pk = s.picks.find((x) => x.playerId === p.id);
    return pk ? `already on your team as ${ROLE_LABEL[pk.slot]}` : 'already on your team';
  }
  if (s.opts?.hard) return 'no open slot left';
  const filled = p.roles.map((r) => ROLE_LABEL[r]).join(' and ');
  return `plays ${filled}, and ${p.roles.length > 1 ? 'those slots are' : 'that slot is'} already filled`;
}

/** Opens the roster-data issue form with this roster filled in (#13). */
const reportUrl = (r: { org: string; year: number; event: string }) =>
  `https://github.com/nanox333/major-mayhem/issues/new?template=roster_data.yml&roster=${encodeURIComponent(`${r.org} ${r.year} (${r.event})`)}`;

/**
 * What a roster selector can tell you before you view it, on a phone (#185): how many of its players can fill a slot you still need, how many of those in
 * their main role and how many as a second role, and how many are already on your team. Counts only: no ratings, and in hard mode no roles.
 */
function cardSummary(r: Roster, s: Run, taken: Set<string>, bench: boolean, hard: boolean): string {
  const open = r.players.filter((p) => (bench ? !taken.has(p.id) : slotsFor(s, p).length > 0));
  const have = r.players.filter((p) => taken.has(p.id)).length;
  if (hard || bench) return `${open.length} you can draft${have ? ` · ${have} already yours` : ''}`;
  const main = open.filter((p) => slotsFor(s, p).includes(p.roles[0])).length;
  const second = open.length - main;
  const parts = [`${main} in their main role`, ...(second ? [`${second} as a 2nd role`] : []), ...(have ? [`${have} already yours`] : [])];
  return open.length ? parts.join(' · ') : `Nobody fits an open slot${have ? ` · ${have} already yours` : ''}`;
}
