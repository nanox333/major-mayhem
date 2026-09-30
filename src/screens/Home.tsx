import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ROSTERS, Roster } from '../data/rosters';
import { MAX_GUESSES, guessStreak, loadGuesses } from '../game/guess';
import { achievementCount, bestFinish, dailyButton, dailyPanel, homeState, howExpanded, replaceRisk, runWhere } from '../game/home';
import { Action, Run, dailyDate, dailyNumber } from '../game/state';
import { Stats, dailyStreak, statsSections } from '../game/stats';
import { Avatar } from '../ui/art';
import { ArrowRightIcon, CaseIcon, FlagIcon, FlameIcon, InfinityIcon, CrosshairIcon, ShareIcon, StarIcon, StatsIcon, TrophyIcon } from '../ui/icons';
import { dismissTip, useTipSeen } from '../ui/tips';
import { useCountdown } from '../ui/useCountdown';
import { DailyDone, ModePicker } from './Modes';

interface HomeProps {
  s: Run;
  stats: Stats;
  dispatch: React.Dispatch<Action>;
  /** Plays the case reel for the case that is about to open. */
  setReelFor: (n: number | null) => void;
  /** Goes to the run (the draft, lobby, match or results, wherever it is). */
  showDraft: () => void;
  showGuess: () => void;
  onStats: () => void;
  onBrowse?: () => void;
}

/**
 * The home screen (#113): the first page, and somewhere you can come back to without touching a run in progress (#115).
 * One daily invitation, quieter secondary modes, your actual record and expandable instructions.
 */
export function HomeScreen({ s, stats, dispatch, setReelFor, showDraft, showGuess, onStats, onBrowse }: HomeProps) {
  const cd = useCountdown();
  const todayN = dailyNumber(cd.day);
  const home = homeState(s, stats, cd.day);
  const doneToday = stats.daily[cd.day];
  // Which start is waiting for an answer to "this would throw away your run" (#182).
  const [ask, setAsk] = useState<'daily' | 'free' | null>(null);
  const [freeOpen, setFreeOpen] = useState(false);

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
    dispatch({ type: 'reset', mode: 'daily' }); setReelFor(1); dispatch({ type: 'spin' }); showDraft();
  };
  const startFree = () => {
    if (risk && ask !== 'free') { setAsk('free'); return; }
    setAsk(null);
    dispatch({ type: 'reset', mode: 'free' });
    setFreeOpen(true);
  };
  const openCase = () => { setReelFor(s.offerKey + 1); dispatch({ type: 'spin' }); showDraft(); };

  const btn = dailyButton(home, s);
  const panel = dailyPanel(home, todayN, s, doneToday?.placement);
  const freeShown = freeOpen && s.mode === 'free' && !home.freeInProgress;

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
          <h1 id="home-invitation-title">Five players.<br /><em>One Major.</em></h1>
          <p className="home-invitation__intro">Draft from Major history. See how far your team goes.</p>
          <div className="home-daily-status">
            {home.daily === 'done' && doneToday
              ? <DailyDone d={doneToday} n={todayN} countdown={false} />
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
              <span aria-hidden="true">Next daily in <b className="clock clock--inline">{cd.clock}</b></span>
              <span className="sr">{cd.spoken}</span>
              <small>At your local midnight</small>
            </div>
          </div>
          {ask === 'daily' && risk && (
            <div className="mcard__ask" role="alert">
              <p>{risk}</p>
              <div className="mcard__ask-btns">
                <button type="button" className="ghost-btn ghost-btn--big" onClick={playDaily}>{confirmWord}</button>
                <button type="button" className="ghost-btn ghost-btn--big" onClick={() => setAsk(null)}>Keep it</button>
              </div>
            </div>
          )}
          {home.oldRun && (
            <div className="mcard__old" role="note">
              <p>Daily #{home.oldRun.n} ({home.oldRun.date}) is unfinished. Today is Daily #{todayN}.</p>
              <button type="button" className="mbtn" onClick={showDraft}>Continue Daily #{home.oldRun.n}<ArrowRightIcon size={18} /></button>
            </div>
          )}
          {ready !== null && <p className="daily-ready" role="status">Daily #{ready} is ready.</p>}
        </div>
        <LineupArt />
      </section>

      <div className="modes3 home-secondary-modes">
        <article className="mcard" aria-labelledby="mcard-free-h">
          <span className="home-mode-art" aria-hidden="true"><InfinityIcon size={52} /></span>
          <p className="home-mode-label">Free play</p><h2 className="mcard__title" id="mcard-free-h">Draft anytime.<br />Any era.</h2>
          <p className="mcard__text">Draft as often as you like, in any era.</p>
          <div className="mcard__foot">
            {ask === 'free' && risk && (
              <div className="mcard__ask" role="alert">
                <p>{risk}</p>
                <div className="mcard__ask-btns">
                  <button type="button" className="ghost-btn ghost-btn--big" onClick={startFree}>{confirmWord}</button>
                  <button type="button" className="ghost-btn ghost-btn--big" onClick={() => setAsk(null)}>Keep it</button>
                </div>
              </div>
            )}
            {freeShown && <ModePicker opts={s.opts ?? {}} dispatch={dispatch} />}
            {home.freeInProgress && <button type="button" className="mbtn mbtn--main" onClick={showDraft}>Continue free play · {runWhere(s)}<ArrowRightIcon size={18} /></button>}
            {freeShown
              ? <button type="button" className="cta cta--orange" data-sfx="open" onClick={openCase}><span className="cta__main">Open case<ArrowRightIcon size={18} /></span></button>
              : ask !== 'free' && <button type="button" className="mbtn" onClick={startFree}>{home.freeInProgress ? 'New free play' : 'Start free play'}<ArrowRightIcon size={18} /></button>}
          </div>
        </article>

        <article className="mcard" aria-labelledby="mcard-guess-h">
          <span className="home-mode-art home-mode-art--guess" aria-hidden="true"><CrosshairIcon size={56} /><b>?</b></span>
          <p className="home-mode-label">Guess the Pro</p><h2 className="mcard__title" id="mcard-guess-h">Eight guesses.<br />One pro.</h2>
          <p className="mcard__text">Name the pro in eight guesses.</p>
          <div className="mcard__foot">
            <p className="mcard__state">
              {g?.done ? (g.won ? `Solved in ${g.guesses.length} of ${MAX_GUESSES}` : 'Not solved today') : g?.guesses.length ? `${g.guesses.length} of ${MAX_GUESSES} guesses used` : 'A new pro every day.'}
              {gStreak > 0 && ` · ${gStreak}-day streak`}
            </p>
            <button type="button" className="mbtn" onClick={showGuess}>{g?.done ? "See today's answer" : g?.guesses.length ? 'Keep guessing' : 'Play now'}<ArrowRightIcon size={18} /></button>
          </div>
        </article>
      </div>

      {onBrowse && <button type="button" className="home-archive" aria-label="Explore Major rosters" onClick={onBrowse}><CaseIcon size={24} /><span><b>Roster archive</b><small>Explore historical Major rosters.</small></span><ArrowRightIcon size={20} /></button>}
      <StatsPanel stats={stats} streak={streak} onStats={onStats} />
      <HowItWorks />
    </div>
  );
}

/** An original, deliberately schematic five-starter path, not a simulated bracket. */
function LineupArt() {
  return <svg className="home-lineup-art" viewBox="0 0 500 310" aria-hidden="true" focusable="false">
    {[0, 1, 2, 3, 4].map((i) => <g key={i} transform={`translate(${15 + i * 97},0)`}>
      <text x="41" y="25" textAnchor="middle" className="home-lineup-art__number">{i + 1}</text>
      <rect x="3" y="40" width="76" height="135" fill="var(--inset)" stroke="var(--line)" />
      <circle cx="41" cy="82" r="16" fill="var(--muted)" opacity=".3" />
      <path d="M15 135v-14c0-30 52-30 52 0v14" fill="var(--muted)" opacity=".3" />
      <path d="M35 153h12M41 147v12" stroke="var(--text)" strokeWidth="2" />
    </g>)}
    <g fill="none" stroke="var(--muted)" strokeWidth="1.5">
      <path d="M56 175v30h97v20M153 175v50M250 175v65M347 175v50M444 175v30h-97v20" />
      <path d="M111 225h84v27h-84zM305 225h84v27h-84zM195 239h110" />
    </g>
    <path d="M250 239v36" stroke="var(--accent)" strokeWidth="2" />
    <rect x="180" y="275" width="140" height="32" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />
    <text x="250" y="297" textAnchor="middle" className="home-lineup-art__finish">THE MAJOR</text>
  </svg>;
}

/**
 * Your record from this browser (#118, #153): the number first, then what it is. With nothing to show it is one sentence, not four blanks.
 */
function StatsPanel({ stats, streak, onStats }: { stats: Stats; streak: number; onStats: () => void }) {
  const best = bestFinish(stats);
  const ach = achievementCount(stats);
  const empty = statsSections(stats).empty;
  const tiles: { icon: React.ReactNode; label: string; value: string }[] = [
    { icon: <TrophyIcon size={16} />, label: 'Best finish', value: best ?? '–' },
    { icon: <FlameIcon size={16} />, label: 'Daily streak', value: streak > 0 ? `${streak} day${streak === 1 ? '' : 's'}` : '–' },
    { icon: <StatsIcon size={16} />, label: 'Runs', value: String(stats.runs) },
    { icon: <StarIcon size={16} />, label: 'Achievements', value: `${ach.earned} / ${ach.total}` },
  ];
  return (
    <section className="stats-panel" aria-labelledby="stats-panel-h">
      <div className="stats-panel__head">
        <h2 id="stats-panel-h">Your stats</h2>
        <button type="button" className="link-btn" onClick={onStats}>View all</button>
      </div>
      {empty
        ? <p className="stats-panel__empty">No runs yet. Finish a run to set your best finish, and play the daily to start a streak. Your record stays in this browser.</p>
        : <ul className="stats-panel__tiles">
          {tiles.map((x) => <li key={x.label}><b>{x.value}</b><small><span className="stats-panel__icon" aria-hidden="true">{x.icon}</span>{x.label}</small></li>)}
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
  const seen = useTipSeen('intro');
  const [open, setOpen] = useState(false);
  const shown = howExpanded(seen, open);
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
        {!shown && <p className="how__line">Open a case, draft your team, play the Major, share the result.</p>}
        {shown
          ? <button type="button" className="link-btn" aria-expanded="true" onClick={() => { setOpen(false); dismissTip('intro'); }}>{seen ? 'Hide the steps' : 'Got it'}</button>
          : <button type="button" className="link-btn" aria-expanded="false" onClick={() => setOpen(true)}>Show the steps</button>}
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
