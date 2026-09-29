import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ROLE_LABEL, ROLE_SHORT, Roster } from '../data/rosters';
import * as G from '../game/logic';
import { Action, Pending, Run, benchLineup, lineupFor } from '../game/state';
import { RatingMark, RoleIcon, Sr, TeamBadge } from '../ui/art';
import { track } from '../analytics';
import { useChatVote } from '../ui/ChatVote';
import { announceMap, announceSide, fmt, pulse, ratingClass, reduceMotion } from '../ui/util';
import { play } from '../ui/sound';

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
  return (
    <div className="subs anim-in">
      <div className="subs__head">
        <strong>Bench: {bench.player.nick}</strong> <FormTag v={pending.form[bench.player.id]} />
        <small>{G.formLabel(pending.form[bench.player.id])} form. Sub in for one match, in the starter's role.</small>
      </div>
      <div className="subs__btns" role="group" aria-label="Substitution">
        <button className={`ghost-btn ${!pending.subOut ? 'is-on' : ''}`} aria-pressed={!pending.subOut} onClick={() => dispatch({ type: 'sub', out: null })}>Keep starters</button>
        {starters.map((l) => (
          <button key={l.player.id} className={`ghost-btn ${pending.subOut === l.player.id ? 'is-on' : ''}`} aria-pressed={pending.subOut === l.player.id}
            onClick={() => dispatch({ type: 'sub', out: l.player.id })} title={tradeoff(l)}>
            Sub out {l.player.nick} <small>({ROLE_SHORT[l.slot]})</small> <FormTag v={pending.form![l.player.id]} />
          </button>
        ))}
      </div>
      {out && <p className={`subs__tradeoff small ${!hard && G.fitNote(bench.player, out.slot).kind === 'off' ? 'is-bad' : ''}`}>{tradeoff(out)}.</p>}
    </div>
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
          <div className="match-found__title">Your match is ready!</div>
          <div className="versus">
            <div className="versus__side versus__side--t">
              <small>T · Your team</small>
              <ul>{mine.map((l) => <li key={l.player.id}><RoleIcon role={l.slot} size={12} />{l.player.nick}<FormTag v={pending.form?.[l.player.id]} /></li>)}</ul>
            </div>
            <div className="versus__vs">VS</div>
            <div className="versus__side versus__side--ct">
              <small>CT · Opponent</small>
              <div className="versus__team"><TeamBadge roster={opp} size={28} /><span><b>{opp.org}</b> {opp.year}</span></div>
              <div className="versus__sub">{opp.result} at {opp.event}</div>
              <ul>{oppL.map((l) => <li key={l.player.id}><RoleIcon role={l.slot} size={12} />{l.player.nick}</li>)}</ul>
            </div>
          </div>
          <SubPanel s={s} pending={pending} dispatch={dispatch} />
          <div className="action-bar">
            <div className="accept-bar"><span /></div>
            <button className="cta cta--go" data-sfx="accept" onClick={() => dispatch({ type: 'start' })}>Accept</button>
          </div>
        </div>
      )}
    </div>
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

/** Playback speeds. "Tactical" is slow enough to read the feed and make calls as they come up (#16). */
const SPEEDS = [0.35, 1, 2, 4];
const speedLabel = (v: number) => (v < 1 ? 'Tactical' : `${v}×`);
const loadSpeed = () => { try { const v = Number(localStorage.getItem('mm-speed')); return SPEEDS.includes(v) ? v : 1; } catch { return 1; } };
const sideCls = (side: G.Side) => (side === 'T' ? 't' : 'ct');
const KF_CLASS = (e: G.MatchEvent) =>
  e.kind === 'half' || e.kind === 'ot' || e.kind === 'call' ? 'kf--half'
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
const loadSeen = (key: string) => { try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null'); return v?.key === key ? Number(v.n) || 0 : 0; } catch { return 0; } };
const saveSeen = (key: string, n: number) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify({ key, n })); } catch { /* storage unavailable */ } };

export function LiveScreen({ mine, m, t, coach, dispatch }: { mine: G.Lineup[]; m: G.Match; t: G.Tournament; coach?: string | null; dispatch: React.Dispatch<Action> }) {
  const opp = G.rosterById.get(m.opponentId)!;
  const [mapIdx, setMapIdx] = useState(() => Math.max(0, m.maps.length - 1));
  const [n, setN] = useState(() => loadSeen(seenKey(t, m, Math.max(0, m.maps.length - 1))));
  /** Pistol rounds (1 or 13) where you already answered the save-or-force question on this map. */
  const [bought, setBought] = useState<number[]>([]);
  const [speed, setSpeed] = useState(loadSpeed);
  /** Paused playback waits for Resume or Next round (#16). */
  const [paused, setPaused] = useState(false);
  const game: G.MapGame | undefined = m.maps[mapIdx];
  const total = game?.rounds.length ?? 0;
  const mapDone = !!game && n >= total;
  const seriesDone = m.done && mapDone && mapIdx === m.maps.length - 1;
  const mapName = game?.map ?? m.next?.map ?? '';
  const vetoing = m.pool.length === 0;
  const lastMap = mapIdx === m.maps.length - 1;
  // After a lost pistol round, playback waits for your buy: save for the full buy, or force.
  const buyQuestion = !!game && lastMap && !mapDone && (n === 1 || n === 13) && !game.rounds[n - 1] && !bought.includes(n)
    && G.canCall(m, { kind: 'force', round: n });

  useEffect(() => {
    if (!game || mapDone || buyQuestion || paused) return;
    const tm = setTimeout(() => setN((x) => x + 1), n === 0 ? 650 : reduceMotion() ? 40 : 230 / speed);
    return () => clearTimeout(tm);
  }, [n, mapDone, mapIdx, !!game, speed, buyQuestion, paused]);
  // Space pauses and resumes, the right arrow steps one round while paused (desktop and streamers).
  useEffect(() => {
    if (!game || mapDone) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, button, select')) return;
      if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
      if (e.key === 'ArrowRight' && paused && !buyQuestion) setN((x) => Math.min(x + 1, total));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [!!game, mapDone, paused, buyQuestion, total]);
  useEffect(() => { if (game && lastMap) saveSeen(seenKey(t, m, mapIdx), Math.min(n, total)); }, [n, mapIdx, lastMap, total]);
  useEffect(() => { setBought([]); setPaused(false); }, [mapIdx]);
  const call = (kind: G.Call['kind']) => {
    if (kind === 'force' || buyQuestion) setBought((b) => [...b, n]);
    dispatch({ type: 'call', call: { kind, round: n } });
    track('call', { kind, round: n, stage: m.stage });
  };
  const canTimeout = !!game && lastMap && !mapDone && n >= 1 && G.canCall(m, { kind: 'timeout', round: n });
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
  const b = n - a;
  const mapsWon = m.maps.slice(0, mapIdx + (mapDone ? 1 : 0)).filter((g) => g.won).length;
  const mapsLost = Math.min(mapIdx + (mapDone ? 1 : 0), m.maps.length) - mapsWon;
  const next = seriesDone ? G.nextStage(G.applyResult(t, m)) : null;
  const series = G.seriesRatings(m.maps);
  const setSpeedSaved = (v: number) => { setSpeed(v); track('speed', { speed: v }); try { localStorage.setItem('mm-speed', String(v)); } catch { /* storage unavailable */ } };
  const ot = total > 24 && n > 24;

  return (
    <div className="stack">
      <div className={`hud ${vetoing ? 'hud--veto' : ''}`}>
        <div className="hud__meta">{G.STAGE_NAME[m.stage]} · Bo{m.bestOf}{vetoing ? ' · Map veto' : `${m.bestOf === 3 ? ` · Map ${mapIdx + 1}` : ''} · ${mapName}${ot ? ' · OT' : ''}`}</div>
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
            return <i key={i} className={`${game.rounds[i] ? sideCls(ours) : `${sideCls(G.otherSide(ours))} lost`}${pistol}${clutch}`} title={`Round ${i + 1}${pistol ? ' · pistol' : ''}${clutch ? ' · clutch' : ''}`} />;
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
        <VetoPanel m={m} opp={opp} mine={mine} dispatch={dispatch} />
      ) : !game ? (
        m.next && <KnifePanel k={m.next} opp={opp} mine={mine} mapNo={mapIdx + 1} bestOf={m.bestOf} voteKey={`side-${m.form}-${m.maps.length}`} dispatch={dispatch} />
      ) : !mapDone ? (
        <>
          {/* Everything you can press sits above the killfeed, so the feed can grow downward without moving a button. */}
          {buyQuestion && (
            <div className="buy anim-in" role="group" aria-label="Buy after the lost pistol">
              <strong>Pistol lost. Save or force?</strong>
              <p>Saving means an eco now and a full buy after. A force buy gives you a real chance next round, but if it fails you're broke for the one after.</p>
              <div className="buy__btns">
                <button className="ghost-btn" data-sfx="call" onClick={() => setBought((b) => [...b, n])}>Save (eco)</button>
                <button className="ghost-btn buy__force" data-sfx="call" onClick={() => call('force')}>Force buy</button>
              </div>
            </div>
          )}
          <div className="controls">
            {!buyQuestion && (
              <div className="calls">
                <button className="ghost-btn calls__timeout" data-sfx="call" onClick={() => call('timeout')} disabled={!canTimeout}
                  title={`One per half. Stops the opponent's run and lifts your next three rounds${coach ? `; ${coach} makes it count for more` : ''}.`}>
                  Timeout
                </button>
              </div>
            )}
            <div className="playback">
              <button className="ghost-btn" aria-pressed={paused} onClick={() => setPaused((p) => !p)} title="Space">{paused ? '▶ Resume' : '❚❚ Pause'}</button>
              {paused && <button className="ghost-btn" disabled={buyQuestion} onClick={() => setN((x) => Math.min(x + 1, total))} title="Right arrow">Next round ›</button>}
              <div className="speed" role="group" aria-label="Playback speed">
                {SPEEDS.map((v) => <button key={v} className={speed === v ? 'is-on' : ''} aria-pressed={speed === v} onClick={() => setSpeedSaved(v)}>{speedLabel(v)}</button>)}
              </div>
              <button className="ghost-btn" onClick={() => setN(total)}>Skip map</button>
            </div>
            {paused && <p className="muted small playback__note">Paused after round {Math.min(n, total)}. Timeouts can still be called.</p>}
          </div>
          <div className="killfeed" aria-live="polite">
            {/* The opponent's run is news to act on (a timeout stops it), so it leads the feed rather than crowding the buttons. */}
            {nudge && <div className="kf kf--run"><small>Run</small>{opp.tag} have won {theirRun} in a row. A timeout stops it.</div>}
            {shown.slice(nudge ? -2 : -3).reverse().map((e) => (
              <div key={`${mapIdx}-${e.round}-${e.text}`} className={`kf ${KF_CLASS(e)}`}><small>R{e.round}{kfMark(e)}</small>{e.text}</div>
            ))}
            {shown.length === 0 && <div className="kf kf--idle"><small>Pistol</small>You start on {game.start}. Both teams buy and head out.</div>}
          </div>
        </>
      ) : (
        <>
          {seriesDone && (
            <div className={`result-stamp ${m.won ? 'w' : 'l'}`}>{m.won ? 'Victory' : 'Defeat'} {m.score[0]}–{m.score[1]}</div>
          )}
          <Scoreboard game={game} opp={opp} mine={mine} />
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
    </div>
  );
}

/** Before each map: the knife round. Win it and you pick the starting side; lose it and the opponent picks. */
function KnifePanel({ k, opp, mine, mapNo, bestOf, voteKey, dispatch }: {
  k: G.Knife; opp: Roster; mine: G.Lineup[]; mapNo: number; bestOf: number; voteKey: string; dispatch: React.Dispatch<Action>;
}) {
  const left = G.otherSide(k.oppPick);
  useChatVote(k.won ? voteKey : null, [{ id: 'T', label: 'T · attack', aliases: ['t', 'attack'] }, { id: 'CT', label: 'CT · defend', aliases: ['ct', 'defend'] }],
    (id) => dispatch({ type: 'side', side: id as G.Side }));
  const title = k.how === 'our-pick' ? `Your pick: ${opp.org} choose sides`
    : k.how === 'their-pick' ? `${opp.org}'s pick: you choose sides`
      : k.won ? 'You won the knife!' : `${opp.org} won the knife`;
  const label = k.how === 'knife' ? (bestOf === 3 ? 'Decider · Knife round' : 'Knife round') : 'Side choice';
  return (
    <div className={`knife anim-in ${k.won ? 'is-won' : 'is-lost'}`}>
      <small className="knife__kicker">{bestOf === 3 ? `Map ${mapNo} · ` : ''}{k.map} · {label}</small>
      <strong className="knife__title">{title}</strong>
      <p className="knife__advice">{G.sideAdvice(k, mine)} Whoever leads at halftime carries momentum into the second half.</p>
      {k.won ? (
        <div className="knife__pick">
          <button className="side-btn side-btn--t" onClick={() => dispatch({ type: 'side', side: 'T' })}><b>T</b><span>Start attacking</span></button>
          <button className="side-btn side-btn--ct" onClick={() => dispatch({ type: 'side', side: 'CT' })}><b>CT</b><span>Start defending</span></button>
        </div>
      ) : (
        <>
          <p className="knife__advice">They start on {k.oppPick}, so you start on {left}.</p>
          <button className="cta cta--orange" onClick={() => dispatch({ type: 'side', side: left })}>Go live</button>
        </>
      )}
    </div>
  );
}

/** The map veto before a series: bans (and picks in a Bo3), with each team's comfort on every map. */
function VetoPanel({ m, opp, mine, dispatch }: { m: G.Match; opp: Roster; mine: G.Lineup[]; dispatch: React.Dispatch<Action> }) {
  const oppL = useMemo(() => G.naturalLineup(opp), [opp]);
  const t = G.vetoTurn(m.veto);
  const done = (map: string) => m.veto.steps.find((x) => x.map === map);
  useChatVote(t?.team === 'us' ? `veto-${m.form}-${m.veto.steps.length}` : null,
    G.MAPS.filter((map) => m.veto.left.includes(map)).map((map) => ({ id: map, label: map, aliases: [map, ...(map === 'Dust2' ? ['d2', 'dust'] : [])] })),
    (map) => dispatch({ type: 'veto', map }));
  const pips = (n: number) => '●'.repeat(n) + '○'.repeat(5 - n);
  const who = (team: G.Team) => (team === 'us' ? 'You' : opp.tag);
  const next = G.vetoNextTurn(m.veto);
  const EDGE_TEXT = { us: '▲ Your edge', them: `▼ ${opp.tag} edge`, even: '= Even' } as const;
  // What the click does, and what follows it (#65).
  const consequence = !t ? '' : t.action === 'ban'
    ? `Banning removes a map for both teams.${next ? ` Then ${next.team === 'us' ? 'you' : opp.tag} ${next.action}${next.team === 'us' ? '' : 's'}.` : ' The map left over is played.'}`
    : `Picking makes it a map in the series; ${opp.tag} will choose the starting side on it.${next ? ` Then ${next.team === 'us' ? 'you' : opp.tag} ${next.action}${next.team === 'us' ? '' : 's'}.` : ''}`;
  return (
    <div className="veto anim-in">
      <small className="knife__kicker">Map veto · Best of {m.bestOf}</small>
      <strong className="knife__title">{t ? `Your turn: ${t.action} a map` : 'Veto done'}</strong>
      <p className="knife__advice">
        {t ? consequence : null}{' '}
        {m.bestOf === 3 ? 'Order: ban, ban, pick, pick, ban, ban; the last map is the decider.' : 'Bans alternate until one map is left.'}
      </p>
      <p className="veto__note muted small">
        Comfort is a game value worked out from each player's original lineup, not historical map statistics. It's one
        input among players, form, sides and luck, so an edge is not a win chance.
      </p>
      <ul className="veto__maps">
        {G.MAPS.map((map) => {
          const st = done(map);
          const mineC = G.comfortPips(G.comfort(mine, map)), theirC = G.comfortPips(G.comfort(oppL, map));
          const edge = G.comfortEdge(mine, oppL, map).who;
          const state = st ? `${st.action === 'ban' ? 'is-banned' : 'is-picked'} by-${st.team}` : '';
          return (
            <li key={map} className={`veto__map ${state}`}>
              <button disabled={!!st || !t} data-sfx={t?.action === 'ban' ? 'ban' : 'draft'} onClick={() => dispatch({ type: 'veto', map })}
                aria-label={`${t?.action ?? ''} ${map}: ${EDGE_TEXT[edge].slice(2)}, you ${mineC} of 5, ${opp.tag} ${theirC} of 5`}>
                <span className="veto__name">{map}<small>{G.sideLean(map)}</small></span>
                <span className="veto__comfort">
                  <span className="us">You {pips(mineC)}</span>
                  <span className="them">{opp.tag} {pips(theirC)}</span>
                  <span className={`veto__edge edge-${edge}`}>{EDGE_TEXT[edge]}</span>
                </span>
                <span className="veto__state">{st ? `${who(st.team)} ${st.action === 'ban' ? 'banned' : 'picked'}` : t ? (t.action === 'ban' ? 'Ban' : 'Pick') : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {m.veto.steps.length > 0 && (
        <ol className="veto__history muted small" aria-label="Veto so far">
          {m.veto.steps.map((s, i) => <li key={i}>{who(s.team)} {s.action === 'ban' ? 'banned' : 'picked'} {s.map}</li>)}
        </ol>
      )}
      {!t && (
        <p className="veto__order"><b>Maps:</b> {G.vetoMaps(m.veto).map((x, i) => `${i + 1}. ${x.map} (${x.by === 'decider' ? 'decider' : `${who(x.by)} picked`})`).join(' · ')}</p>
      )}
    </div>
  );
}
