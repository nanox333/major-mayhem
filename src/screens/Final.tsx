import React, { useEffect, useRef, useState } from 'react';
import { ROLE_LABEL, ROLE_SHORT } from '../data/rosters';
import * as G from '../game/logic';
import { Action, Run, dailyDate, dailyNumber, squadOf } from '../game/state';
import { copyText, pageUrl, shareText } from '../game/share';
import { Stats, dailyStreak } from '../game/stats';
import { NextDaily } from '../ui/Countdown';
import { Avatar, RoleIcon, TeamBadge } from '../ui/art';
import { fmt } from '../ui/util';
import { cardFileName, drawResultCard, siteHost } from '../ui/card';
import { reportError, track } from '../analytics';
import { RosterList, Staff } from './Lobby';
import { achievementById } from '../game/achievements';
import { StageTrack } from './Match';

export function FinalScreen({ mine, s, stats, dispatch }: { mine: G.Lineup[]; s: Run; stats: Stats; dispatch: React.Dispatch<Action> }) {
  const pl = G.placement(s.t);
  const star = G.mvp(s.t, squadOf(s));
  const champ = pl.key === 'CHAMP';
  const ratings = G.seriesRatings(s.t.matches.flatMap((m) => m.maps));
  const date = dailyDate(s);
  const streak = date ? dailyStreak(stats.daily, date).current : 0;
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
      {s.recorded && stats.lastNew?.length > 0 && (
        <div className="new-ach anim-in" role="status">
          <small>New achievement{stats.lastNew.length > 1 ? 's' : ''}</small>
          {stats.lastNew.map((id) => <span key={id} title={achievementById.get(id)?.desc}>★ {achievementById.get(id)?.name ?? id}</span>)}
        </div>
      )}
      <ShareBar
        text={() => shareText(s, pageUrl())}
        image={{ draw: () => drawResultCard(s, siteHost()), name: cardFileName(s) }}
        props={{ mode: s.mode, placement: pl.key, ...(date ? { daily: dailyNumber(date) } : {}) }}
      />
      {date && (
        <p className="daily-meta">
          {streak > 1 && <span>🔥 {streak}-day daily streak</span>}
          <NextDaily />
        </p>
      )}
      <RosterList mine={mine} stats={ratings} mvpId={star.player.id} />
      <Staff s={s} stats={ratings} />
      <ul className="history">
        {s.t.matches.map((m, i) => {
          const o = G.rosterById.get(m.opponentId)!;
          return (
            <li key={i} className={m.won ? 'w' : 'l'}>
              <span>{m.stage === 'QUAL' ? (s.t.qual.need ? 'Swiss' : 'Qual') : m.stage}</span>
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

type ShareState = 'idle' | 'copied' | 'copyFailed' | 'shared' | 'saved' | 'failed';
const SHARE_LABEL: Record<ShareState, string> = { idle: '', copied: '✓ Copied to clipboard', copyFailed: 'Copy blocked by the browser', shared: '✓ Shared', saved: '✓ Image saved', failed: 'Blocked by the browser' };

/** Phones get the system share sheet (Discord, WhatsApp, …); desktops get a download. */
const canShareImage = () => {
  try {
    return matchMedia('(pointer: coarse)').matches && !!navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] });
  } catch { return false; }
};

/**
 * Copy the spoiler-light text, and optionally share or save the result card. The card is drawn as soon as the bar
 * mounts: Safari only lets a page open the share sheet straight from a tap, with no slow work in between.
 */
export function ShareBar({ text, image, props = {} }: {
  text: () => string; props?: Record<string, string | number>;
  image?: { draw: () => Promise<Blob>; name: string };
}) {
  const [state, setState] = useState<ShareState>('idle');
  const card = useRef<Promise<Blob> | null>(null);
  const [share] = useState(canShareImage);
  useEffect(() => {
    if (!image) return;
    const p = image.draw();
    p.catch((e) => reportError(e, 'result-card'));
    card.current = p;
  }, [image?.name]);
  const done = (s: ShareState) => { setState(s); setTimeout(() => setState('idle'), 2200); };
  const copy = async () => {
    const ok = await copyText(text());
    track('share', { ...props, method: 'copy', ok });
    done(ok ? 'copied' : 'copyFailed');
  };
  const sendImage = async () => {
    if (!image || !card.current) return;
    try {
      const blob = await card.current;
      if (share) {
        await navigator.share({ files: [new File([blob], image.name, { type: 'image/png' })], text: text() });
        track('share', { ...props, method: 'share_image', ok: true });
        done('shared');
      } else {
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: image.name });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        track('share', { ...props, method: 'save_image', ok: true });
        done('saved');
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // closed the share sheet
      reportError(e, 'share-image');
      track('share', { ...props, method: share ? 'share_image' : 'save_image', ok: false });
      done('failed');
    }
  };
  return (
    <div className="share-bar">
      <button className="ghost-btn" onClick={copy}>{state === 'copied' || state === 'copyFailed' ? SHARE_LABEL[state] : '⧉ Copy result'}</button>
      {image && (
        <button className="ghost-btn" onClick={sendImage}>
          {state === 'shared' || state === 'saved' || state === 'failed' ? SHARE_LABEL[state] : share ? '↗ Share image' : '⤓ Save image'}
        </button>
      )}
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
