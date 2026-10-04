import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ROLE_ORDER, ROSTERS, Role, Roster } from '../data/rosters';
import { MAX_GUESSES, guessStreak, loadGuesses } from '../game/guess';
import { achievementCount, bestFinish, dailyButton, dailyPanel, homeState, replaceRisk, runWhere } from '../game/home';
import { Action, Run, dailyDate, dailyNumber } from '../game/state';
import { Stats, dailyStreak, statsSections } from '../game/stats';
import caseArt from '../assets/home/case.svg';
import proArt from '../assets/home/pro-silhouette.svg';
import { LogoMark } from '../ui/TopBar';
import { Avatar, RoleIcon } from '../ui/art';
import { ArrowRightIcon, CaseIcon, ClockIcon, FlagIcon, FlameIcon, ShareIcon, StarIcon, StatsIcon, TrophyIcon } from '../ui/icons';
import { useCountdown } from '../ui/useCountdown';
import { DailyDone } from './Modes';

interface HomeProps {
  s: Run;
  stats: Stats;
  dispatch: React.Dispatch<Action>;
  /** Goes to the run (the draft, lobby, match or results, wherever it is). */
  showDraft: () => void;
  /** Opens the free-play setup page. */
  showSetup: () => void;
  showGuess: () => void;
  onStats: () => void;
  onBrowse?: () => void;
}

/**
 * The home screen (#113): the first page, and somewhere you can come back to without touching a run in progress (#115).
 * One daily invitation, quieter secondary modes, your actual record and expandable instructions.
 */
export function HomeScreen({ s, stats, dispatch, showDraft, showSetup, showGuess, onStats, onBrowse }: HomeProps) {
  const cd = useCountdown();
  const todayN = dailyNumber(cd.day);
  const home = homeState(s, stats, cd.day);
  const doneToday = stats.daily[cd.day];
  // Which start is waiting for an answer to "this would throw away your run" (#182).
  const [ask, setAsk] = useState<'daily' | 'free' | null>(null);

  // At local midnight the page moves on to the new daily by itself, and says so.
  const [ready, setReady] = useState<number | null>(null);
  const prevDay = useRef(cd.day);
  useEffect(() => { if (prevDay.current !== cd.day) { prevDay.current = cd.day; setReady(dailyNumber(cd.day)); } }, [cd.day]);

  // Starting any run replaces the one there is, so it asks first whenever that would throw one away: the same question from every button (#182).
  const risk = replaceRisk(home, s);
  const confirmWord = home.oldRun || home.daily === 'progress' ? 'Abandon it and start' : 'Replace it';
  const playDaily = () => {
    if (risk && ask !== 'daily') { setAsk('daily'); return; }
    setAsk(null);
    // A new draft starts on the sealed case; the reels run when you open it.
    dispatch({ type: 'reset', mode: 'daily' }); showDraft();
  };
  const startFree = () => {
    if (risk && ask !== 'free') { setAsk('free'); return; }
    setAsk(null);
    dispatch({ type: 'reset', mode: 'free' });
    showSetup();
  };

  const btn = dailyButton(home, s);
  const panel = dailyPanel(home, todayN, s, doneToday?.placement);

  const g = useMemo(() => loadGuesses()[cd.day], [cd.day]);
  const gStreak = useMemo(() => guessStreak(loadGuesses(), cd.day), [cd.day]);
  const streak = dailyStreak(stats.daily, cd.day).current;

  const savedDaily = dailyDate(s);
  const resultAvailable = home.daily === 'done' && s.phase === 'final' && savedDaily === cd.day;
  const action = resultAvailable ? 'View your result' : btn.action;
  const dailyClick = home.daily === 'progress' || resultAvailable ? showDraft : playDaily;

  return (
    <div className="home3 editorial-home">
      <section className="home-invitation" aria-labelledby="home-invitation-title">
        <div className="home-invitation__copy">
          <p className="home-kicker">Daily challenge <span>#{todayN}</span></p>
          <h1 id="home-invitation-title"><span>Five players.</span><em>One Major.</em></h1>
          <p className="home-invitation__intro">Draft from Major history. See how far your team goes.</p>
          <div className="home-daily-status">
            {home.daily === 'done' && doneToday
              ? null
              : <p>{home.daily === 'abandoned' ? "Today's run was abandoned. You can play for practice; it won't change your record." : home.daily === 'progress' ? `Your run is waiting · ${runWhere(s)}.` : 'Seven picks: five starters, a coach and a bench player. Same cases for everyone.'}</p>}
            {home.daily === 'done' && <p className="home-practice-note">{resultAvailable ? 'Your result is saved in this browser.' : "Replay for practice. It won't change your record."}</p>}
            {panel.progress && <ol className="dots" aria-label={`Round ${panel.progress.at} of ${panel.progress.of}`}>
              {Array.from({ length: panel.progress.of }, (_, i) => <li key={i} className={i < panel.progress!.at - 1 ? 'is-done' : i === panel.progress!.at - 1 ? 'is-now' : ''} />)}
            </ol>}
          </div>
          <div className="home-daily-action">
            <button type="button" className={`cta ${btn.quiet && !resultAvailable ? 'cta--quiet' : 'cta--orange'} home__daily`} data-sfx="open" onClick={dailyClick}>
              <span className="cta__main">{action}<ArrowRightIcon size={20} /></span>
            </button>
            <div className="home-daily-clock">
              <ClockIcon size={20} />
              <span aria-hidden="true">Next daily in <b className="clock clock--inline">{cd.clock}</b></span>
              <span className="sr">{cd.spoken}</span>
              <small>At your local midnight</small>
            </div>
          </div>
          {/* The site opens on this page, so a run that has just finished (and isn't today's daily, which has its own button above) stays one press from its results. */}
          {s.phase === 'final' && s.offerKey > 0 && !resultAvailable && (
            <p className="home-last-result"><button type="button" className="link-btn" onClick={showDraft}>View your last result</button></p>
          )}
          {ask === 'daily' && risk && (
            <div className="mcard__ask" role="alert">
              <p>{risk}</p>
              <div className="mcard__ask-btns">
                <button type="button" className="st-btn is-ask" onClick={playDaily}>{confirmWord}</button>
                <button type="button" className="st-btn" onClick={() => setAsk(null)}>Keep it</button>
              </div>
            </div>
          )}
          {home.oldRun && (
            <div className="mcard__old" role="note">
              <p>Daily #{home.oldRun.n} ({home.oldRun.date}) is unfinished. Today is Daily #{todayN}.</p>
              <button type="button" className="mbtn" onClick={showDraft}><span>Continue Daily #{home.oldRun.n}</span><ArrowRightIcon size={22} /></button>
            </div>
          )}
          {ready !== null && <div className="daily-ready" role="status"><span className="daily-ready__tag">New daily</span><b className="daily-ready__n">#{ready}</b><span className="daily-ready__text">A fresh draft just dropped. Same teams for everyone.</span></div>}
        </div>
        <LineupArt />
      </section>

      {home.daily === 'done' && doneToday && <section className="home-result" aria-label="Today's result"><DailyDone d={doneToday} n={todayN} countdown={false} streak={streak} /></section>}

      <div className="modes3 home-secondary-modes">
        <article className={`mcard home-mode-card home-mode-card--free ${home.freeInProgress || ask === 'free' ? 'home-mode-card--expanded' : ''}`} aria-labelledby="mcard-free-h">
          <span className="home-mode-art home-mode-art--free" aria-hidden="true"><img src={caseArt} alt="" width="480" height="240" /><span className="home-case-mark"><LogoMark size={30} /></span></span>
          <p className="home-mode-label">Free play</p><h2 className="mcard__title" id="mcard-free-h">Draft anytime.<br />Any era.</h2>
          <p className="mcard__text">Draft as often as you like, in any era.</p>
          <div className="mcard__foot">
            {ask === 'free' && risk && (
              <div className="mcard__ask" role="alert">
                <p>{risk}</p>
                <div className="mcard__ask-btns">
                  <button type="button" className="st-btn is-ask" onClick={startFree}>{confirmWord}</button>
                  <button type="button" className="st-btn" onClick={() => setAsk(null)}>Keep it</button>
                </div>
              </div>
            )}
            {home.freeInProgress && <button type="button" className="mbtn mbtn--main" onClick={showDraft}><span>{s.mode === 'duel' ? 'Continue draft duel' : 'Continue free play'} · {runWhere(s)}</span><ArrowRightIcon size={22} /></button>}
            {ask !== 'free' && <button type="button" className={`mbtn ${home.freeInProgress ? '' : 'home-mode-start'}`} onClick={startFree}><span>{home.freeInProgress ? 'New free play' : 'Start free play'}</span><ArrowRightIcon size={22} /></button>}
          </div>
        </article>

        <article className="mcard home-mode-card home-mode-card--guess" aria-labelledby="mcard-guess-h">
          <span className="home-mode-art home-mode-art--guess" aria-hidden="true">
            <img src={proArt} alt="" width="480" height="456" /><span className="home-pro-question">?</span>
          </span>
          <p className="home-mode-label">Guess the Pro</p><h2 className="mcard__title" id="mcard-guess-h">Eight guesses.<br />One pro.</h2>
          <p className="mcard__text">Name the pro in eight guesses.</p>
          <div className="mcard__foot">
            {(g?.done || g?.guesses.length || gStreak > 0) && <p className="mcard__state">
              {g?.done ? (g.won ? `Solved in ${g.guesses.length} of ${MAX_GUESSES}` : 'Not solved today') : g?.guesses.length ? `${g.guesses.length} of ${MAX_GUESSES} guesses used` : ''}
              {gStreak > 0 && `${g?.done || g?.guesses.length ? ' · ' : ''}${gStreak}-day streak`}
            </p>}
            <button type="button" className="mbtn home-mode-start" onClick={showGuess}><span>{g?.done ? "See today's answer" : g?.guesses.length ? 'Keep guessing' : 'Play now'}</span><ArrowRightIcon size={22} /></button>
          </div>
        </article>
      </div>

      {onBrowse && <button type="button" className="home-archive" aria-label="Explore Major rosters" onClick={onBrowse}><ArchiveArt /><span><b>Roster archive</b><small>Explore historical Major rosters.</small></span><ArrowRightIcon size={20} /></button>}
      <StatsPanel stats={stats} streak={streak} onStats={onStats} />
      <HowItWorks />
    </div>
  );
}

/** Decorative archive cards: neutral silhouettes, no invented historical player. */
function ArchiveArt() {
  return <svg className="home-archive-art" width="72" height="48" viewBox="0 0 72 48" aria-hidden="true" focusable="false">
    {[-12, 0, 12].map((angle, i) => <g key={angle} transform={`translate(${8 + i * 12},5) rotate(${angle},15,20)`}>
      <rect width="30" height="38" rx="2" fill="var(--inset)" stroke="var(--control)" />
      <path d="M4 5h4" stroke="var(--accent)" strokeWidth="2" />
      <circle cx="15" cy="15" r="5" fill="var(--muted)" opacity=".4" />
      <path d="M6 31v-3c0-10 18-10 18 0v3z" fill="var(--muted)" opacity=".4" />
    </g>)}
  </svg>;
}

const LART_NAME: Record<Role, string> = { IGL: 'IGL', AWP: 'AWPer', ENTRY: 'Entry', LURK: 'Lurker', SUP: 'Support' };

/** Five open slots in a staggered row, one per role, lit from the arena's side: the team you are about to build. Schematic and original, no real player. */
function LineupArt({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`home-lineup-art ${compact ? 'home-lineup-art--compact' : ''}`} aria-hidden="true">
      <ol className="lart">
        {ROLE_ORDER.map((role, i) => (
          <li key={role} className={`lart__card ${i === 2 ? 'is-lead' : ''}`} style={{ ['--i' as string]: i }}>
            <span className="lart__no">{i + 1}</span>
            <svg className="lart__who" viewBox="0 0 80 100" focusable="false"><circle cx="40" cy="34" r="17" /><path d="M8 100V82c0-20 64-20 64 0v18z" /></svg>
            <span className="lart__role"><RoleIcon role={role} size={18} /><b>{LART_NAME[role]}</b></span>
          </li>
        ))}
      </ol>
      <p className="lart__line">Build your five. <em>Win the Major.</em></p>
    </div>
  );
}

/**
 * Your record from this browser (#118, #153): the number first, then what it is. With nothing to show it is one sentence, not four blanks.
 */
function StatsPanel({ stats, streak, onStats }: { stats: Stats; streak: number; onStats: () => void }) {
  const best = bestFinish(stats);
  const ach = achievementCount(stats);
  const empty = statsSections(stats).empty;
  const tiles: { icon: React.ReactNode; label: string; value: string; tone?: string }[] = [
    { icon: <TrophyIcon size={26} />, label: 'Best finish', value: best === 'Out in the Swiss stage' ? 'Swiss exit' : best ?? '–', tone: stats.titles > 0 ? 'gold' : undefined },
    { icon: <FlameIcon size={26} />, label: 'Daily streak', value: streak > 0 ? `${streak} day${streak === 1 ? '' : 's'}` : '–', tone: streak > 0 ? 'fire' : undefined },
    { icon: <StatsIcon size={26} />, label: 'Runs', value: String(stats.runs) },
    { icon: <StarIcon size={26} />, label: 'Achievements', value: `${ach.earned} / ${ach.total}` },
  ];
  return (
    <section className="stats-panel" aria-labelledby="stats-panel-h">
      <div className="stats-panel__head">
        <h2 id="stats-panel-h">Your stats</h2>
        <button type="button" className="link-btn stats-panel__all" onClick={onStats}>View all stats <ArrowRightIcon size={16} /></button>
      </div>
      {empty
        ? <p className="stats-panel__empty">No runs yet. Finish a run to set your best finish, and play the daily to start a streak. Your record stays in this browser.</p>
        : <ul className="stats-panel__tiles">
          {tiles.map((x) => <li key={x.label} className={x.tone ? `is-${x.tone}` : ''}><span className="stats-panel__icon" aria-hidden="true">{x.icon}</span><b>{x.value}</b><small>{x.label}</small></li>)}
        </ul>}
    </section>
  );
}

/** A real roster for the sample: the latest champions in the data, so it can't go out of date. */
const SAMPLE: Roster = [...ROSTERS].filter((r) => r.result === 'Champions').sort((a, b) => b.year - a.year)[0];

/**
 * How it works, in four steps built from the game's own pieces (#120). Open for a first visit, one line for anyone who has played
 * (the same "seen" state as the first-time tips), and always one press away.
 */
function HowItWorks() {
  const shown = true;
  const steps = [
    { title: 'Open a case', text: 'Three iconic rosters from Major history.', art: <span className="how__art how__art--case"><CaseIcon size={34} /></span> },
    { title: 'Draft your team', text: 'Pick a player at a time: five, a coach and a bench player.', art: (
      <span className="how__art how__art--roster" title={`${SAMPLE.org} ${SAMPLE.year}`}>
        {SAMPLE.players.map((p) => <span key={p.id} className="how__face"><Avatar player={p} roster={SAMPLE} /></span>)}
      </span>
    ) },
    { title: 'Play the Major', text: 'A Swiss stage, then the playoffs, against rosters from Major history.', art: (
      <svg className="how__art how__art--bracket" viewBox="0 0 120 64" aria-hidden="true" focusable="false">
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 8h22v10H6zM6 46h22v10H6z" /><path d="M28 13h10v19M28 51h10V32M38 32h14" />
          <path d="M52 27h22v10H52z" /><path d="M74 32h12" /><path d="M96 20h14v10h-4v5h-6v-5h-4z" /><path d="M103 35v6M98 41h10" />
        </g>
      </svg>
    ) },
    { title: 'Share', text: 'See how far you got and compare with friends.', art: (
      <span className="how__art how__art--card"><FlagIcon size={20} /><b>1st place</b><ShareIcon size={16} /></span>
    ) },
  ];
  return (
    <section className={`how ${shown ? 'is-open' : ''}`} aria-labelledby="how-h">
      <div className="how__head">
        <h2 id="how-h">How it works</h2>
      </div>
      {shown && (
        <>
          <ol className="how__steps">
            {steps.map((x) => <li key={x.title} className="how__step">{x.art}<b>{x.title}</b><span className="how__text">{x.text}</span></li>)}
          </ol>
          <p className="how__sample muted small">The roster above is a real one: {SAMPLE.org} {SAMPLE.year}, {SAMPLE.event}.</p>
        </>
      )}
    </section>
  );
}
