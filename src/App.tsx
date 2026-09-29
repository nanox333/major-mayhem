import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ROLE_LABEL, ROLE_ORDER } from './data/rosters';
import * as G from './game/logic';
import { Action, Phase, Run, currentLineup, dailyDate, dailyNumber, draftRounds, load, optsLabel, reducer, roundNumber, roundOf, save, today } from './game/state';
import { abandonDaily, dailyStarted, loadStats, recordDuel, recordRun } from './game/stats';
import { Duel, decodeDuel, duelCode } from './game/duel';
import { BoardHost } from './ui/Board';
import { Modal } from './ui/Modal';
import { useRunTracking } from './ui/useTracking';
import { RoleIcon } from './ui/art';
import { DraftScreen } from './screens/Draft';
import { ReadyScreen } from './screens/Lobby';
import { LiveScreen, PreviewScreen } from './screens/Match';
import { FinalScreen } from './screens/Final';
import { HelpModal } from './screens/Help';
import { StatsModal } from './screens/Stats';
import { ChatVoteBar, ChatVoteProvider, TwitchButton, TwitchPanel } from './ui/ChatVote';
import { GuessScreen } from './screens/Guess';

export default function App() {
  return <ChatVoteProvider><Game /></ChatVoteProvider>;
}

function Game() {
  const [s, rawDispatch] = useReducer(reducer, undefined, load);
  const latest = useRef(s);
  latest.current = s;
  // Resetting a daily after opening a case records it as abandoned, so it can't be replayed with hindsight.
  const dispatch = useCallback((a: Action) => {
    if ((a.type === 'reset' || a.type === 'duel') && dailyStarted(latest.current)) setStats(abandonDaily(latest.current));
    rawDispatch(a);
  }, []);
  const [help, setHelp] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [twitch, setTwitch] = useState(false);
  const [stats, setStats] = useState(loadStats);
  const [reelFor, setReelFor] = useState<number | null>(null);
  // A challenge link (#duel=…) opens an invite; the hash is cleared so a reload doesn't ask again.
  const [invite, setInvite] = useState<{ duel: Duel | null } | null>(() => {
    const code = typeof location !== 'undefined' ? duelCode(location.hash) : null;
    if (!code) return null;
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* not allowed: fine */ }
    return { duel: decodeDuel(code) };
  });
  useEffect(() => save(s), [s]);
  useRunTracking(s);
  // Count each finished run once, even across reloads.
  useEffect(() => {
    if (s.phase === 'final' && !s.recorded) { setStats(s.mode === 'duel' ? recordDuel(s) : recordRun(s)); dispatch({ type: 'recorded' }); }
  }, [s.phase, s.recorded]);

  const mine = useMemo(() => (s.picks.length === 5 ? G.lineupFromPicks(s.picks) : null), [s.picks]);
  // The five on the server for the match being played: the bench player may be in, and everyone has match-day form.
  const playing = useMemo(() => (mine && s.current ? currentLineup(s) : mine), [mine, s.current?.subOut, s.current?.playerForm, s.bench]);
  const round = roundOf(s);
  const stageNow = (s.pending ?? s.current)?.stage;

  const steps: { k: Phase[]; label: string }[] = [
    { k: ['draft'], label: 'Draft' }, { k: ['ready'], label: 'Lobby' }, { k: ['preview', 'live'], label: s.duel ? 'Showmatch' : 'Major' }, { k: ['final'], label: 'Results' },
  ];
  const stepIdx = steps.findIndex((x) => x.k.includes(s.phase));

  let title = s.step === 'players' ? (round === 'bench' ? 'Choose your bench player' : 'Choose your player')
    : s.step === 'teams' ? (round === 'coach' ? 'Pick a coach' : round === 'bench' ? 'Pick a team for the bench' : 'Pick a team') : 'Open a case';
  const date = dailyDate(s);
  const tags = optsLabel(s.opts).map((x) => `${x} · `).join('');
  let kicker = `${date ? `Daily #${dailyNumber(date)} · ` : s.duel ? `Draft duel vs ${s.duel.name} · ` : tags}Draft · Round ${roundNumber(s)} of ${draftRounds(s)}${round === 'coach' ? ' · Coach' : round === 'bench' ? ' · Bench' : ''}`;
  if (s.phase === 'ready') { title = 'Ready to rumble'; kicker = `Lobby · ${draftRounds(s)} of ${draftRounds(s)} drafted`; }
  if (s.phase === 'preview' || s.phase === 'live') { title = G.STAGE_NAME[stageNow!]; kicker = `${s.duel ? 'Draft duel' : 'Major'} · Best of ${s.current?.bestOf ?? G.bestOfFor(stageNow!, s.t)}`; }
  if (s.phase === 'final') { title = s.duel ? 'Showmatch over' : 'Tournament over'; kicker = 'Results'; }
  // The second daily, Guess the pro, has its own tab and doesn't touch the draft run.
  const [view, setView] = useState<'draft' | 'guess'>('draft');
  if (view === 'guess') { title = 'Guess the pro'; kicker = `Daily #${dailyNumber(today())} · Guess the pro`; }

  const showBoard = s.phase !== 'final' && view === 'draft';

  return (
    <div className={`page phase-${s.phase}`}>
      <header className="masthead">
        <button className="hud-btn masthead__help" onClick={() => setHelp(true)} aria-label="How to play and data sources">?</button>
        <div className="brand">
          <h1 className="logo">Major Mayhem</h1>
          <p className="tagline">Draft a five-man dream team from Counter-Strike Major history, then win the Major.</p>
        </div>
        <div className="masthead__right">
          <TwitchButton onClick={() => setTwitch(true)} />
          <button className="hud-btn" onClick={() => setShowStats(true)} aria-label="Your stats"><StatsIcon /></button>
          <NewRunButton abandon={dailyStarted(s)} onConfirm={() => { setReelFor(null); dispatch({ type: 'reset' }); }} />
        </div>
      </header>

      <nav className="tabs" aria-label="Game">
        <button className={view === 'draft' ? 'is-on' : ''} aria-pressed={view === 'draft'} onClick={() => setView('draft')}>Draft a Major</button>
        <button className={view === 'guess' ? 'is-on' : ''} aria-pressed={view === 'guess'} onClick={() => setView('guess')}>Guess the pro</button>
      </nav>

      {view === 'draft' && (
        <nav className="stepper" aria-label="Progress">
          {steps.map((x, i) => (
            <span key={x.label} className={`stepper__item ${i === stepIdx ? 'is-on' : ''} ${i < stepIdx ? 'is-done' : ''}`}>{x.label}</span>
          ))}
        </nav>
      )}

      <main className="console">
        <div className="console__head">
          {view === 'draft' && s.phase === 'draft' && s.step === 'players' && (
            <button className="back-btn" onClick={() => dispatch({ type: 'back' })} aria-label="Back to teams">‹ Teams</button>
          )}
          <div className="console__titles">
            <span className="kicker">{kicker}</span>
            <h2 className="console__title">{title}</h2>
          </div>
          {view === 'draft' && s.phase === 'draft' && <DraftPips s={s} />}
        </div>

        <div className={`console__body ${showBoard ? 'has-board' : ''} phase-${view === 'guess' ? 'guess' : s.phase}`}>
          {view === 'guess' ? <section className="console__main"><GuessScreen /></section> : <section className="console__main">
            <ChatVoteBar />
            {s.phase === 'draft' && <DraftScreen s={s} dispatch={dispatch} reelFor={reelFor} setReelFor={setReelFor} stats={stats} />}
            {s.phase === 'ready' && mine && <ReadyScreen mine={mine} s={s} dispatch={dispatch} />}
            {s.phase === 'preview' && mine && s.pending && <PreviewScreen mine={mine} s={s} pending={s.pending} t={s.t} dispatch={dispatch} />}
            {s.phase === 'live' && playing && s.current && <LiveScreen key={s.t.matches.length} mine={playing} m={s.current} t={s.t} coach={s.coach} dispatch={dispatch} />}
            {s.phase === 'final' && mine && <FinalScreen mine={mine} s={s} stats={stats} dispatch={dispatch} />}
          </section>}
          {showBoard && <BoardHost s={s} mine={playing} />}
        </div>
      </main>

      <footer className="foot">
        Rosters and placements from Wikipedia's Major final standings (retrieved 28 Sep 2026); every roster links to Liquipedia. Photos and logos from bo3.gg and Wikimedia Commons, credited under “?”. Logos are trademarks of their teams.
        Player strength is hidden; match ratings are simulated. Fan project, not affiliated with Valve or any team.
      </footer>

      {invite && <DuelInvite duel={invite.duel} abandon={dailyStarted(s)} onClose={() => setInvite(null)}
        onAccept={(d) => { setInvite(null); setReelFor(null); dispatch({ type: 'duel', duel: d }); }} />}
      {twitch && <TwitchPanel onClose={() => setTwitch(false)} />}
      {help && <HelpModal onClose={() => setHelp(false)} />}
      {showStats && <StatsModal stats={stats} onClose={() => setShowStats(false)} />}
    </div>
  );
}

function DraftPips({ s }: { s: Run }) {
  const filled = s.picks.length + (s.coach ? 1 : 0) + (s.bench ? 1 : 0);
  return (
    <div className="pips" aria-label={`${filled} of ${draftRounds(s)} drafted`}>
      {ROLE_ORDER.map((r) => (
        <span key={r} className={`pip ${s.picks.some((p) => p.slot === r) ? 'is-full' : ''}`} title={ROLE_LABEL[r]}><RoleIcon role={r} size={13} /></span>
      ))}
      {s.extras && <span className={`pip pip--extra ${s.coach ? 'is-full' : ''}`} title={s.coach ? `Coach: ${s.coach}` : 'Coach'}>C</span>}
      {s.extras && <span className={`pip pip--extra ${s.bench ? 'is-full' : ''}`} title="Bench">B</span>}
    </div>
  );
}

function NewRunButton({ onConfirm, abandon }: { onConfirm: () => void; abandon: boolean }) {
  const [ask, setAsk] = useState(false);
  useEffect(() => { if (!ask) return; const t = setTimeout(() => setAsk(false), 3000); return () => clearTimeout(t); }, [ask]);
  return ask ? (
    <button className="hud-btn hud-btn--wide" onClick={() => { setAsk(false); onConfirm(); }} title={abandon ? "Today's daily will count as abandoned" : undefined}>{abandon ? 'Abandon daily?' : 'New run?'}</button>
  ) : (
    <button className="hud-btn" onClick={() => setAsk(true)} aria-label="Start a new run">↺</button>
  );
}

function DuelInvite({ duel, abandon, onAccept, onClose }: { duel: Duel | null; abandon: boolean; onAccept: (d: Duel) => void; onClose: () => void }) {
  return (
    <Modal label="Draft duel" onClose={onClose} small>
        {duel ? (
          <>
            <h3>{duel.name} challenges you</h3>
            <p>A draft duel: you open the same cases {duel.name} did and draft your own seven, then your team plays theirs in a best-of-three showmatch.</p>
            {abandon && <p className="muted small">Accepting now counts today's daily as abandoned.</p>}
            <div className="final__actions"><button className="cta cta--orange" onClick={() => onAccept(duel)}>Accept the duel</button></div>
          </>
        ) : (
          <>
            <h3>That challenge link doesn't work</h3>
            <p>It's incomplete, or it names teams or players this version of the game doesn't have. Ask for a fresh link.</p>
          </>
        )}
    </Modal>
  );
}

const StatsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M5 20V12M12 20V5M19 20v-5" /></svg>
);
