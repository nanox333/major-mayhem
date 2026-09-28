import React, { useState } from 'react';
import { ROLE_LABEL, ROLE_SHORT } from '../data/rosters';
import * as G from '../game/logic';
import { Action, Run, dailyDate, dailyNumber } from '../game/state';
import { copyText, shareText } from '../game/share';
import { Stats } from '../game/stats';
import { Avatar, RoleIcon, TeamBadge } from '../ui/art';
import { fmt } from '../ui/util';
import { RosterList } from './Lobby';
import { StageTrack } from './Match';

export function FinalScreen({ mine, s, stats, dispatch }: { mine: G.Lineup[]; s: Run; stats: Stats; dispatch: React.Dispatch<Action> }) {
  const pl = G.placement(s.t);
  const star = G.mvp(s.t, mine);
  const champ = pl.key === 'CHAMP';
  const ratings = G.seriesRatings(s.t.matches.flatMap((m) => m.maps));
  const date = dailyDate(s);
  return (
    <div className="final">
      <div className={`final__banner ${champ ? 'is-champ' : ''}`}>
        <small>{date ? `Daily #${dailyNumber(date)} · ` : ''}Your Major Mayhem team finished</small>
        <h3>{champ ? 'Major champions' : pl.label}</h3>
      </div>
      <StageTrack t={s.t} />
      <div className="mvp-card anim-in">
        <span className="mvp-card__photo"><Avatar player={star.player} roster={star.roster} /></span>
        <div>
          <small>★ Tournament MVP</small>
          <strong>{star.player.nick}</strong>
          <span>{ROLE_LABEL[star.slot]} · {star.roster.org} {star.roster.year}</span>
        </div>
        <div className="mvp-card__rating"><b>{fmt(ratings[star.player.id].rating)}</b><small>Event rating</small></div>
      </div>
      <ShareBar s={s} />
      <RosterList mine={mine} stats={ratings} mvpId={star.player.id} />
      <ul className="history">
        {s.t.matches.map((m, i) => {
          const o = G.rosterById.get(m.opponentId)!;
          return (
            <li key={i} className={m.won ? 'w' : 'l'}>
              <span>{m.stage === 'QUAL' ? 'Qual' : m.stage}</span>
              <span className="history__opp">{o.org} {o.year}</span>
              <span className="history__maps">{m.maps.map((g) => `${g.map} ${g.score[0]}–${g.score[1]}`).join(', ')}</span>
              <b>{m.score[0]}–{m.score[1]}</b>
            </li>
          );
        })}
      </ul>
      <DraftReview picks={s.picks} />
      {stats.runs > 0 && (
        <p className="muted small">
          Lifetime: {stats.titles} title{stats.titles === 1 ? '' : 's'} in {stats.runs} run{stats.runs === 1 ? '' : 's'}
          {stats.streak > 1 ? ` · ${stats.streak} titles in a row` : ''}{stats.bestStreak > 1 ? ` · best streak ${stats.bestStreak}` : ''}
        </p>
      )}
      <div className="final__actions">
        <button className="cta cta--orange" onClick={() => dispatch({ type: 'reset' })}>Play again</button>
      </div>
    </div>
  );
}

function ShareBar({ s }: { s: Run }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const share = async () => {
    const text = shareText(s, location.protocol.startsWith('http') ? location.href.split('#')[0] : undefined);
    setState((await copyText(text)) ? 'copied' : 'failed');
    setTimeout(() => setState('idle'), 2200);
  };
  return (
    <div className="share-bar">
      <button className="ghost-btn" onClick={share}>{state === 'copied' ? '✓ Copied to clipboard' : state === 'failed' ? 'Copy blocked by the browser' : '⧉ Copy result'}</button>
    </div>
  );
}

/** Reveals the hidden game ratings: what you took vs the strongest pick on the board that round. */
function DraftReview({ picks }: { picks: G.Pick[] }) {
  const { rounds, grade } = G.draftReview(picks);
  if (grade === null) return null;
  return (
    <section className="review anim-in" aria-label="Draft review">
      <div className="review__head">
        <span>Draft review</span>
        <b className={grade >= 0.98 ? 'hi' : grade < 0.92 ? 'lo' : ''}>{Math.round(grade * 100)}%</b>
      </div>
      <p className="muted small">Hidden game ratings, adjusted for role fit, against the strongest pick in that round's case.</p>
      <ol className="review__list">
        {rounds.map((r, i) => {
          const top = !r.best || r.best.player.id === r.player.id || r.value >= r.best.value - 0.01;
          return (
            <li key={i} className={top ? 'is-top' : ''}>
              <span className="review__round">R{i + 1}</span>
              <span className="review__pick"><RoleIcon role={r.slot} size={12} /> <b>{r.player.nick}</b> <em>{Math.round(r.value)}</em></span>
              <span className="review__best">
                {top ? 'Best on the board' : (
                  <>Best: <TeamBadge roster={r.best!.roster} size={14} /> <b>{r.best!.player.nick}</b> {ROLE_SHORT[r.best!.slot]} <em>{Math.round(r.best!.value)}</em></>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
