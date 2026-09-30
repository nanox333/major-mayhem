import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import * as G from './game/logic';
import { Action, Phase, currentLineup, dailyDate, dailyNumber, draftRounds, load, optsLabel, reducer, roundNumber, roundOf, save, today } from './game/state';
import { abandonDaily, dailyStarted, loadStats, recordDuel, recordRun } from './game/stats';
import { Duel, decodeDuel, duelCode } from './game/duel';
import { BoardHost } from './ui/Board';
import { Modal } from './ui/Modal';
import { useRunTracking } from './ui/useTracking';
import { TopBar, View } from './ui/TopBar';
import { RunProgress } from './ui/RunProgress';
import { LineupPanel } from './ui/Lineup';
import { DraftSidebar } from './ui/DraftSidebar';
import { HomeScreen } from './screens/Home';
import { TeamStrip } from './ui/TeamStrip';
import { DraftScreen } from './screens/Draft';
import { ReadyScreen } from './screens/Lobby';
import { LiveScreen, PreviewScreen } from './screens/Match';
import { FinalScreen } from './screens/Final';
import { HelpModal, HelpTab } from './screens/Help';
import { StatsModal } from './screens/Stats';
import { ChatVoteBar, ChatVoteProvider, TwitchPanel } from './ui/ChatVote';
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
  const [help, setHelp] = useState<HelpTab | null>(null);
  const [helpTopic, setHelpTopic] = useState<string | null>(null);
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
    : s.step === 'teams' ? (round === 'coach' ? 'Pick a coach' : round === 'bench' ? 'Choose your bench player' : 'Choose your player') : 'Open a case';
  const date = dailyDate(s);
  const tags = optsLabel(s.opts).map((x) => `${x} · `).join('');
  let kicker = `${date ? `Daily #${dailyNumber(date)} · ` : s.duel ? `Draft duel vs ${s.duel.name} · ` : tags}Draft · Round ${roundNumber(s)} of ${draftRounds(s)}`;
  if (s.phase === 'ready') { title = 'Ready to rumble'; kicker = `Lobby · ${draftRounds(s)} of ${draftRounds(s)} drafted`; }
  if (s.phase === 'preview' || s.phase === 'live') { title = G.STAGE_NAME[stageNow!]; kicker = `${s.duel ? 'Draft duel' : 'Major'} · Best of ${s.current?.bestOf ?? G.bestOfFor(stageNow!, s.t)}`; }
  if (s.phase === 'final') { title = s.duel ? 'Showmatch over' : 'Tournament over'; kicker = 'Results'; }
  // The home is the first page, and anywhere a run isn't under way; a saved run resumes where it was (#115). Guess the pro doesn't touch the run.
  const atStart = s.phase === 'draft' && s.offerKey === 0 && s.picks.length === 0;
  const [chosen, setView] = useState<View>('draft');
  // Whenever no run is under way (a new run, "Play again", a reset) the draft view is the home; a duel starts in its own screen.
  const backView: View = atStart && s.mode !== 'duel' ? 'home' : 'draft';
  const view: View = chosen === 'draft' ? backView : chosen;
  if (view === 'guess') { title = 'Guess the pro'; kicker = `Daily #${dailyNumber(today())} · Guess the pro`; }

  // The radar is scenery while you draft, so it leaves the draft screen; the lobby and the match keep it (#102).
  const showBoard = s.phase !== 'final' && s.phase !== 'draft' && view === 'draft';
  // The very first screen: on phones the empty team strip would only push the intro and the case down.
  const start = view === 'draft' && s.phase === 'draft' && s.offerKey === 0 && s.picks.length === 0;
  // Once the first case is open the draft has a lineup panel and a sidebar of its own (#102).
  const drafting = view === 'draft' && s.phase === 'draft' && !start;

  return (
    <>
    <TopBar view={view} setView={setView} backView={backView} onHelp={() => setHelp('play')} onStats={() => setShowStats(true)} onTwitch={() => setTwitch(true)}
      abandon={dailyStarted(s)} onNewRun={() => { setReelFor(null); dispatch({ type: 'reset' }); setView('home'); }} />
    <div className={`page phase-${s.phase} ${start ? 'is-start' : ''} ${drafting ? 'is-wide' : ''} ${view === 'home' ? 'is-home' : ''}`}>
      {view === 'home' && <HomeScreen s={s} stats={stats} dispatch={dispatch} setReelFor={setReelFor} showDraft={() => setView('draft')} showGuess={() => setView('guess')} onStats={() => setShowStats(true)} />}
      {view !== 'home' && <main className="console">
        <div className="console__head">
          {view === 'draft' && s.phase === 'draft' && s.step === 'players' && (
            <button className="back-btn" onClick={() => dispatch({ type: 'back' })} aria-label="Back to teams">‹ Teams</button>
          )}
          <div className="console__titles">
            {/* One heading, in one line where there is room: where you are, then what to do (#103). */}
            <h2 className="console__title"><span className="kicker">{kicker}</span><span className="sep"> · </span><span className="console__action">{title}</span></h2>
          </div>
          {view === 'draft' && <RunProgress steps={steps.map((x) => x.label)} stepIdx={stepIdx} />}
        </div>
        {view === 'draft' && s.phase === 'draft' && <TeamStrip s={s} />}

        <div className={`console__body ${showBoard ? 'has-board' : ''} phase-${view === 'guess' ? 'guess' : s.phase}`}>
          {drafting && <LineupPanel s={s} />}
          {view === 'guess' ? <section className="console__main"><GuessScreen /></section> : <section className="console__main">
            <ChatVoteBar />
            {s.phase === 'draft' && <DraftScreen s={s} dispatch={dispatch} reelFor={reelFor} setReelFor={setReelFor} stats={stats} />}
            {s.phase === 'ready' && mine && <ReadyScreen mine={mine} s={s} dispatch={dispatch} />}
            {s.phase === 'preview' && mine && s.pending && <PreviewScreen mine={mine} s={s} pending={s.pending} t={s.t} dispatch={dispatch} />}
            {s.phase === 'live' && playing && s.current && <LiveScreen key={s.t.matches.length} mine={playing} m={s.current} t={s.t} coach={s.coach} dispatch={dispatch} />}
            {s.phase === 'final' && mine && <FinalScreen mine={mine} s={s} stats={stats} dispatch={dispatch} />}
          </section>}
          {drafting && <DraftSidebar s={s} onChemistryHelp={() => { setHelpTopic('Chemistry'); setHelp('play'); }} />}
          {showBoard && <BoardHost s={s} mine={playing} />}
        </div>
      </main>}

      <footer className="foot">
        <p><strong>Data and credits</strong>Rosters and placements from Wikipedia's Major final standings (retrieved 28 Sep 2026); every roster links to Liquipedia. Photos and logos from bo3.gg and Wikimedia Commons: see <button type="button" className="link-btn" onClick={() => setHelp('sources')}>sources and credits</button>. Logos are trademarks of their teams.</p>
        <p><strong>Fan project</strong>Not affiliated with Valve or any team. Player strength is hidden and match ratings are simulated.</p>
      </footer>

      {invite && <DuelInvite duel={invite.duel} abandon={dailyStarted(s)} onClose={() => setInvite(null)}
        onAccept={(d) => { setInvite(null); setReelFor(null); dispatch({ type: 'duel', duel: d }); setView('draft'); }} />}
      {twitch && <TwitchPanel onClose={() => setTwitch(false)} />}
      {help && <HelpModal tab={help} topic={helpTopic ?? undefined} onClose={() => { setHelp(null); setHelpTopic(null); }} />}
      {showStats && <StatsModal stats={stats} onClose={() => setShowStats(false)} />}
    </div>
    </>
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
