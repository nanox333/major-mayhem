import React, { useEffect, useMemo, useState } from 'react';
import { Roster } from '../data/rosters';
import * as G from '../game/logic';
import { Action, Pending } from '../game/state';
import { RoleIcon, TeamBadge } from '../ui/art';
import { announceMap, fmt, pulse, ratingClass, reduceMotion } from '../ui/util';

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

export function LiveScreen({ mine, m, t, dispatch }: { mine: G.Lineup[]; m: G.Match; t: G.Tournament; dispatch: React.Dispatch<Action> }) {
  const opp = G.rosterById.get(m.opponentId)!;
  const [mapIdx, setMapIdx] = useState(0);
  const [n, setN] = useState(0);
  const game = m.maps[mapIdx];
  const total = game.rounds.length;
  const mapDone = n >= total;
  const seriesDone = mapDone && mapIdx === m.maps.length - 1;

  useEffect(() => {
    if (mapDone) return;
    const tm = setTimeout(() => setN((x) => x + 1), n === 0 ? 650 : reduceMotion() ? 40 : 230);
    return () => clearTimeout(tm);
  }, [n, mapDone, mapIdx]);

  // pulse the map token of whoever made the highlight this round
  const shown = game.events.filter((e) => e.round <= n);
  useEffect(() => {
    const e = game.events.find((x) => x.round === n);
    if (e?.playerId) pulse(e.playerId, e.good);
  }, [n, mapIdx]);
  useEffect(() => { announceMap(game.map); }, [game.map]);
  useEffect(() => () => { announceMap(null); }, []);

  const a = game.rounds.slice(0, n).filter(Boolean).length;
  const b = n - a;
  const mapsWon = m.maps.slice(0, mapIdx + (mapDone ? 1 : 0)).filter((g) => g.won).length;
  const mapsLost = mapIdx + (mapDone ? 1 : 0) - mapsWon;
  const next = G.nextStage(G.applyResult(t, m));
  const series = G.seriesRatings(m.maps);

  return (
    <div className="stack">
      <div className="hud">
        <div className="hud__meta">{G.STAGE_NAME[m.stage]} · Bo{m.bestOf}{m.bestOf === 3 ? ` · Map ${mapIdx + 1}` : ''} · {game.map}{total > 24 && mapDone ? ' · OT' : ''}</div>
        <div className="hud__score">
          <div className="hud__team hud__team--t"><span>Your team</span>{m.bestOf === 3 && <em>{mapsWon}</em>}</div>
          <div className="hud__nums">
            <b key={`a${a}`} className={`t ${a ? 'pop' : ''}`}>{a}</b>
            <i>:</i>
            <b key={`b${b}`} className={`ct ${b ? 'pop' : ''}`}>{b}</b>
          </div>
          <div className="hud__team hud__team--ct">{m.bestOf === 3 && <em>{mapsLost}</em>}<TeamBadge roster={opp} size={20} /><span>{opp.org} {opp.year}</span></div>
        </div>
        <div className="rounds" aria-hidden="true">
          {Array.from({ length: Math.max(24, total) }, (_, i) => <i key={i} className={i < n ? (game.rounds[i] ? 'w' : 'l') : ''} />)}
        </div>
        {m.bestOf === 3 && (
          <div className="maps">
            {[0, 1, 2].map((i) => {
              const g = m.maps[i];
              const played = g && (i < mapIdx || (i === mapIdx && mapDone));
              return (
                <span key={i} className={`maps__pill ${i === mapIdx ? 'is-now' : ''} ${played ? (g.won ? 'w' : 'l') : ''}`}>
                  {g ? g.map : 'Decider'}{played ? ` ${g.score[0]}–${g.score[1]}` : ''}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {!mapDone ? (
        <>
          <div className="killfeed" aria-live="polite">
            {shown.slice(-3).reverse().map((e) => (
              <div key={`${mapIdx}-${e.round}-${e.text}`} className={`kf ${e.good ? 'kf--t' : 'kf--ct'}`}><small>R{e.round}</small>{e.text}</div>
            ))}
            {shown.length === 0 && <div className="kf kf--idle"><small>Pistol</small>Both teams buy and head out.</div>}
          </div>
          <button className="ghost-btn" onClick={() => setN(total)}>Skip to end of map</button>
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
