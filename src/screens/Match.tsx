import React, { useEffect, useMemo, useState } from 'react';
import { Roster } from '../data/rosters';
import * as G from '../game/logic';
import { Action, Pending } from '../game/state';
import { RoleIcon, TeamBadge } from '../ui/art';
import { track } from '../analytics';
import { announceMap, announceSide, fmt, pulse, ratingClass, reduceMotion } from '../ui/util';

export function StageTrack({ t, current }: { t: G.Tournament; current?: G.StageKey }) {
  const q = t.qual;
  const playoffs = t.matches.filter((m) => m.stage !== 'QUAL');
  const nodes: { k: G.StageKey; label: string }[] = [{ k: 'QUAL', label: 'Qual' }, { k: 'QF', label: 'Quarter' }, { k: 'SF', label: 'Semi' }, { k: 'F', label: 'Final' }];
  return (
    <div className="track">
      {nodes.map((n) => {
        const done = n.k === 'QUAL' ? q.w >= 2 : playoffs.some((m) => m.stage === n.k && m.won);
        const lost = n.k === 'QUAL' ? q.l >= 2 : playoffs.some((m) => m.stage === n.k && !m.won);
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

export function PreviewScreen({ mine, pending, t, dispatch }: { mine: G.Lineup[]; pending: Pending; t: G.Tournament; dispatch: React.Dispatch<Action> }) {
  const opp = G.rosterById.get(pending.oppId)!;
  const oppL = useMemo(() => G.naturalLineup(opp), [opp]);
  const [found, setFound] = useState(false);
  useEffect(() => { setFound(false); const tm = setTimeout(() => setFound(true), reduceMotion() ? 0 : 1500); return () => clearTimeout(tm); }, [pending.oppId]);
  return (
    <div className="stack">
      <StageTrack t={t} current={pending.stage} />
      {!found ? (
        <div className="searching anim-in">
          <span className="searching__ring" />
          <strong>Searching for opponent</strong>
          <small>{G.STAGE_NAME[pending.stage]} · Best of {G.BEST_OF[pending.stage]}</small>
        </div>
      ) : (
        <div className="match-found anim-in">
          <div className="match-found__title">Your match is ready!</div>
          <div className="versus">
            <div className="versus__side versus__side--t">
              <small>T · Your team</small>
              <ul>{mine.map((l) => <li key={l.player.id}><RoleIcon role={l.slot} size={12} />{l.player.nick}</li>)}</ul>
            </div>
            <div className="versus__vs">VS</div>
            <div className="versus__side versus__side--ct">
              <small>CT · Opponent</small>
              <div className="versus__team"><TeamBadge roster={opp} size={28} /><span><b>{opp.org}</b> {opp.year}</span></div>
              <div className="versus__sub">{opp.result} at {opp.event}</div>
              <ul>{oppL.map((l) => <li key={l.player.id}><RoleIcon role={l.slot} size={12} />{l.player.nick}</li>)}</ul>
            </div>
          </div>
          <div className="accept-bar"><span /></div>
          <button className="cta cta--go" onClick={() => dispatch({ type: 'start' })}>Accept</button>
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
      <div className="sb__head"><span>{game.map}</span><b className={game.won ? 'w' : 'l'}>{game.score[0]}–{game.score[1]}</b></div>
      <table>
        <thead><tr><th>Your team</th><th>K</th><th>D</th><th>Rating</th></tr></thead>
        <tbody>{rows(game.stats.mine).map((p) => (
          <tr key={p.id}><td><span className="sb__tag">{teamOf(p.id)?.tag}</span>{p.nick}</td><td>{p.k}</td><td>{p.d}</td><td className={ratingClass(p.rating)}>{fmt(p.rating)}</td></tr>
        ))}</tbody>
        <thead><tr className="ct"><th>{opp.org} {opp.year}</th><th>K</th><th>D</th><th>Rating</th></tr></thead>
        <tbody>{rows(game.stats.opp).map((p) => (
          <tr key={p.id} className="ct"><td>{p.nick}</td><td>{p.k}</td><td>{p.d}</td><td className={ratingClass(p.rating)}>{fmt(p.rating)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

const SPEEDS = [1, 2, 4];
const loadSpeed = () => { try { const v = Number(localStorage.getItem('mm-speed')); return SPEEDS.includes(v) ? v : 1; } catch { return 1; } };
const sideCls = (side: G.Side) => (side === 'T' ? 't' : 'ct');
const KF_CLASS = (e: G.MatchEvent) =>
  e.kind === 'half' || e.kind === 'ot' ? 'kf--half'
    : e.kind === 'clutch' ? 'kf--clutch'
      : `${e.good ? 'kf--us' : 'kf--them'}${e.kind === 'pistol' ? ' kf--pistol' : ''}`;

export function LiveScreen({ mine, m, t, dispatch }: { mine: G.Lineup[]; m: G.Match; t: G.Tournament; dispatch: React.Dispatch<Action> }) {
  const opp = G.rosterById.get(m.opponentId)!;
  const [mapIdx, setMapIdx] = useState(0);
  const [n, setN] = useState(0);
  const [speed, setSpeed] = useState(loadSpeed);
  const game: G.MapGame | undefined = m.maps[mapIdx];
  const total = game?.rounds.length ?? 0;
  const mapDone = !!game && n >= total;
  const seriesDone = m.done && mapDone && mapIdx === m.maps.length - 1;
  const mapName = game?.map ?? m.next?.map ?? '';
  const vetoing = m.pool.length === 0;

  useEffect(() => {
    if (!game || mapDone) return;
    const tm = setTimeout(() => setN((x) => x + 1), n === 0 ? 650 : reduceMotion() ? 40 : 230 / speed);
    return () => clearTimeout(tm);
  }, [n, mapDone, mapIdx, !!game, speed]);

  // pulse the map token of whoever made the highlight this round
  const shown = game ? game.events.filter((e) => e.round <= n) : [];
  useEffect(() => {
    const e = game?.events.find((x) => x.round === n && x.playerId);
    if (e?.playerId) pulse(e.playerId, e.good);
  }, [n, mapIdx]);
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
      <div className="hud">
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
            if (!game || i >= n) return <i key={i} />;
            // Coloured by the side that won the round, like the in-game round history; your losses are dimmed.
            const ours = G.sideAt(i, game.start);
            return <i key={i} className={game.rounds[i] ? sideCls(ours) : `${sideCls(G.otherSide(ours))} lost`} />;
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
                  {i === 2 && !g ? `Decider · ${name}` : name}{played ? ` ${g.score[0]}–${g.score[1]}` : ''}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {vetoing ? (
        <VetoPanel m={m} opp={opp} mine={mine} dispatch={dispatch} />
      ) : !game ? (
        m.next && <KnifePanel k={m.next} opp={opp} mine={mine} mapNo={mapIdx + 1} bestOf={m.bestOf} dispatch={dispatch} />
      ) : !mapDone ? (
        <>
          <div className="killfeed" aria-live="polite">
            {shown.slice(-3).reverse().map((e) => (
              <div key={`${mapIdx}-${e.round}-${e.text}`} className={`kf ${KF_CLASS(e)}`}><small>R{e.round}</small>{e.text}</div>
            ))}
            {shown.length === 0 && <div className="kf kf--idle"><small>Pistol</small>You start on {game.start}. Both teams buy and head out.</div>}
          </div>
          <div className="playback">
            <div className="speed" role="group" aria-label="Playback speed">
              {SPEEDS.map((v) => <button key={v} className={speed === v ? 'is-on' : ''} aria-pressed={speed === v} onClick={() => setSpeedSaved(v)}>{v}×</button>)}
            </div>
            <button className="ghost-btn" onClick={() => setN(total)}>Skip to end of map</button>
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
          {seriesDone ? (
            <button className="cta cta--orange" onClick={() => dispatch({ type: 'next' })}>{next ? 'Next match' : 'See results'}</button>
          ) : (
            <button className="cta cta--orange" onClick={() => { setMapIdx((i) => i + 1); setN(0); }}>Next map</button>
          )}
        </>
      )}
    </div>
  );
}

/** Before each map: the knife round. Win it and you pick the starting side; lose it and the opponent picks. */
function KnifePanel({ k, opp, mine, mapNo, bestOf, dispatch }: {
  k: G.Knife; opp: Roster; mine: G.Lineup[]; mapNo: number; bestOf: number; dispatch: React.Dispatch<Action>;
}) {
  const left = G.otherSide(k.oppPick);
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
  const pips = (n: number) => '●'.repeat(n) + '○'.repeat(5 - n);
  return (
    <div className="veto anim-in">
      <small className="knife__kicker">Map veto · Best of {m.bestOf}</small>
      <strong className="knife__title">{t ? `Your turn: ${t.action} a map` : 'Veto done'}</strong>
      <p className="knife__advice">
        {m.bestOf === 3 ? 'Ban, ban, pick, pick, ban, ban; the last map is the decider. ' : 'Bans alternate until one map is left. '}
        Comfort comes from each player's original lineup: ban their best maps, {m.bestOf === 3 ? 'pick yours.' : 'keep yours.'}
      </p>
      <ul className="veto__maps">
        {G.MAPS.map((map) => {
          const st = done(map);
          const mineC = G.comfortPips(G.comfort(mine, map)), theirC = G.comfortPips(G.comfort(oppL, map));
          const state = st ? `${st.action === 'ban' ? 'is-banned' : 'is-picked'} by-${st.team}` : '';
          return (
            <li key={map} className={`veto__map ${state}`}>
              <button disabled={!!st || !t} onClick={() => dispatch({ type: 'veto', map })} aria-label={`${t?.action ?? ''} ${map}`}>
                <span className="veto__name">{map}<small>{G.sideLean(map)}</small></span>
                <span className="veto__comfort" title="Map comfort (game values)">
                  <span className="us">You {pips(mineC)}</span>
                  <span className="them">{opp.tag} {pips(theirC)}</span>
                </span>
                <span className="veto__state">{st ? `${st.team === 'us' ? 'You' : opp.tag} ${st.action === 'ban' ? 'banned' : 'picked'}` : t ? (t.action === 'ban' ? 'Ban' : 'Pick') : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
