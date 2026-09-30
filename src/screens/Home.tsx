import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ROSTERS, Roster } from '../data/rosters';
import { MAX_GUESSES, guessStreak, loadGuesses } from '../game/guess';
import { achievementCount, bestFinish, homeState, runWhere } from '../game/home';
import { Action, Run, dailyNumber } from '../game/state';
import { Stats, dailyStreak, statsSections } from '../game/stats';
import { Avatar } from '../ui/art';
import { HeroArt } from '../ui/HeroArt';
import { ArrowRightIcon, CalendarIcon, CaseIcon, FlagIcon, FlameIcon, InfinityIcon, CrosshairIcon, ShareIcon, StarIcon, StatsIcon, TrophyIcon } from '../ui/icons';
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
}

/**
 * The home screen (#113): the first page, and somewhere you can come back to without touching a run in progress (#115).
 * A hero, the daily challenge panel (#117), three mode cards (#116), your stats (#118) and how it works (#120).
 */
export function HomeScreen({ s, stats, dispatch, setReelFor, showDraft, showGuess, onStats }: HomeProps) {
  const cd = useCountdown();
  const todayN = dailyNumber(cd.day);
  const home = homeState(s, stats, cd.day);
  const doneToday = stats.daily[cd.day];
  const [ask, setAsk] = useState(false);
  const [freeOpen, setFreeOpen] = useState(false);

  // At local midnight the page moves on to the new daily by itself, and says so.
  const [ready, setReady] = useState<number | null>(null);
  const prevDay = useRef(cd.day);
  useEffect(() => { if (prevDay.current !== cd.day) { prevDay.current = cd.day; setReady(dailyNumber(cd.day)); } }, [cd.day]);

  const playDaily = () => { dispatch({ type: 'reset', mode: 'daily' }); setReelFor(1); dispatch({ type: 'spin' }); showDraft(); };
  // A free run replaces whatever run there is, so it asks first when that would abandon a daily that has started.
  const startFree = () => {
    if (home.daily === 'progress' && !ask) { setAsk(true); return; }
    setAsk(false);
    dispatch({ type: 'reset', mode: 'free' });
    setFreeOpen(true);
  };
  const openCase = () => { setReelFor(s.offerKey + 1); dispatch({ type: 'spin' }); showDraft(); };

  const dailyLabel = home.daily === 'progress' ? `Continue today's run · ${runWhere(s)}` : home.daily === 'done' ? "Replay today's run" : home.daily === 'abandoned' ? 'Play it anyway' : "Start today's run";
  const freeShown = freeOpen && s.mode === 'free' && !home.freeInProgress;

  const g = useMemo(() => loadGuesses()[cd.day], [cd.day]);
  const gStreak = useMemo(() => guessStreak(loadGuesses(), cd.day), [cd.day]);
  const streak = dailyStreak(stats.daily, cd.day).current;

  return (
    <div className="home3">
      <section className="hero" aria-label="Major Mayhem">
        <HeroArt />
        <div className="hero__scrim" />
        <div className="hero__text">
          <p className="hero__title" aria-hidden="true"><b>Major</b><i>Mayhem</i></p>
          <p className="hero__tag">Draft a dream team from Counter-Strike Major history and try to win the Major.</p>
        </div>
      </section>

      <aside className="daily-panel" aria-labelledby="daily-panel-h">
        <div className="daily-panel__head"><CalendarIcon size={22} /><h2 id="daily-panel-h">Daily challenge</h2></div>
        <p className="clock" aria-hidden="true">{cd.clock}</p>
        <p className="sr">{cd.spoken}</p>
        <p className="daily-panel__text">Complete today's run and see how far you can go.</p>
        <p className="muted small">1 run per day that counts: replays don't change your record.</p>
        {ready !== null && <p className="daily-ready" role="status">Daily #{ready} is ready.</p>}
      </aside>

      <div className="modes3">
        <article className="mcard mcard--daily" aria-labelledby="mcard-daily-h">
          <span className="mcard__icon"><CalendarIcon size={26} /></span>
          <h2 className="mcard__title" id="mcard-daily-h">Daily Challenge <span>#{todayN}</span></h2>
          {home.daily === 'done' && doneToday
            ? <DailyDone d={doneToday} n={todayN} countdown={false} />
            : <p className="mcard__text">{home.daily === 'abandoned' ? 'You abandoned today\'s run, so it has no result. You can still play it; it won\'t change your record.' : 'One draft per day. Can you win the Major?'}</p>}
          <p className="clock clock--inline" aria-hidden="true">{cd.clock}</p>
          <button type="button" className={`cta ${home.daily === 'done' ? 'cta--quiet' : 'cta--orange'} home__daily`} data-sfx="open" onClick={home.daily === 'progress' ? showDraft : playDaily}>
            {dailyLabel}<ArrowRightIcon size={20} />
          </button>
          {ready !== null && <p className="daily-ready daily-ready--inline" aria-hidden="true">Daily #{ready} is ready.</p>}
        </article>

        <article className="mcard" aria-labelledby="mcard-free-h">
          <span className="mcard__icon"><InfinityIcon size={26} /></span>
          <h2 className="mcard__title" id="mcard-free-h">Free Play</h2>
          <p className="mcard__text">Unlimited drafts. Try different rosters and eras.</p>
          {ask && (
            <div className="mcard__ask" role="alert">
              <p>Starting free play abandons today's daily, and it can't be played for a result again.</p>
              <div className="mcard__ask-btns">
                <button type="button" className="ghost-btn ghost-btn--big" onClick={startFree}>Abandon the daily</button>
                <button type="button" className="ghost-btn ghost-btn--big" onClick={() => setAsk(false)}>Keep it</button>
              </div>
            </div>
          )}
          {freeShown && <ModePicker opts={s.opts ?? {}} dispatch={dispatch} />}
          {home.freeInProgress && <button type="button" className="mbtn mbtn--main" onClick={showDraft}>Continue free play · {runWhere(s)}<ArrowRightIcon size={18} /></button>}
          {freeShown
            ? <button type="button" className="cta cta--orange" data-sfx="open" onClick={openCase}>Open case<ArrowRightIcon size={18} /></button>
            : !ask && <button type="button" className="mbtn" onClick={startFree}>{home.freeInProgress ? 'New free play' : 'Start free play'}<ArrowRightIcon size={18} /></button>}
        </article>

        <article className="mcard" aria-labelledby="mcard-guess-h">
          <span className="mcard__icon"><CrosshairIcon size={26} /></span>
          <h2 className="mcard__title" id="mcard-guess-h">Guess the Pro</h2>
          <p className="mcard__text">Test your knowledge of CS Major history.</p>
          <p className="mcard__state">
            {g?.done ? (g.won ? `Solved in ${g.guesses.length} of ${MAX_GUESSES}` : 'Not solved today') : g?.guesses.length ? `${g.guesses.length} of ${MAX_GUESSES} guesses used` : 'Eight guesses, a new pro every day.'}
            {gStreak > 0 && ` · ${gStreak}-day streak`}
          </p>
          <button type="button" className="mbtn" onClick={showGuess}>{g?.done ? 'See today\'s answer' : g?.guesses.length ? 'Keep guessing' : 'Play now'}<ArrowRightIcon size={18} /></button>
        </article>
      </div>

      <StatsPanel stats={stats} streak={streak} onStats={onStats} />
      <HowItWorks />
    </div>
  );
}

/** Your record from this browser: four figures, each with a word. No level, no account. */
function StatsPanel({ stats, streak, onStats }: { stats: Stats; streak: number; onStats: () => void }) {
  const best = bestFinish(stats);
  const ach = achievementCount(stats);
  const empty = statsSections(stats).empty;
  const tiles: { icon: React.ReactNode; label: string; value: string }[] = [
    { icon: <TrophyIcon size={18} />, label: 'Best finish', value: best ?? '–' },
    { icon: <FlameIcon size={18} />, label: 'Daily streak', value: streak > 0 ? `${streak} day${streak === 1 ? '' : 's'}` : '–' },
    { icon: <StatsIcon size={18} />, label: 'Runs', value: String(stats.runs) },
    { icon: <StarIcon size={18} />, label: 'Achievements', value: `${ach.earned} / ${ach.total}` },
  ];
  return (
    <section className="stats-panel" aria-labelledby="stats-panel-h">
      <div className="stats-panel__head">
        <h2 id="stats-panel-h">Your stats</h2>
        <button type="button" className="link-btn" onClick={onStats}>View all</button>
      </div>
      <ul className="stats-panel__tiles">
        {tiles.map((t) => <li key={t.label}><span className="stats-panel__icon" aria-hidden="true">{t.icon}</span><small>{t.label}</small><b>{t.value}</b></li>)}
      </ul>
      {empty && <p className="muted small">Finish a run to start your record. It is kept in this browser only.</p>}
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
  const shown = !seen || open;
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
        {shown
          ? <button type="button" className="link-btn" onClick={() => { setOpen(false); dismissTip('intro'); }}>{seen ? 'Hide' : 'Got it'}</button>
          : <button type="button" className="link-btn" aria-expanded="false" onClick={() => setOpen(true)}>Open a case, draft, play, share ›</button>}
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
