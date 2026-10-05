import { usePlaybackCovered } from '../ui/usePlaybackCovered';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ROLE_LABEL, ROLE_SHORT, Roster } from '../data/rosters';
import * as G from '../game/logic';
import { Action, Pending, Run, benchLineup, equalDuel, lineupFor } from '../game/state';
import { Avatar, MapArt, MapShot, RatingMark, RoleIcon, Sr, TeamBadge } from '../ui/art';
import { track } from '../analytics';
import { useChatVote } from '../ui/ChatVote';
import { announceMap, announceSide, fmt, pulse, ratingClass, reduceMotion } from '../ui/util';
import { play } from '../ui/sound';
import { Tip } from '../ui/tips';
import { PauseIcon, PlayIcon } from '../ui/icons';
import { getPrefs } from '../ui/prefs';
import { keyMoments, Moment } from '../game/highlights';
import { LegendOverlay } from '../ui/Legend';
import { BUY_LABEL, BUY_MARK, Buy, economyFor, momentumAt, momentumText } from '../game/momentum';

export function StageTrack({ t, current }: { t: G.Tournament; current?: G.StageKey }) {
  const q = t.qual;
  const playoffs = t.matches.filter((m) => m.stage !== 'QUAL');
  const nodes: { k: G.StageKey; label: string }[] = [{ k: 'QUAL', label: t.qual.need ? 'Swiss' : 'Qual' }, { k: 'QF', label: 'Quarter' }, { k: 'SF', label: 'Semi' }, { k: 'F', label: 'Final' }];
  return (
    <div className="track">
      {nodes.map((n) => {
        const done = n.k === 'QUAL' ? q.w >= G.qualNeed(t) : playoffs.some((m) => m.stage === n.k && m.won);
        const lost = n.k === 'QUAL' ? q.l >= G.qualNeed(t) : playoffs.some((m) => m.stage === n.k && !m.won);
        return (
          <div key={n.k} className={`track__node ${done ? 'is-done' : ''} ${lost ? 'is-lost' : ''} ${current === n.k ? 'is-current' : ''}`}>
            <i>{done ? '✓' : lost ? '✗' : n.k === 'QUAL' ? `${q.w}-${q.l}` : `Bo${G.BEST_OF[n.k]}`}</i>
            <span>{n.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Match-day form as a small tag: ▲▲ hot, ▲ good, ▼ cold. */
function FormTag({ v }: { v?: number }) {
  const label = G.formLabel(v);
  if (label === 'Normal') return null;
  return <em className={`form form--${label.toLowerCase()}`} title={`${label} form today`} role="img" aria-label={`${label} form today`}>{v! > 2 ? '▲▲' : v! > 0 ? '▲' : '▼'}</em>;
}

/** Before a match: everyone's form, and which starter (if any) the bench player replaces. */
function SubPanel({ s, pending, dispatch }: { s: Run; pending: Pending; dispatch: React.Dispatch<Action> }) {
  const bench = benchLineup(s);
  if (!bench || !pending.form) return null;
  const starters = G.lineupFromPicks(s.picks);
  const hard = !!s.opts?.hard;
  // What a sub means before you accept it: the role the bench player takes and how well it fits (#17).
  const tradeoff = (l: G.Lineup) => {
    const note = G.fitNote(bench.player, l.slot);
    return `${bench.player.nick} plays ${ROLE_LABEL[l.slot]} for ${l.player.nick}${hard ? '' : `: ${note.text}`}`;
  };
  const out = starters.find((l) => l.player.id === pending.subOut);
  const outNote = out && !hard ? G.fitNote(bench.player, out.slot) : null;
  const FIT_WORD = { main: 'Main role', secondary: 'Secondary role', off: 'Off-role' } as const;
  return (
    <section className="subs anim-in" aria-label="Bench">
      <header className="subs__head">
        <span className="subs__badge">Bench</span>
        <span className="subs__face"><Avatar player={bench.player} roster={bench.roster} /></span>
        <div className="subs__who">
          <strong>{bench.player.nick}</strong>
          <small>{bench.roster.org} {bench.roster.year} · {G.formLabel(pending.form[bench.player.id])} form <FormTag v={pending.form[bench.player.id]} /></small>
        </div>
        <p className="subs__how">Swap {bench.player.nick} in for <b>one starter</b>, for <b>this match only</b>. He plays that starter's role, and your starters are back for the next match.</p>
      </header>
      <div className="subs__choices" role="group" aria-label="Substitution">
        <button type="button" className={`subs__opt subs__opt--keep ${!pending.subOut ? 'is-on' : ''}`} aria-pressed={!pending.subOut} onClick={() => dispatch({ type: 'sub', out: null })}>
          <small>No change</small><b>Keep starters</b><span>Your five as drafted</span>
        </button>
        {starters.map((l) => {
          const note = hard ? null : G.fitNote(bench.player, l.slot);
          return (
            <button type="button" key={l.player.id} className={`subs__opt ${pending.subOut === l.player.id ? 'is-on' : ''}`} aria-pressed={pending.subOut === l.player.id}
              onClick={() => dispatch({ type: 'sub', out: l.player.id })} title={tradeoff(l)}>
              <small>Sub out</small>
              <span className="subs__nick"><span className="subs__pic"><Avatar player={l.player} roster={l.roster} /></span><b>{l.player.nick}</b><FormTag v={pending.form![l.player.id]} /></span>
              <span className="subs__role"><RoleIcon role={l.slot} size={12} /> {ROLE_SHORT[l.slot]}</span>
              {note && <i className={`subs__fit subs__fit--${note.kind}`}>{bench.player.nick}: {FIT_WORD[note.kind]}</i>}
            </button>
          );
        })}
      </div>
      {/* Always present, so choosing a sub never moves the buttons below it; a live region so the change is announced. */}
      <p className={`subs__tradeoff ${out ? `is-${outNote?.kind ?? 'main'}` : ''}`} aria-live="polite">
        {out && <><span className="subs__swap"><b>{bench.player.nick}</b><i aria-hidden="true">⇄</i><s>{out.player.nick}</s></span><span>{hard || !outNote ? 'for this match' : outNote.text}</span></>}
      </p>
      <Tip id="form" title="Match-day form">The arrows show how each player is playing today: ▲▲ hot, ▲ good, ▼ cold. Your bench player can replace one starter for this match only, and takes that starter's role.</Tip>
    </section>
  );
}

export function PreviewScreen({ mine: starters, s, pending, t, dispatch }: { mine: G.Lineup[]; s: Run; pending: Pending; t: G.Tournament; dispatch: React.Dispatch<Action> }) {
  const mine = useMemo(() => (pending.form ? lineupFor(s, pending.subOut, undefined) : starters), [starters, pending.subOut, pending.form]);
  const opp = G.rosterById.get(pending.oppId)!;
  const oppL = useMemo(() => G.naturalLineup(opp), [opp]);
  const [found, setFound] = useState(false);
  useEffect(() => { setFound(false); const tm = setTimeout(() => setFound(true), reduceMotion() ? 0 : 1500); return () => clearTimeout(tm); }, [pending.oppId]);
  useEffect(() => { if (found) play('found'); }, [found]);
  return (
    <div className="stack">
      {pending.stage !== 'DUEL' && <StageTrack t={t} current={pending.stage} />}
      {!found ? (
        <div className="searching anim-in">
          <span className="searching__ring" />
          <strong>Searching for opponent</strong>
          <small>{G.STAGE_NAME[pending.stage]} · Best of {G.bestOfFor(pending.stage, t)}</small>
        </div>
      ) : (
        <div className="match-found anim-in">
          <header className="match-found__head">
            <div className="match-found__title">Your match is ready</div>
          </header>
          <div className="versus">
            <div className="versus__side versus__side--t">
              <header><i className="side-chip">T</i><span className="versus__id"><b>Your team</b><small>Your lineup</small></span></header>
              <ul>{mine.map((l) => <li key={l.player.id}><span className="vs__pic"><Avatar player={l.player} roster={l.roster} /></span><b>{l.player.nick}</b><span className="vs__role"><RoleIcon role={l.slot} size={12} /> {ROLE_SHORT[l.slot]}</span><FormTag v={pending.form?.[l.player.id]} /></li>)}</ul>
            </div>
            <div className="versus__vs" aria-hidden="true">VS</div>
            <div className="versus__side versus__side--ct">
              <header><i className="side-chip">CT</i><span className="versus__team"><TeamBadge roster={opp} size={28} /><span className="versus__id"><b>{opp.org} {opp.year}</b><small>{opp.result} · {opp.event}</small></span></span></header>
              <ul>{oppL.map((l) => <li key={l.player.id}><span className="vs__pic"><Avatar player={l.player} roster={l.roster} /></span><b>{l.player.nick}</b><span className="vs__role"><RoleIcon role={l.slot} size={12} /> {ROLE_SHORT[l.slot]}</span></li>)}</ul>
            </div>
          </div>
          <SubPanel s={s} pending={pending} dispatch={dispatch} />
          {equalDuel(s) && <p className="muted small duel-rules">Equal terms: no match-day form, substitutions or tactical calls for either team. Maps and sides are chosen by the same rule, and the first ban goes to a coin flip.</p>}
          <div className="action-bar">
            <div className="accept-bar"><span /></div>
            <button className="cta cta--go" data-sfx="accept" onClick={() => dispatch({ type: 'start' })}>Accept</button>
          </div>
        </div>
      )}
    </div>
  );
}

const MOMENT_MARK: Record<Moment['kind'], string> = { mvp: '★', legend: '✦', pistol: '◆', clutch: '⚡', run: '»', half: '‖', comeback: '↗', ot: '+' };
/** The moments that decided a finished map: the MVP up front, then pistols, clutches, runs and the half in round order. */
function Moments({ game, theirTag, mine }: { game: G.MapGame; theirTag: string; mine: G.Lineup[] }) {
  const all = keyMoments(game, theirTag);
  const list = all.filter((x) => x.kind !== 'mvp');
  const star = [...game.stats.mine].sort((x, y) => y.rating - x.rating)[0];
  const who = star && mine.find((l) => l.player.id === star.id);
  return (
    <section className="moments" aria-label="Key moments">
      <h3 className="moments__head">Key moments<small>{game.map} · {game.score[0]}–{game.score[1]}</small></h3>
      <div className="moments__grid">
        {star && who && (
          <div className="mvp">
            <span className="mvp__pic"><Avatar player={who.player} roster={who.roster} /></span>
            <span className="mvp__tag">Map MVP</span>
            <b className="mvp__nick">{star.nick}</b>
            <span className="mvp__rating">{fmt(star.rating)}<small>rating</small></span>
            <span className="mvp__kd"><b>{star.k}</b> kills <i>·</i> <b>{star.d}</b> deaths</span>
          </div>
        )}
        <ol className="mline">
          {list.map((x, i) => (
            <li key={`${x.kind}${x.round}${i}`} className={`moment moment--${x.kind} ${x.good === true ? 'is-good' : x.good === false ? 'is-bad' : ''}`} style={{ animationDelay: `${i * 70}ms` }}>
              <span className="moment__round">{x.round ? <><small>Round</small>{x.round}</> : <small>Map</small>}</span>
              <span className="moment__mark" aria-hidden="true">{MOMENT_MARK[x.kind]}</span>
              <span className="moment__body"><b>{x.title}</b><span>{x.text}</span></span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Scoreboard({ game, opp, mine }: { game: G.MapGame; opp: Roster; mine: G.Lineup[] }) {
  const rows = (list: G.PlayerStat[]) => [...list].sort((a, b) => b.rating - a.rating);
  const teamOf = (id: string) => mine.find((x) => x.player.id === id)?.roster;
  return (
    <div className="sb anim-in">
      <div className="sb__head"><span>{game.map}</span><b className={game.won ? 'w' : 'l'}>{game.won ? '✓' : '✗'} {game.score[0]}–{game.score[1]}<Sr> {game.won ? 'won' : 'lost'}</Sr></b></div>
      <table>
        <thead><tr><th>Your team</th><th>K</th><th>D</th><th>Rating</th></tr></thead>
        <tbody>{rows(game.stats.mine).map((p) => (
          <tr key={p.id}><td><span className="sb__tag">{teamOf(p.id)?.tag}</span>{p.nick}</td><td>{p.k}</td><td>{p.d}</td><td className={ratingClass(p.rating)}>{fmt(p.rating)}<RatingMark r={p.rating} /></td></tr>
        ))}</tbody>
        <thead><tr className="ct"><th>{opp.org} {opp.year}</th><th>K</th><th>D</th><th>Rating</th></tr></thead>
        <tbody>{rows(game.stats.opp).map((p) => (
          <tr key={p.id} className="ct"><td>{p.nick}</td><td>{p.k}</td><td>{p.d}</td><td className={ratingClass(p.rating)}>{fmt(p.rating)}<RatingMark r={p.rating} /></td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/** Playback speeds (#16). */
const SPEEDS = [0.35, 0.7, 1.4];
/** 1× is the tactical pace (slow enough to read the feed and make calls); the others are only a little faster. */
const speedLabel = (v: number) => `${Math.round(v / SPEEDS[0])}×`;
const loadSpeed = () => { try { const v = Number(localStorage.getItem('mm-speed')); return SPEEDS.includes(v) ? v : SPEEDS[0]; } catch { return SPEEDS[0]; } };
/** What each kind of buy means, in a line. */
const BUY_NOTE: Record<Buy, string> = {
  full: 'Rifles, armor and utility: the normal strength.',
  force: 'Everything spent on a weaker buy: a fair chance now, but broke if it fails.',
  eco: 'Saving: pistols and light guns, a small chance, and the money carries over.',
};
const sideCls = (side: G.Side) => (side === 'T' ? 't' : 'ct');
const KF_CLASS = (e: G.MatchEvent) =>
  e.kind === 'half' || e.kind === 'ot' || e.kind === 'call' ? 'kf--half'
    : e.kind === 'legend' ? 'kf--legend'
    : e.kind === 'clutch' ? 'kf--clutch'
      : `${e.good ? 'kf--us' : 'kf--them'}${e.kind === 'pistol' ? ' kf--pistol' : ''}`;

/** Who a killfeed line favours, as a mark and in words, so the green or red border isn't the only signal (#22). Neutral lines get none. */
const kfMark = (e: G.MatchEvent) => (e.kind === 'half' || e.kind === 'ot' || e.kind === 'call' ? null : e.good
  ? <><i aria-hidden="true"> ▲</i><Sr> for you</Sr></> : <><i aria-hidden="true"> ▼</i><Sr> against you</Sr></>);

/**
 * Where playback of the current map had got to, kept apart from the (much bigger) run save so it can be written every
 * round. After a reload the map resumes there instead of replaying rounds you've already seen.
 */
const SEEN_KEY = 'mm-seen';
const seenKey = (t: G.Tournament, m: G.Match, mapIdx: number) => `${t.matches.length}:${mapIdx}:${m.form}`;
const loadPlayback = (key: string): { n: number; paused: boolean; bought: number[] } => {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null');
    if (v?.key === key) return { n: Number(v.n) || 0, paused: v.paused === true, bought: Array.isArray(v.bought) ? v.bought.filter((n: unknown) => n === 1 || n === 13) : [] };
  } catch { /* first playback */ }
  return { n: 0, paused: false, bought: [] };
};

export function LiveScreen({ mine, m, t, coach, dispatch, board }: { mine: G.Lineup[]; m: G.Match; t: G.Tournament; coach?: string | null; dispatch: React.Dispatch<Action>; board?: React.ReactNode }) {
  const opp = G.rosterById.get(m.opponentId)!;
  const [mapIdx, setMapIdx] = useState(() => Math.max(0, m.maps.length - 1));
  const [n, setN] = useState(() => loadPlayback(seenKey(t, m, Math.max(0, m.maps.length - 1))).n);
  /** Pistol rounds (1 or 13) where you already answered the save-or-force question on this map. */
  const [bought, setBought] = useState<number[]>(() => loadPlayback(seenKey(t, m, Math.max(0, m.maps.length - 1))).bought);
  const [speed, setSpeed] = useState(loadSpeed);
  /** Paused playback waits for Resume or Next round (#16). */
  const [paused, setPaused] = useState(() => loadPlayback(seenKey(t, m, Math.max(0, m.maps.length - 1))).paused);
  const covered = usePlaybackCovered();
  const [allRounds, setAllRounds] = useState(false);
  /** The legendary moment on screen, if one is playing: playback waits for it (#293). */
  const [legend, setLegend] = useState<G.MatchEvent | null>(null);
  const game: G.MapGame | undefined = m.maps[mapIdx];
  const total = game?.rounds.length ?? 0;
  const mapDone = !!game && n >= total;
  const seriesDone = m.done && mapDone && mapIdx === m.maps.length - 1;
  const mapName = game?.map ?? m.next?.map ?? '';
  const replay = useVetoReplay(m);
  const vetoing = m.pool.length === 0 || replay.holding;
  const lastMap = mapIdx === m.maps.length - 1;
  // After a lost pistol round, playback waits for your buy: save for the full buy, or force.
  const buyQuestion = !!game && lastMap && !mapDone && (n === 1 || n === 13) && !game.rounds[n - 1] && !bought.includes(n)
    && G.canCall(m, { kind: 'force', round: n });

  useEffect(() => {
    if (!game || mapDone || buyQuestion || paused || covered || legend) return;
    const tm = setTimeout(() => setN((x) => x + 1), n === 0 ? 650 : reduceMotion() ? 40 : 230 / speed);
    return () => clearTimeout(tm);
  }, [n, mapDone, mapIdx, !!game, speed, buyQuestion, paused, covered, legend]);
  // Space pauses and resumes, T calls a timeout, the right arrow steps one round while paused (desktop and streamers).
  const callTimeout = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!game || mapDone) return;
    const onKey = (e: KeyboardEvent) => {
      if (!getPrefs().shortcuts || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('[role="dialog"]')) return;
      if ((e.target as HTMLElement)?.closest('input, textarea, button, select')) return;
      if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
      if (e.key === 'ArrowRight' && paused && !buyQuestion) setN((x) => Math.min(x + 1, total));
      if ((e.key === 't' || e.key === 'T') && callTimeout.current) { e.preventDefault(); callTimeout.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [!!game, mapDone, paused, buyQuestion, total]);
  useEffect(() => { if (game && lastMap) { try { localStorage.setItem(SEEN_KEY, JSON.stringify({ key: seenKey(t, m, mapIdx), n: Math.min(n, total), paused, bought })); } catch { /* session playback still works */ } } }, [n, mapIdx, lastMap, total, paused, bought]);
  const previousMap = useRef(mapIdx);
  useEffect(() => { if (previousMap.current !== mapIdx) { setBought([]); setPaused(false); setAllRounds(false); previousMap.current = mapIdx; } }, [mapIdx]);
  const call = (kind: G.Call['kind']) => {
    if (kind === 'force' || buyQuestion) setBought((b) => [...b, n]);
    dispatch({ type: 'call', call: { kind, round: n } });
    track('call', { kind, round: n, stage: m.stage });
  };
  // An equal-conditions showmatch has no tactical calls for either team (#172).
  const noCalls = G.equalShowmatch(m.stage);
  const canTimeout = !!game && lastMap && !mapDone && n >= 1 && G.canCall(m, { kind: 'timeout', round: n });
  callTimeout.current = canTimeout ? () => call('timeout') : null;
  useChatVote(buyQuestion ? `buy-${m.form}-${mapIdx}-${n}` : null,
    [{ id: 'save', label: 'Save (eco)', aliases: ['save', 'eco'] }, { id: 'force', label: 'Force buy', aliases: ['force', 'force buy'] }],
    (id) => (id === 'force' ? call('force') : setBought((b) => [...b, n])));
  // The opponent's current run of rounds, which a timeout stops.
  let theirRun = 0;
  if (game) for (let i = Math.min(n, total) - 1; i >= 0 && !game.rounds[i]; i--) theirRun++;
  // The run only makes the feed while a timeout is there to answer it; once it's called, the feed shows the timeout instead.
  const nudge = theirRun >= 3 && canTimeout;

  // pulse the map token of whoever made the highlight this round
  const shown = game ? game.events.filter((e) => e.round <= n) : [];
  useEffect(() => {
    const e = game?.events.find((x) => x.round === n && x.playerId);
    if (e?.playerId) pulse(e.playerId, e.good);
  }, [n, mapIdx]);
  // Sound: a blip as each round is played (only when playback moves on by one, so skipping ahead stays quiet), a sting for a
  // clutch or the half, and a jingle when the map ends.
  const prevN = useRef(n);
  useEffect(() => {
    const from = prevN.current;
    prevN.current = n;
    if (!game || n !== from + 1 || n > total) return;
    const evs = game.events.filter((e) => e.round === n);
    // A legendary round takes the screen (only when you watch it arrive, never when a saved map resumes or is skipped).
    const legendary = evs.find((e) => e.kind === 'legend');
    if (legendary) { setLegend(legendary); play('legend'); return; }
    play(evs.some((e) => e.kind === 'clutch' && e.good) ? 'clutch' : game.rounds[n - 1] ? 'roundWin' : 'roundLoss');
    if (evs.some((e) => e.kind === 'half' || e.kind === 'ot')) play('half', { delay: 250 });
  }, [n]);
  useEffect(() => { if (game && mapDone) play(game.won ? 'mapWin' : 'mapLose', { delay: 350 }); }, [mapDone, mapIdx]);
  // Your side for the round being played (sides swap at halftime and in overtime).
  const side: G.Side = game ? G.sideAt(Math.min(n, total - 1), game.start) : 'T';
  useEffect(() => { announceMap(mapName || null); }, [mapName]);
  useEffect(() => { announceSide(side); }, [side]);
  useEffect(() => () => { announceMap(null); announceSide('T'); }, []);

  const a = game ? game.rounds.slice(0, n).filter(Boolean).length : 0;
  const b = (game ? Math.min(n, total) : n) - a; // a saved position past the map's last round must not count extra rounds for the opponent
  const mapsWon = m.maps.slice(0, mapIdx + (mapDone ? 1 : 0)).filter((g) => g.won).length;
  const mapsLost = Math.min(mapIdx + (mapDone ? 1 : 0), m.maps.length) - mapsWon;
  const next = seriesDone ? G.nextStage(G.applyResult(t, m)) : null;
  const series = G.seriesRatings(m.maps, 'mine');
  const setSpeedSaved = (v: number) => { setSpeed(v); track('speed', { speed: v }); try { localStorage.setItem('mm-speed', String(v)); } catch { /* storage unavailable */ } };
  const ot = total > 24 && n > 24;
  const liveRoot = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = dock.current;
    if (!el) return;
    const size = () => liveRoot.current?.style.setProperty('--match-dock-height', `${el.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(size);
    observer.observe(el); size();
    return () => observer.disconnect();
  }, [!!game, mapDone, buyQuestion]);
  // On a short phone screen the dock sits in the page, under the radar, so a buy question could appear below the fold: bring it into view.
  useEffect(() => { if (buyQuestion) dock.current?.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); }, [buyQuestion]);
  const playbackState = vetoing ? 'Map veto' : !game ? 'Ready' : mapDone ? 'Map complete' : buyQuestion ? 'Buy decision' : covered ? 'Playback covered' : paused ? 'Paused' : 'Playing';

  return (
    <div ref={liveRoot} data-play={paused || buyQuestion || legend ? 'paused' : 'playing'} className={`stack match-live ${vetoing || !game || mapDone ? 'match-live--decision' : ''}`}>
      <div className={`hud ${vetoing ? 'hud--veto' : ''}`}>
        <div className="hud__meta">{G.STAGE_NAME[m.stage]} · Bo{m.bestOf}{vetoing ? ' · Map veto' : `${m.bestOf === 3 ? ` · Map ${mapIdx + 1}` : ''} · ${mapName}${game ? ` · Round ${Math.min(n, total)}` : ''}${ot ? ' · OT' : ''}`}</div>
        <p className="match-state">{playbackState}</p>
        <div className="hud__score">
          <div className={`hud__team hud__team--${sideCls(side)}`}><i className="side-chip">{side}</i><span className="hud__org">Your team</span><span className="hud__tag">You</span>{m.bestOf === 3 && <em>{mapsWon}</em>}</div>
          <div className="hud__nums">
            <b key={`a${a}`} className={`${sideCls(side)} ${a ? 'pop' : ''}`}>{a}</b>
            <i>:</i>
            <b key={`b${b}`} className={`${sideCls(G.otherSide(side))} ${b ? 'pop' : ''}`}>{b}</b>
          </div>
          <div className={`hud__team hud__team--${sideCls(G.otherSide(side))}`}>
            {m.bestOf === 3 && <em>{mapsLost}</em>}<TeamBadge roster={opp} size={20} />
            <span className="hud__org">{opp.org} {opp.year}</span><span className="hud__tag">{opp.tag}</span>
            <i className="side-chip">{G.otherSide(side)}</i>
          </div>
        </div>
        <div className="rounds" aria-hidden="true">
          {Array.from({ length: Math.max(24, total) }, (_, i) => {
            // Pistol rounds are notched, before and after they're played; a clutch gets a dot once it has happened.
            const pistol = i === 0 || i === 12 ? ' pistol' : '';
            if (!game || i >= n) return <i key={i} className={pistol || undefined} />;
            // Coloured by the side that won the round, like the in-game round history; your losses are dimmed.
            const ours = G.sideAt(i, game.start);
            const clutch = game.events.some((e) => e.kind === 'clutch' && e.round === i + 1) ? ' clutch' : '';
            const legendary = game.events.some((e) => e.kind === 'legend' && e.round === i + 1) ? ' is-legend' : '';
            return <i key={i} className={`${game.rounds[i] ? sideCls(ours) : `${sideCls(G.otherSide(ours))} lost`}${pistol}${clutch}${legendary}${i === n - 1 ? ' new' : ''}`} title={`Round ${i + 1}${pistol ? ' · pistol' : ''}${clutch ? ' · clutch' : ''}${legendary ? ' · legendary' : ''}`} />;
          })}
        </div>
        {m.bestOf === 3 && !vetoing && (
          <div className="maps">
            {[0, 1, 2].map((i) => {
              const g = m.maps[i];
              const played = g && (i < mapIdx || (i === mapIdx && mapDone));
              const name = g?.map ?? (i === m.maps.length && m.next ? m.next.map : m.pool[i]);
              return (
                <span key={i} className={`maps__pill ${i === mapIdx ? 'is-now' : ''} ${played ? (g.won ? 'w' : 'l') : ''}`}>
                  {played && <>{g.won ? '✓' : '✗'} </>}{i === 2 && !g ? `Decider · ${name}` : name}{played ? ` ${g.score[0]}–${g.score[1]}` : ''}{played && <Sr> {g.won ? 'won' : 'lost'}</Sr>}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {vetoing ? (
        <VetoPanel m={{ ...m, veto: replay.veto }} opp={opp} mine={mine} dispatch={dispatch} latest={replay.latest} />
      ) : !game ? (
        m.next && <><SeriesPreview m={m} opp={opp} /><KnifePanel k={m.next} opp={opp} mine={mine} mapNo={mapIdx + 1} bestOf={m.bestOf} voteKey={`side-${m.form}-${m.maps.length}`} auto={!!m.veto.auto} dispatch={dispatch} /></>
      ) : !mapDone ? (
        <div className="match-workspace">
          <aside className="match-five" aria-label="Your fielded five"><h3>Your fielded five · {side}</h3>{mine.map((x) => <div key={x.player.id}><Avatar player={x.player} roster={x.roster} /><span><b>{x.player.nick}</b><small>{ROLE_SHORT[x.slot]} · {x.roster.org} {x.roster.year}</small></span><FormTag v={m.playerForm?.[x.player.id] ?? 0} /></div>)}</aside>
          <div className="match-centre">{board}
          {/* Everything you can press sits above the killfeed, so the feed can grow downward without moving a button. */}
          <div className="match-dock" ref={dock}>
          {buyQuestion && (
            <div className="buy anim-in" role="group" aria-label="Buy after the lost pistol">
              <div className="buy__head">
                <strong>Pistol lost: what do you buy?</strong>
                <p>This decides the next two rounds. Compare them before you pick.</p>
              </div>
              <div className="buy__opts">
                <button className="buy__opt buy__opt--eco" data-sfx="call" onClick={() => setBought((b) => [...b, n])}>
                  <span className="buy__name"><i aria-hidden="true">$</i>Eco<small>Save the money</small></span>
                  <ol className="buy__plan" aria-label="Strength of the next three rounds">
                    <li className="is-weak"><b>Next</b><i /><span>Weak</span></li>
                    <li className="is-mid"><b>After</b><i /><span>Below</span></li>
                    <li className="is-full"><b>Then</b><i /><span>Full</span></li>
                  </ol>
                  <span className="buy__why">Safe: weak now and a little weak next round, then full.</span>
                </button>
                <button className="buy__opt buy__opt--force" data-sfx="call" onClick={() => call('force')}>
                  <span className="buy__name"><i aria-hidden="true">$$</i>Force buy<small>Spend it all</small></span>
                  <ol className="buy__plan" aria-label="Strength of the next three rounds">
                    <li className="is-mid"><b>Next</b><i /><span>Better</span></li>
                    <li className="is-gamble"><b>After</b><i /><span>Win: full · Lose: broke</span></li>
                    <li className="is-full"><b>Then</b><i /><span>Full</span></li>
                  </ol>
                  <span className="buy__why">Risky: a real chance now. Win and you recover; lose and you are worse off than saving.</span>
                </button>
              </div>
              <button className="ghost-btn buy__skip" onClick={() => setN(total)}>Skip map</button>
            </div>
          )}
          <div className="controls">
            {/* Every control keeps its place whatever is happening: the ones that do not apply are hidden, not removed, so nothing moves when you pause, resume or answer a buy. */}
            {!noCalls && <div className={`calls ${buyQuestion ? 'is-away' : ''}`} aria-hidden={buyQuestion || undefined}>
              <button className={`ghost-btn calls__timeout ${nudge ? 'is-nudge' : ''}`} data-sfx="call" onClick={() => call('timeout')} disabled={!canTimeout || buyQuestion} tabIndex={buyQuestion ? -1 : undefined}
                title={`One per half. Stops the opponent's run and gives your next three rounds a clear lift${coach ? `; ${coach} makes it count for more` : ''}.`}>
                Call timeout
              </button>
              <span className={`small muted ${canTimeout ? 'is-away' : ''}`}>{n < 1 ? 'Available after the first round' : 'Timeout used this half'}</span>
            </div>}
            <div className="playback">
              <button className="ghost-btn playback__pause" aria-pressed={paused} onClick={() => setPaused((p) => !p)} title="Space">{paused ? <><PlayIcon size={14} /> Resume</> : <><PauseIcon size={14} /> Pause</>}</button>
              <button className={`ghost-btn playback__next ${paused ? '' : 'is-away'}`} disabled={buyQuestion || !paused} aria-hidden={!paused || undefined} tabIndex={paused ? undefined : -1} onClick={() => setN((x) => Math.min(x + 1, total))} title="Right arrow">Next round ›</button>
              <div className="speed" role="group" aria-label="Playback speed">
                {SPEEDS.map((v) => <button key={v} className={speed === v ? 'is-on' : ''} aria-pressed={speed === v} onClick={() => setSpeedSaved(v)}>{speedLabel(v)}</button>)}
              </div>
              <button className={`ghost-btn playback__skip ${buyQuestion ? 'is-away' : ''}`} aria-hidden={buyQuestion || undefined} tabIndex={buyQuestion ? -1 : undefined} disabled={buyQuestion} title="Reveal this map’s simulated result; this does not forfeit" onClick={() => setN(total)}>Skip map</button>
            </div>
            <p className={`muted small playback__note ${paused ? '' : 'is-away'}`} aria-hidden={!paused || undefined}>Paused after round {Math.min(n, total)}.{noCalls ? '' : ' Timeouts can still be called.'}</p>
          </div>
          </div>
          </div>
          {!buyQuestion && !noCalls && <Tip id="calls" title="Timeouts and buys">You get one timeout per half: it stops the opponent's run and lifts your next three rounds. After a lost pistol you choose whether to save or force buy. You can pause, step through rounds and slow the playback whenever you like.</Tip>}
          <section className="match-feed" aria-label="Round log">
          <div className="feed-heading"><h3>Round log</h3><button className="ghost-btn" onClick={() => setAllRounds((v) => !v)} aria-pressed={allRounds}>{allRounds ? 'Latest only' : 'All rounds'}</button></div>
          <p className="sr" role="status">Round {n}. You {a}, {opp.tag} {b}.{nudge ? ' Timeout available.' : ''}</p>
          <RoundLog game={game} n={n} all={allRounds} theirTag={opp.tag} run={nudge ? { who: opp.tag, rounds: theirRun } : null} onLegend={setLegend} />
          <Momentum rounds={game.rounds} n={n} total={total} forced={game.calls?.force ?? []} theirTag={opp.tag} />
          <TimeoutAftermath game={game} n={n} theirTag={opp.tag} />
          <BuyAftermath game={game} n={n} theirTag={opp.tag} />
          </section>
        </div>
      ) : (
        <>
          {seriesDone && (
            <div className={`result-stamp ${m.won ? 'w' : 'l'}`}>{m.won ? 'Victory' : 'Defeat'} {m.score[0]}–{m.score[1]}</div>
          )}
          <Moments game={game} theirTag={opp.tag} mine={mine} />
          <Scoreboard game={game} opp={opp} mine={mine} />
          <Tip id="rating" title="Match rating">1.00 is an average map. ▲ marks a rating well above that and ▼ well below. Stronger players tend to rate higher, but anyone can have a bad map.</Tip>
          {seriesDone && m.bestOf === 3 && (
            <p className="muted small">Series ratings: {mine.map((x) => `${x.player.nick} ${fmt(series[x.player.id].rating)}`).join(' · ')}</p>
          )}
          <div className="action-bar">
            {seriesDone ? (
              <button className="cta cta--orange" onClick={() => dispatch({ type: 'next' })}>{next ? 'Next match' : 'See results'}</button>
            ) : (
              <button className="cta cta--orange" onClick={() => { setMapIdx((i) => i + 1); setN(0); }}>Next map</button>
            )}
          </div>
        </>
      )}
      {legend && <LegendOverlay e={legend} mine={mine} map={game?.map ?? mapName} onDone={() => setLegend(null)} />}
    </div>
  );
}

/** Before each map: the knife round. Win it and you pick the starting side; lose it and the opponent picks. */
function SeriesPreview({ m, opp }: { m: G.Match; opp: Roster }) {
  if (m.bestOf === 1) return null;
  return <ol className="veto-series" aria-label="Series maps">{G.vetoMaps(m.veto).map((x, i) => <li key={x.map} className={x.map === m.next?.map ? 'is-now' : ''}>
    <MapShot map={x.map} /><b>{x.by === 'decider' ? 'Decider' : `Map ${i + 1}`}: {x.map}</b>
    <span>{x.by === 'decider' ? 'Knife round decides sides' : `${x.by === 'us' ? 'You' : opp.tag} picked · ${m.veto.auto ? 'the other team takes its stronger side' : `${x.by === 'us' ? opp.tag : 'You'} choose sides`}`}</span>
  </li>)}</ol>;
}

function KnifePanel({ k, opp, mine, mapNo, bestOf, voteKey, auto, dispatch }: {
  k: G.Knife; opp: Roster; mine: G.Lineup[]; mapNo: number; bestOf: number; voteKey: string; /** An equal-conditions showmatch: both teams take their stronger side, so there is nothing to choose. */ auto: boolean; dispatch: React.Dispatch<Action>;
}) {
  const left = G.otherSide(k.oppPick);
  // Where each team starts when you don't choose: the side the opponent left you, or (taking the stronger side automatically) your best one.
  const yours = k.won ? k.best : left, theirs = G.otherSide(yours);
  useChatVote(k.won && !auto ? voteKey : null, [{ id: 'T', label: 'T · attack', aliases: ['t', 'attack'] }, { id: 'CT', label: 'CT · defend', aliases: ['ct', 'defend'] }],
    (id) => dispatch({ type: 'side', side: id as G.Side }));
  const title = k.how === 'our-pick' ? (auto ? `Your pick: ${opp.org} take ${theirs}` : `Your pick: ${opp.org} choose sides`)
    : k.how === 'their-pick' ? (auto ? `${opp.org}'s pick: you take ${yours}` : `${opp.org}'s pick: you choose sides`)
      : k.won ? 'You won the knife!' : `${opp.org} won the knife`;
  const label = k.how === 'knife' ? (bestOf === 3 ? 'Decider · Knife round' : 'Knife round') : 'Side choice';
  const lean = G.sideLean(k.map);
  const SIDE_NOTE = { T: 'You attack first. Sides swap at halftime.', CT: 'You defend first. Sides swap at halftime.' } as const;
  return (
    <div className={`knife knife--page anim-in ${k.won ? 'is-won' : 'is-lost'}`}>
      <header className="knife__banner">
        <span className="knife__badge" aria-hidden="true">
          {k.how === 'knife'
            ? <><svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><g transform="rotate(24 24 25)"><path d="M24 2l5.6 19h-11.2z" /><path d="M16 21h16v3.6H16z" /><path d="M21 24.6h6v15H21z" /><circle cx="24" cy="42.4" r="3" /></g></svg><b>{k.won ? 'Won' : 'Lost'}</b></>
            : <><i>⇄</i><b>Sides</b></>}
        </span>
        <div className="knife__says">
          <small className="knife__kicker">{bestOf === 3 ? `Map ${mapNo} · ` : ''}{k.map} · {label}</small>
          <strong className="knife__title">{title}</strong>
          <span className="knife__who">{auto ? 'Both teams take their stronger side' : k.won ? 'You choose the starting side' : `${opp.tag} choose the starting side`}</span>
          <p className="knife__advice">{G.sideAdvice(k, mine)} Whoever leads at halftime carries momentum into the second half.</p>
        </div>
        <span className="knife__ghost" aria-hidden="true">{k.how === 'knife' ? (k.won ? 'WON' : 'LOST') : 'SIDES'}</span>
      </header>
      <div className="knife__layout">
        <div className="knife__choose">
          {k.won && !auto ? (
            <>
              <p className="knife__ask">Choose your starting side</p>
              <div className="knife__pick">
                {(['T', 'CT'] as const).map((sd) => (
                  <button key={sd} className={`side-btn side-btn--${sd === 'T' ? 't' : 'ct'}`} onClick={() => dispatch({ type: 'side', side: sd })}>
                    <b>{sd}</b><span>{sd === 'T' ? 'Start attacking' : 'Start defending'}</span>
                    <small>{SIDE_NOTE[sd]}</small>
                    {k.best === sd && <i className="side-btn__best">★ Your stronger side</i>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="knife__ask">{k.won ? `You start on ${yours}, your stronger side` : `${opp.tag} chose ${k.oppPick}`}</p>
              <div className="knife__pick knife__pick--set">
                <div className={`side-btn side-btn--${theirs === 'T' ? 't' : 'ct'} is-theirs`}><b>{theirs}</b><span>{opp.tag} start here</span><small>{theirs === 'T' ? 'They attack first.' : 'They defend first.'}</small></div>
                <div className={`side-btn side-btn--${yours === 'T' ? 't' : 'ct'} is-yours`}><b>{yours}</b><span>You start here</span><small>{SIDE_NOTE[yours]}</small>{k.best === yours && <i className="side-btn__best">★ Your stronger side</i>}</div>
              </div>
              <div className="action-bar knife__go"><button className="cta cta--orange" onClick={() => dispatch({ type: 'side', side: yours })}>Go live</button></div>
            </>
          )}
          <Tip id="knife" title="The knife round">It decides who picks the starting side: T attacks and CT defends, and sides swap at halftime. Rounds 1 and 13 are pistol rounds, and the team that loses one is on an eco for the next two rounds.</Tip>
        </div>
        <figure className="knife__map">
          <MapShot map={k.map} />
          <figcaption><b>{k.map}</b><span>{lean}</span></figcaption>
        </figure>
      </div>
    </div>
  );
}

/**
 * The veto as the player sees it. The game applies your ban and the opponent's answers in one go, so this plays them back one at a time: your step at once,
 * a pause while the opponent "thinks" before each of theirs, and a hold at the end so the last step lands before the knife round takes over.
 * It only changes when things appear; what was banned or picked is exactly what the game decided.
 */
const THINK_MS = 1150, SETTLE_MS = 3200;
function useVetoReplay(m: G.Match) {
  const finished = m.pool.length > 0;
  // A veto that is already settled when the screen opens (a reload, history) is shown as it is, with no replay.
  // An automatic veto (equal-conditions showmatch) is complete the moment the match is set up, so it is played back from the start the first time it is seen.
  const unseen = !!m.veto.auto && m.maps.length === 0;
  const [shown, setShown] = useState(unseen ? 0 : m.veto.steps.length);
  const [released, setReleased] = useState(finished && !unseen);
  const target = m.veto.steps.length;
  const quick = reduceMotion();
  useEffect(() => {
    if (quick) { setShown(target); if (finished) setReleased(true); return; }
    if (shown >= target) return;
    const next = m.veto.steps[shown];
    // In an equal-conditions showmatch neither team is yours to move, so both get the pause.
    const auto = !!m.veto.auto;
    const t = setTimeout(() => { setShown(shown + 1); if (next.team === 'them' || auto) play('ban'); }, shown === 0 || (next.team === 'us' && !auto) ? 0 : THINK_MS);
    return () => clearTimeout(t);
  }, [shown, target, quick]);
  useEffect(() => {
    if (!finished || released || shown < target) return;
    const t = setTimeout(() => setReleased(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, [finished, released, shown, target]);
  const steps = m.veto.steps.slice(0, shown);
  const veto: G.Veto = { order: m.veto.order, auto: m.veto.auto, steps, left: G.MAPS.filter((x) => !steps.some((st) => st.map === x)) };
  const holding = finished && !released;
  return { veto, holding, latest: steps[steps.length - 1] as G.VetoStep | undefined };
}

/** The map veto before a series: bans (and picks in a Bo3), with each team's comfort on every map. */
function VetoPanel({ m, opp, mine, dispatch, latest }: { m: G.Match; opp: Roster; mine: G.Lineup[]; dispatch: React.Dispatch<Action>; /** The step that just landed, so its card can play its animation. */ latest?: G.VetoStep }) {
  const oppL = useMemo(() => G.naturalLineup(opp), [opp]);
  const t = G.vetoTurn(m.veto);
  const auto = !!m.veto.auto;
  const mineTurn = !auto && t?.team === 'us';
  const waiting = !!t && !mineTurn;
  const actor = t?.team === 'us' ? 'You' : opp.tag;
  const done = (map: string) => m.veto.steps.find((x) => x.map === map);
  useChatVote(mineTurn ? `veto-${m.form}-${m.veto.steps.length}` : null,
    G.MAPS.filter((map) => m.veto.left.includes(map)).map((map) => ({ id: map, label: map, aliases: [map, ...(map === 'Dust2' ? ['d2', 'dust'] : [])] })),
    (map) => dispatch({ type: 'veto', map }));
  const who = (team: G.Team) => (team === 'us' ? 'You' : opp.tag);
  const next = G.vetoNextTurn(m.veto);
  const grid = useRef<HTMLUListElement>(null);
  const committing = useRef(false);
  useEffect(() => { committing.current = false; }, [m.veto.steps.length]);
  const commit = (map: string) => {
    if (committing.current) return;
    committing.current = true;
    dispatch({ type: 'veto', map });
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true }));
  };
  const EDGE_TEXT = { us: '▲ Your edge', them: `▼ ${opp.tag} edge`, even: '= Even' } as const;
  // What the click does, and what follows it (#65).
  const consequence = !t ? '' : t.action === 'ban'
    ? `Banning removes a map for both teams.${next ? ` Then ${next.team === 'us' ? 'you' : opp.tag} ${next.action}${next.team === 'us' ? '' : 's'}.` : ' The map left over is played.'}`
    : `Picking makes it a map in the series; ${opp.tag} will choose the starting side on it.${next ? ` Then ${next.team === 'us' ? 'you' : opp.tag} ${next.action}${next.team === 'us' ? '' : 's'}.` : ''}`;
  const pipsRow = (n: number) => <span className="pp" aria-hidden="true">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}</span>;
  const verb = t ? (t.action === 'ban' ? 'Ban' : 'Pick') : '';
  const lastLeft = G.vetoMaps(m.veto);
  return (
    <div className={`veto anim-in ${t ? `veto--${t.action}` : 'veto--done'} ${waiting ? 'veto--wait' : ''}`}>
      <header className="veto__banner">
        <span className="veto__badge" aria-hidden="true"><i>{t?.action === 'ban' ? '✕' : '✓'}</i><b>{waiting ? actor : t ? verb : 'Done'}</b></span>
        <div className="veto__says">
          <small className="knife__kicker">Map veto · Best of {m.bestOf}</small>
          <strong className="knife__title">{waiting ? <>{actor} {actor === 'You' ? 'are' : 'is'} <em>{t.action === 'ban' ? 'banning' : 'picking'}</em><span className="veto__dots" aria-hidden="true"><i /><i /><i /></span></> : t ? <>Your turn: <em>{t.action === 'ban' ? 'ban' : 'pick'}</em> a map</> : <>{m.bestOf === 3 ? 'Maps' : 'Map'} <em>locked</em></>}</strong>
          <p className="knife__advice">{waiting ? (auto ? `Both teams choose by the same rule; ${actor === 'You' ? 'you' : actor} ${t.action}${actor === 'You' ? '' : 's'} next.` : `Waiting for ${opp.tag} to ${t.action} a map.`) : t ? consequence : 'Both teams have chosen. The knife round is next.'}</p>
        </div>
      </header>
      {!t && (
        <ol className="veto__final" aria-label="Maps in this series">
          {lastLeft.map((x, i) => (
            <li key={x.map} className="veto__final-map" style={{ animationDelay: `${i * 160}ms` }}>
              <MapShot map={x.map} />
              <span className="veto__final-info">
                <small>{m.bestOf === 3 ? (x.by === 'decider' ? 'Decider' : `Map ${i + 1}`) : 'Map picked'}</small>
                <b>{x.map}</b>
                <em>{x.by === 'decider' ? 'Left over: played' : `${who(x.by)} picked`}</em>
              </span>
            </li>
          ))}
        </ol>
      )}
      <ol className="veto__track" aria-label="Veto order">
        {m.veto.order.map((o, i) => {
          const st = m.veto.steps[i];
          const now = i === m.veto.steps.length;
          return (
            <li key={i} className={`vt vt--${o.action} ${o.team === 'us' ? 'vt--us' : 'vt--them'} ${st ? 'is-done' : ''} ${now ? 'is-now' : ''}`}>
              <small>{who(o.team)}</small>
              <b>{o.action === 'ban' ? '✕ Ban' : '✓ Pick'}</b>
              <span>{st ? st.map : now ? 'Now' : ''}</span>
            </li>
          );
        })}
        <li className={`vt vt--last ${!t ? 'is-done' : ''}`}><small>{m.bestOf === 3 ? 'Decider' : 'Played'}</small><b>★</b><span>{!t ? lastLeft[lastLeft.length - 1]?.map : '?'}</span></li>
      </ol>
      <ul className="veto__maps" ref={grid}>
        {G.MAPS.map((map) => {
          const st = done(map);
          const mineC = G.comfortPips(G.comfort(mine, map)), theirC = G.comfortPips(G.comfort(oppL, map));
          const edge = G.comfortEdge(mine, oppL, map).who;
          const state = st ? `${st.action === 'ban' ? 'is-banned' : 'is-picked'} by-${st.team} ${latest && latest.map === map ? 'is-new' : ''}` : mineTurn ? 'is-open' : waiting ? 'is-wait' : '';
          const left = G.vetoMaps(m.veto).find((x) => x.map === map);
          return (
            <li key={map} className={`veto__map ${state} ${!t && left && !st ? 'is-played' : ''}`}>
              <button disabled={!!st || !mineTurn} data-sfx={t?.action === 'ban' ? 'ban' : 'draft'} onClick={() => commit(map)}
                aria-label={`${t?.action ?? ''} ${map}: ${EDGE_TEXT[edge].slice(2)}, you ${mineC} of 5, ${opp.tag} ${theirC} of 5`}>
                <span className="veto__art">
                  <MapShot map={map} />
                  {st && <span className="veto__stamp"><i>{st.action === 'ban' ? '✕' : '✓'}</i>{st.action === 'ban' ? 'Banned' : 'Picked'}<small>{who(st.team)}</small></span>}
                  {!st && mineTurn && <span className="veto__hover"><i>{t.action === 'ban' ? '✕' : '✓'}</i>{verb}</span>}
                </span>
                <span className="veto__name">{map}<small>{G.sideLean(map)}</small></span>
                <span className="veto__comfort">
                  <span className="us"><b>You</b>{pipsRow(mineC)}</span>
                  <span className="them"><b>{opp.tag}</b>{pipsRow(theirC)}</span>
                  <span className={`veto__edge edge-${edge}`}>{EDGE_TEXT[edge]}</span>
                </span>
                <span className="veto__state">{st ? `${st.action === 'ban' ? '✕' : '✓'} ${who(st.team)} ${st.action === 'ban' ? 'banned' : 'picked'}` : mineTurn ? `${t.action === 'ban' ? '✕' : '✓'} ${verb} this map` : waiting ? `${actor} ${actor === 'You' ? 'are' : 'is'} choosing…` : left ? '★ Played' : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="veto__note muted small">
        Comfort is a game value worked out from each player's original lineup, not historical map statistics. It's one input among players, form, sides and luck, so an edge is not a win chance.
        {' '}{m.bestOf === 3 ? 'Order: ban, ban, pick, pick, ban, ban; the last map is the decider.' : 'Bans alternate until one map is left.'}
        {auto && <> A coin flip decided that {who(m.veto.order[0].team)} {m.veto.order[0].team === 'us' ? 'go' : 'goes'} first.</>}
      </p>
      {!t && (
        <ol className="veto-series" aria-label="Series maps">{G.vetoMaps(m.veto).map((x, i) => <li key={x.map}><MapShot map={x.map} /><b>{m.bestOf === 1 ? 'Match map' : x.by === 'decider' ? 'Decider' : `Map ${i + 1}`}: {x.map}</b><span>{x.by === 'decider' ? (m.veto.auto ? 'Knife round decides who starts where' : 'Knife round decides sides') : `${who(x.by)} picked · ${m.veto.auto ? 'the other team takes its stronger side' : `${x.by === 'us' ? opp.tag : 'You'} choose sides`}`}</span></li>)}</ol>
      )}
    </div>
  );
}

/**
 * The round log: one row per round played, newest first. Each row says which side you were on, who won it, the score after it, what each team was buying when that
 * mattered (the rounds after a pistol), and anything notable that happened. It only reads the game's own rounds and events.
 */
function RoundLog({ game, n, all, theirTag, run, onLegend }: { game: G.MapGame; n: number; all: boolean; theirTag: string; run: { who: string; rounds: number } | null; onLegend: (e: G.MatchEvent) => void }) {
  const played = Math.min(n, game.rounds.length);
  const rows: { i: number; won: boolean; a: number; b: number; side: G.Side; notes: G.MatchEvent[] }[] = [];
  let a = 0, b = 0;
  for (let i = 0; i < played; i++) {
    game.rounds[i] ? a++ : b++;
    rows.push({ i, won: game.rounds[i], a, b, side: G.sideAt(i, game.start), notes: game.events.filter((e) => e.round === i + 1) });
  }
  const list = (all ? rows : rows.slice(-5)).slice().reverse();
  const forced = game.calls?.force ?? [];
  // A timeout lifts the three rounds that follow it.
  const boosted = (i: number) => (game.calls?.timeouts ?? []).some((t) => i >= t && i < t + 3);
  return (
    <div className={`roundlog ${all ? 'is-all' : ''}`} tabIndex={0} aria-label={all ? 'All rounds' : 'Latest rounds'}>
      {/* The opponent's run is news to act on (a timeout stops it), so it leads the log. */}
      <div className="rl-slot">
        {run && <div className="rl-run"><small>Run</small>{run.who} have won {run.rounds} in a row. A timeout stops it.</div>}
        {!run && list.length === 0 && <div className="rl-idle"><small>Pistol round</small>You start on {game.start}. Both teams buy and head out.</div>}
      </div>
      <ol>
        {list.map((r) => {
          const eco = economyFor(game.rounds, r.i, forced);
          const odd = eco.mine !== 'full' || eco.theirs !== 'full';
          return (
            <li key={`${r.i}`} className={`rl ${r.won ? 'is-won' : 'is-lost'} ${r.i === 0 || r.i === 12 ? 'is-pistol' : ''} ${r.notes.some((e) => e.kind === 'legend') ? 'is-legend' : ''}`}>
              <span className="rl__n">R{r.i + 1}{(r.i === 0 || r.i === 12) && <small>Pistol</small>}</span>
              <i className={`side-chip rl__side rl__side--${sideCls(r.side)}`}>{r.side}</i>
              <span className="rl__score"><b>{r.a}</b>–<b>{r.b}</b></span>
              <span className="rl__res">{r.won ? 'Won' : 'Lost'}<Sr> by you</Sr></span>
              <span className="rl__notes">
                {r.notes.length ? r.notes.map((e) => <span key={e.text} className={`rl__note ${KF_CLASS(e)}`}>{e.text}</span>) : <span className="rl__note rl__note--plain">{r.won ? 'You take the round.' : `${theirTag} take the round.`}</span>}
                {boosted(r.i) && <em className="rl__buy rl__buy--timeout">Timeout boost</em>}
                {r.notes.filter((e) => e.kind === 'legend').map((e) => <button key={e.text} type="button" className="rl__watch" onClick={() => onLegend(e)}>★ Watch again</button>)}
                {odd && <em className="rl__buy">You {BUY_LABEL[eco.mine].toLowerCase()} · {theirTag} {BUY_LABEL[eco.theirs].toLowerCase()}</em>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * What your buy choice after a lost pistol round did: the next three rounds, what each side was buying and how each went, and a line on whether it paid off.
 * Only rounds already played show a result; the rest wait. It reads the game's own economy and results, so it can't say anything the match didn't do.
 */
export function BuyAftermath({ game, n, theirTag }: { game: G.MapGame; n: number; theirTag: string }) {
  const lost = [0, 12].filter((p) => p < n && game.rounds[p] === false);
  if (!lost.length) return null;
  const p = lost[lost.length - 1];
  const forced = (game.calls?.force ?? []).includes(p + 1);
  const rows = [1, 2, 3].map((k) => {
    const i = p + k;
    const played = i < n && i < game.rounds.length;
    // The second round after a forced one depends on how the first went, so it only shows once that has been played.
    const known = k !== 2 || !forced || p + 1 < n;
    const eco = known ? economyFor(game.rounds, i, game.calls?.force ?? []) : null;
    return { round: i + 1, played, won: played ? game.rounds[i] : null, mine: eco?.mine ?? null, theirs: eco?.theirs ?? null };
  });
  const first = rows[0], second = rows[1];
  let verdict = '';
  if (forced) {
    verdict = !first.played ? 'Force buy: a real chance this round. Win it and the economy recovers; lose it and you are broke next round.'
      : first.won ? 'The force paid off: you won the round, and the economy is back to normal.'
        : second.played ? `The force failed: round ${first.round} was lost and you were broke for round ${second.round}${second.won ? ', though you took it anyway' : ''}.` : 'The force failed: you lost the round and will be broke for the next one.';
  } else {
    const won = rows.slice(0, 2).filter((r) => r.played && r.won).length;
    verdict = !second.played ? 'Saving: weak rounds now, for a full buy after.'
      : `You saved for two rounds and won ${won} of them. Full buys from round ${rows[2].round}.`;
  }
  return (
    <section className={`aftermath aftermath--${forced ? 'force' : 'eco'}`} aria-label="Your buy after the lost pistol">
      <h4>After the lost pistol <b>{forced ? 'Force buy' : 'Eco'}</b></h4>
      <ol>
        {rows.map((r) => (
          <li key={r.round} className={r.played ? (r.won ? 'is-won' : 'is-lost') : 'is-wait'}>
            <b>R{r.round}</b>
            <span className="aftermath__buy">{r.mine ? <><i className={`econ__meter econ--${r.mine}`} aria-hidden="true"><i /><i /><i /></i>{BUY_LABEL[r.mine]}</> : <em>depends on round {first.round}</em>}</span>
            <small>{r.theirs ? `${theirTag}: ${BUY_LABEL[r.theirs].toLowerCase()}` : ''}</small>
            <em className="aftermath__res">{r.played ? (r.won ? '✓ Won' : '✗ Lost') : 'Not played'}<Sr>{r.played ? (r.won ? ' won' : ' lost') : ''}</Sr></em>
          </li>
        ))}
      </ol>
      <p>{verdict}</p>
    </section>
  );
}

/** What a timeout did: the run it answered, the three rounds it lifted and how they went. Read from the rounds and your call only. */
export function TimeoutAftermath({ game, n, theirTag }: { game: G.MapGame; n: number; theirTag: string }) {
  const ts = (game.calls?.timeouts ?? []).filter((t) => t < n);
  if (!ts.length) return null;
  const t = ts[ts.length - 1];
  let run = 0;
  for (let i = t - 1; i >= 0 && !game.rounds[i]; i--) run++;
  const a = game.rounds.slice(0, t).filter(Boolean).length;
  const rows = [0, 1, 2].map((k) => { const i = t + k; const played = i < n && i < game.rounds.length; return { round: i + 1, played, won: played ? game.rounds[i] : null }; });
  const done = rows.filter((r) => r.played);
  const won = done.filter((r) => r.won).length;
  const verdict = done.length < 3
    ? `Timeout at ${a}–${t - a}${run >= 2 ? `: ${theirTag}'s run of ${run} is over` : ''}. Your next three rounds get a lift.`
    : `${won} of 3 after the timeout${run >= 2 ? `, from ${run} lost in a row before it` : ''}.${won >= 2 ? ' It worked.' : ' The lift was not enough this time.'}`;
  return (
    <section className="aftermath aftermath--timeout" aria-label="After your timeout">
      <h4>After the timeout <b>Lift: next 3 rounds</b></h4>
      <ol>
        {rows.map((r) => (
          <li key={r.round} className={r.played ? (r.won ? 'is-won' : 'is-lost') : 'is-wait'}>
            <b>R{r.round}</b>
            <span className="aftermath__buy">{r.played ? (r.won ? 'Round won' : 'Round lost') : 'Boosted'}</span>
            <em className="aftermath__res">{r.played ? (r.won ? '✓ Won' : '✗ Lost') : 'Not played'}<Sr>{r.played ? (r.won ? ' won' : ' lost') : ''}</Sr></em>
          </li>
        ))}
      </ol>
      <p>{verdict}</p>
    </section>
  );
}

/**
 * Why you would make a call (#71): how the last few rounds went, and what each side is buying. Both are read from the rounds already played and your
 * calls; the bar is never a prediction.
 */
function Momentum({ rounds, n, total, forced, theirTag }: { rounds: boolean[]; n: number; total: number; forced: number[]; theirTag: string }) {
  const mo = momentumAt(rounds, n);
  const buy = economyFor(rounds, Math.min(n, total - 1), forced);
  const said = momentumText(mo, theirTag);
  return (
    <div className="hud__extra">
      <div className="momentum">
        <span className="momentum__label">Momentum</span>
        <span className="momentum__bar" role="img" aria-label={`Momentum: ${said}. You won ${mo.ours} of the last ${mo.ours + mo.theirs}.`}><i style={{ width: `${Math.round(mo.share * 100)}%` }} /></span>
        <small className={mo.run?.who === 'them' ? 'is-warn' : ''}>{said}</small>
      </div>
      <div className="economy">
        <span className="momentum__label">Economy this round</span>
        {([['You', buy.mine], [theirTag, buy.theirs]] as [string, Buy][]).map(([who, b]) => (
          <div key={who} className={`econ econ--${b}`}>
            <b className="econ__who">{who}</b>
            <span className="econ__tier"><span className="econ__meter" aria-hidden="true"><i /><i /><i /></span><span className="econ__name">{BUY_LABEL[b]}<Sr>: {BUY_MARK[b].length} of 3</Sr></span></span>
            <small>{BUY_NOTE[b]}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
