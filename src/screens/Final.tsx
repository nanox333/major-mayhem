import React, { useEffect, useRef, useState } from 'react';
import { ROLE_LABEL, ROLE_SHORT } from '../data/rosters';
import * as G from '../game/logic';
import { Action, Run, dailyDate, dailyNumber, squadOf } from '../game/state';
import { copyText, pageUrl, shareText } from '../game/share';
import { Stats, dailyStreak, isPractice } from '../game/stats';
import { NextDaily } from '../ui/Countdown';
import { Avatar, RatingMark, RoleIcon, Sr, TeamBadge } from '../ui/art';
import { fmt } from '../ui/util';
import { play } from '../ui/sound';
import { cardFileName, drawResultCard, siteHost } from '../ui/card';
import { cleanName, duelFrom, duelLink } from '../game/duel';
import { reportError, track } from '../analytics';
import { RosterList, Staff } from './Lobby';
import { achievementById } from '../game/achievements';
import { StageTrack } from './Match';
import { teamReview } from '../game/review';
import { Modal } from '../ui/Modal';

export function FinalScreen({ mine, s, stats, dispatch }: { mine: G.Lineup[]; s: Run; stats: Stats; dispatch: React.Dispatch<Action> }) {
  const pl = G.placement(s.t);
  const star = G.mvp(s.t, squadOf(s));
  const champ = pl.key === 'CHAMP';
  const ratings = G.seriesRatings(s.t.matches.flatMap((m) => m.maps));
  const date = dailyDate(s);
  const streak = date ? dailyStreak(stats.daily, date).current : 0;
  // A replay of a daily that already has a result is practice: it shows and shares as practice and changes nothing in your record (#162).
  const practice = isPractice(stats, s);
  // The result, once the banner has landed; then the achievement bell, if this run earned one.
  useEffect(() => {
    const t = setTimeout(() => play(champ ? 'champion' : pl.key === 'DUEL-W' ? 'mapWin' : 'mapLose'), 350);
    return () => clearTimeout(t);
  }, []);
  const [report, setReport] = useState<number | null>(null);
  const newAch = s.recorded ? stats.lastNew?.length ?? 0 : 0;
  useEffect(() => {
    if (!newAch) return;
    const t = setTimeout(() => play('achievement'), 1900);
    return () => clearTimeout(t);
  }, [newAch]);
  return (
    <div className="final">
      <div className={`final__banner ${champ || pl.key === 'DUEL-W' ? 'is-champ' : ''}`}>
        {s.duel ? (
          <>
            <small>Draft duel vs {s.duel.name}'s team</small>
            <h3>{pl.key === 'DUEL-W' ? 'You won' : 'They won'} {s.t.matches[0]?.score.join('–')}</h3>
          </>
        ) : (
          <>
            <small>{date ? `Daily #${dailyNumber(date)} · ` : ''}Your Major Mayhem team finished</small>
            <h3>{champ ? 'Major champions' : pl.label}</h3>
          </>
        )}
      </div>
      {practice && <p className="practice" role="note">Practice run: Daily #{dailyNumber(date!)} already has a result, so this one doesn't change your record, your streak or your achievements.</p>}
      {!s.duel && <StageTrack t={s.t} />}
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
        text={() => shareText(s, pageUrl(), practice)}
        image={{ draw: () => drawResultCard(s, siteHost()), name: cardFileName(s) }}
        props={{ mode: s.mode, placement: pl.key, ...(date ? { daily: dailyNumber(date) } : {}) }}
      />
      <ChallengeBar s={s} />
      {date && (
        <p className="daily-meta">
          {streak > 1 && <span>🔥 {streak}-day daily streak</span>}
          <NextDaily />
        </p>
      )}
      <RosterList mine={mine} stats={ratings} mvpId={star.player.id} />
      <Staff s={s} stats={ratings} />
      <PathView s={s} onOpen={setReport} />
      {report !== null && s.t.matches[report] && <MatchReport m={s.t.matches[report]} onClose={() => setReport(null)} />}
      <TeamReviewCard mine={mine} s={s} />
      <DraftReview picks={s.picks} />
      {stats.runs > 0 && (
        <p className="muted small">
          Lifetime: {stats.titles} title{stats.titles === 1 ? '' : 's'} in {stats.runs} run{stats.runs === 1 ? '' : 's'}
          {stats.streak > 1 ? ` · ${stats.streak} titles in a row` : ''}{stats.bestStreak > 1 ? ` · best streak ${stats.bestStreak}` : ''}
        </p>
      )}
      <div className="final__actions action-bar">
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

const NAME_KEY = 'mm-name';
/** Sends this team as a draft duel: the friend drafts from the same cases, then the two teams play a Bo3. */
function ChallengeBar({ s }: { s: Run }) {
  const [name, setName] = useState(() => { try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; } });
  const [state, setState] = useState<'idle' | 'copied' | 'shared' | 'failed'>('idle');
  const done = (x: typeof state) => { setState(x); setTimeout(() => setState('idle'), 2200); };
  const send = async () => {
    try { localStorage.setItem(NAME_KEY, name); } catch { /* storage unavailable */ }
    const link = duelLink(pageUrl() ?? __SITE__.url, duelFrom(s, name));
    const text = `${cleanName(name)} challenges you to a Major Mayhem draft duel: same cases, then a best-of-three.`;
    if (canShareLink()) {
      try { await navigator.share({ text, url: link }); track('challenge', { method: 'share', mode: s.mode }); return done('shared'); }
      catch (e) { if (e instanceof DOMException && e.name === 'AbortError') return; }
    }
    const ok = await copyText(`${text}\n${link}`);
    track('challenge', { method: 'copy', mode: s.mode, ok });
    done(ok ? 'copied' : 'failed');
  };
  return (
    <div className="challenge">
      <label>
        <span>{s.duel ? 'Challenge back, or send this team to someone else' : 'Challenge a friend with this team'}</span>
        <input value={name} maxLength={24} placeholder="Your name" onChange={(e) => setName(e.target.value)} aria-label="Your name for the challenge" />
      </label>
      <button className="ghost-btn" onClick={send}>
        {state === 'copied' ? '✓ Link copied' : state === 'shared' ? '✓ Sent' : state === 'failed' ? 'Copy blocked by the browser' : '⚔ Challenge'}
      </button>
    </div>
  );
}
const canShareLink = () => { try { return matchMedia('(pointer: coarse)').matches && typeof navigator.share === 'function'; } catch { return false; } };

/** Reveals the hidden game ratings: what you took vs the strongest pick on the board that round. */
/**
 * A finished match, read from the saved record (#66): nothing is re-simulated, so reopening it can't change a result.
 * Older saves without some details just show less.
 */
function MatchReport({ m, onClose }: { m: G.Match; onClose: () => void }) {
  const opp = G.rosterById.get(m.opponentId)!;
  const [i, setI] = useState(0);
  const g = m.maps[i];
  const marks = (r: number) => {
    const out: string[] = [];
    if (r === 0 || r === 12) out.push('pistol');
    if (g.calls?.timeouts.includes(r)) out.push('timeout');
    if (g.calls?.force.includes(r)) out.push('force buy');
    if (g.events.some((e) => e.kind === 'clutch' && e.round === r + 1)) out.push('clutch');
    return out;
  };
  const table = (rows: G.MapGame['stats']['mine'], label: string) => (
    <table className="report__table">
      <thead><tr><th>{label}</th><th>K</th><th>D</th><th>Rating</th></tr></thead>
      <tbody>{[...rows].sort((a, b) => b.rating - a.rating).map((p) => <tr key={p.id}><td>{p.nick}</td><td>{p.k}</td><td>{p.d}</td><td>{fmt(p.rating)}<RatingMark r={p.rating} /></td></tr>)}</tbody>
    </table>
  );
  return (
    <Modal label="Match report" onClose={onClose}>
      <h3>{G.STAGE_NAME[m.stage]} vs {opp.org} {opp.year}: {m.won ? 'won' : 'lost'} {m.score[0]}–{m.score[1]}</h3>
      {m.maps.length > 1 && (
        <div className="seg report__maps" role="tablist" aria-label="Maps">
          {m.maps.map((x, k) => <button key={k} role="tab" aria-selected={k === i} className={k === i ? 'is-on' : ''} onClick={() => setI(k)}>{x.map} {x.score[0]}–{x.score[1]}</button>)}
        </div>
      )}
      {g && (
        <>
          <p className="muted small">{g.map}: {g.won ? 'won' : 'lost'} {g.score[0]}–{g.score[1]}, starting on {g.start}{g.rounds.length > 24 ? ', after overtime' : ''}.</p>
          <ol className="report__rounds" aria-label="Rounds">
            {g.rounds.map((won, r) => {
              const tags = marks(r);
              return (
                <li key={r} className={`${won ? 'w' : 'l'}${r === 12 || (r >= 24 && (r - 24) % 3 === 0) ? ' swap' : ''}`} title={`Round ${r + 1}: ${won ? 'won' : 'lost'}${tags.length ? ` · ${tags.join(', ')}` : ''}`}>
                  <span className="sr">Round {r + 1} {won ? 'won' : 'lost'}{tags.length ? `, ${tags.join(', ')}` : ''}</span>
                  {tags.includes('timeout') ? 'T' : tags.includes('force buy') ? 'F' : tags.includes('clutch') ? '★' : ''}
                </li>
              );
            })}
          </ol>
          <p className="muted small">Solid green won, striped red lost; a gap marks halftime and each overtime swap. T timeout, F force buy, ★ clutch.</p>
          {table(g.stats.mine, 'Your team')}
          {table(g.stats.opp, opp.tag)}
          {g.events.filter((e) => e.kind === 'call' || e.kind === 'clutch' || e.kind === 'half' || e.kind === 'ot').length > 0 && (
            <ul className="report__events small">
              {g.events.filter((e) => e.kind === 'call' || e.kind === 'clutch' || e.kind === 'half' || e.kind === 'ot').map((e, k) => <li key={k}><span className="muted">R{e.round}</span> {e.text}</li>)}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}

/** The team as a whole (#18): role balance, chemistry, who stood out, maps and calls, and one thing to try next. */
function TeamReviewCard({ mine, s }: { mine: G.Lineup[]; s: Run }) {
  const r = teamReview(mine, s.coach, s.t);
  return (
    <section className="review anim-in" aria-label="Team review">
      <div className="review__head"><span>Team review</span></div>
      <ul className="review__facts">
        <li><b>Roles</b> {r.roles.main} in their main role{r.roles.secondary ? `, ${r.roles.secondary} in a secondary role` : ''}{r.roles.off ? `, ${r.roles.off} off-role` : ''}</li>
        <li><b>Chemistry</b> {r.synergies.length ? r.synergies.join(' · ') : 'none'}</li>
        {r.strongest && <li><b>Stood out</b> {r.strongest.nick} ({fmt(r.strongest.rating)}){r.weakest ? `; quietest: ${r.weakest.nick} (${fmt(r.weakest.rating)})` : ''}</li>}
        <li><b>Maps</b> {r.maps.won} won, {r.maps.lost} lost{r.maps.bestMap ? ` · best on ${r.maps.bestMap}` : ''}{r.maps.worstMap ? ` · struggled on ${r.maps.worstMap}` : ''}</li>
        <li><b>Calls</b> {r.calls.timeouts} timeout{r.calls.timeouts === 1 ? '' : 's'}{r.calls.forces ? `, ${r.calls.forces} force buy${r.calls.forces === 1 ? '' : 's'} (${r.calls.forcesWon} won)` : ', no force buys'}</li>
      </ul>
      <p className="review__tip"><b>Next run:</b> {r.suggestion}</p>
    </section>
  );
}

function DraftReview({ picks }: { picks: G.Pick[] }) {
  const { rounds, grade } = G.draftReview(picks);
  if (grade === null) return null;
  return (
    <section className="review anim-in" aria-label="Pick strength">
      <div className="review__head">
        <span>Pick strength</span>
        <b className={grade >= 0.98 ? 'hi' : grade < 0.92 ? 'lo' : ''}>{Math.round(grade * 100)}%{grade >= 0.98 ? <><i className="rmark" aria-hidden="true"> ▲</i><Sr> high</Sr></> : grade < 0.92 ? <><i className="rmark" aria-hidden="true"> ▼</i><Sr> low</Sr></> : null}</b>
      </div>
      <p className="muted small">
        How strong each pick was on its own: hidden game ratings adjusted for role fit, against the strongest individual
        option in that round's case. It doesn't measure chemistry, the coach, map calls or luck, so a high score and an
        early exit can go together. The team review covers the rest.
      </p>
      <ol className="review__list">
        {rounds.map((r, i) => {
          const top = !r.best || r.best.player.id === r.player.id || r.value >= r.best.value - 0.01;
          return (
            <li key={i} className={top ? 'is-top' : ''}>
              <span className="review__round">R{i + 1}</span>
              <span className="review__pick"><RoleIcon role={r.slot} size={12} /> <b>{r.player.nick}</b> <em>{Math.round(r.value)}</em></span>
              <span className="review__best">
                {top ? 'Strongest individual option' : (
                  <>Strongest option: <TeamBadge roster={r.best!.roster} size={14} /> <b>{r.best!.player.nick}</b> {ROLE_SHORT[r.best!.slot]} <em>{Math.round(r.best!.value)}</em></>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * The path through the Major (#72): the Swiss stage with its record and how it ended, then the playoffs as a short rail from the quarterfinal to the
 * final, then where the run ended. Every match opens its report (#66), so the score, the maps and the key rounds are a tap away.
 */
function PathView({ s, onOpen }: { s: Run; onOpen: (i: number) => void }) {
  const t = s.t;
  const pl = G.placement(t);
  const items = t.matches.map((m, i) => ({ m, i }));
  const swiss = items.filter(({ m }) => m.stage === 'QUAL');
  const playoffs = items.filter(({ m }) => m.stage !== 'QUAL' && m.stage !== 'DUEL');
  const duel = items.filter(({ m }) => m.stage === 'DUEL');
  const need = G.qualNeed(t);
  const row = ({ m, i }: { m: G.Match; i: number }) => {
    const o = G.rosterById.get(m.opponentId)!;
    const stage = m.stage === 'QUAL' ? `Bo${m.bestOf}` : m.stage === 'DUEL' ? 'Bo3' : m.stage === 'F' ? 'Final' : m.stage;
    return (
      <li key={i} className={m.won ? 'w' : 'l'}>
        {/* Each row opens the saved report for that match (#66). */}
        <button className="history__row" onClick={() => onOpen(i)} aria-label={`Match report: ${m.won ? 'won' : 'lost'} ${m.score[0]}–${m.score[1]} against ${o.org} ${o.year}`}>
          <span>{stage}</span>
          <span className="history__opp">{o.org} {o.year}</span>
          <span className="history__maps">{m.maps.map((g) => `${g.map} ${g.score[0]}–${g.score[1]}`).join(', ')}</span>
          <b>{m.won ? '✓' : '✗'} {m.score[0]}–{m.score[1]} ›</b>
        </button>
      </li>
    );
  };
  if (duel.length) return <ul className="history">{duel.map(row)}</ul>;
  return (
    <div className="path">
      {swiss.length > 0 && (
        <section aria-labelledby="path-swiss">
          <h4 id="path-swiss">{t.qual.need ? 'Swiss stage' : 'Qualification'} <span>{t.qual.w}–{t.qual.l}{t.qual.w >= need ? ' · advanced' : t.qual.l >= need ? ' · out' : ''}</span></h4>
          <ul className="history">{swiss.map(row)}</ul>
        </section>
      )}
      {playoffs.length > 0 && (
        <section aria-labelledby="path-playoffs">
          <h4 id="path-playoffs">Playoffs</h4>
          <ul className="history path__rail">{playoffs.map(row)}</ul>
        </section>
      )}
      <p className={`path__end ${pl.key === 'CHAMP' ? 'is-champ' : ''}`}><span>Finished</span><b>{pl.label}</b></p>
    </div>
  );
}
