import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import * as G from './game/logic';
import { Action, Phase, currentLineup, dailyDate, dailyNumber, draftRounds, KEY, load, optsLabel, parseRun, reducer, roundNumber, roundOf, save, today } from './game/state';
import { STATS_KEY, abandonDaily, dailyStarted, forgetStats, loadStats, recordDuel, recordRun } from './game/stats';
import { GUESS_KEY, forgetGuesses } from './game/guess';
import { DUO_KEY, forgetDuo } from './game/duo';
import { registerDuel } from './game/duel';
import { UnsavedBar } from './ui/UnsavedBar';
import { Duel, decodeDuel, duelCode, duelTerms } from './game/duel';
import { BoardHost } from './ui/Board';
import { Modal } from './ui/Modal';
import { useRunTracking } from './ui/useTracking';
import { TopBar, View } from './ui/TopBar';
import { RunProgress } from './ui/RunProgress';
import { DraftStatus } from './ui/DraftSidebar';
import { DebugMenu } from './ui/DebugMenu';
import { SettingsDialog } from './ui/Settings';
import { usePrefs } from './ui/prefs';
import { reduceMotion } from './ui/util';
import { useShortcuts } from './ui/shortcuts';
import { useSoundOn } from './ui/sound';
import { DatabaseIcon, RosterIcon, GamepadIcon } from './ui/icons';
import { HomeScreen } from './screens/Home';
import { TeamStrip } from './ui/TeamStrip';
import { DraftScene } from './ui/DraftScene';
import { MobileLineup } from './ui/MobileLineup';
import { RosterBrowser } from './ui/RosterBrowser';
import { DraftScreen } from './screens/Draft';
import { Preview } from './game/draftui';
import { homeState } from './game/home';
import { ReadyScreen } from './screens/Lobby';
import { LiveScreen, PreviewScreen, setPlaybackFor } from './screens/Match';
import { FinalScreen } from './screens/Final';
import { HelpModal, HelpTab } from './screens/Help';
import { StatsPage } from './screens/Stats';
import { SetupScreen } from './screens/Setup';
import { ChatVoteBar, ChatVoteProvider, TwitchPanel } from './ui/ChatVote';
import { GuessScreen } from './screens/Guess';
import { DuoScreen } from './screens/DuoLink';
import { useView } from './ui/route';

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
  const [twitch, setTwitch] = useState(false);
  const [settings, setSettings] = useState<false | 'shortcuts' | true>(false);
  const [stats, setStats] = useState(loadStats);
  const [reelFor, setReelFor] = useState<number | null>(null);
  // The player or coach you are pointing at in the case, previewed in the lineup and the chemistry panel (#143).
  const [preview, setPreview] = useState<Preview | null>(null);
  // A challenge link (#duel=…) opens an invite; the hash is cleared so a reload doesn't ask again.
  const [invite, setInvite] = useState<{ duel: Duel | null } | null>(() => {
    const code = typeof location !== 'undefined' ? duelCode(location.hash) : null;
    if (!code) return null;
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* not allowed: fine */ }
    return { duel: decodeDuel(code) };
  });
  useEffect(() => save(s), [s]);
  // Another tab changed what is saved (#163): take its run and its record rather than overwrite them with what this tab last saw.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STATS_KEY) { forgetStats(); setStats(loadStats()); }
      else if (e.key === GUESS_KEY) forgetGuesses();
      else if (e.key === DUO_KEY) forgetDuo();
      else if (e.key === KEY) {
        const run = parseRun(e.newValue);
        if (run && JSON.stringify(run) !== JSON.stringify(latest.current)) { if (run.duel) registerDuel(run.duel); rawDispatch({ type: 'adopt', run }); }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
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
  // Every visit opens on the home; a saved run is one "Continue" away, never resumed on load.
  const [chosen, setView] = useView();
  // Whenever no run is under way (a new run, "Play again", a reset) the draft view is the home; a duel starts in its own screen.
  // A draft you have just started waits on its sealed case until you open it; `began` is that wait, and it ends as soon as a case is open.
  const [began, setBegan] = useState(false);
  // Debug scenarios swap the whole run in place; counting them lets the live page start over instead of carrying the last scenario's round and effects into the next.
  const [adopted, setAdopted] = useState(0);
  useEffect(() => { if (began && !atStart) setBegan(false); }, [began, atStart]);
  const beginDraft = () => { setBegan(true); setView('draft'); };
  const backView: View = atStart && !began && s.mode !== 'duel' ? 'home' : 'draft';
  const view: View = chosen === 'draft' ? backView : chosen;
  // Single-key shortcuts (#77), off-able in the settings and quiet while a dialog is open or you are typing.
  const prefs = usePrefs();
  const [, toggleSound] = useSoundOn();
  const inCase = view === 'draft' && s.phase === 'draft' && s.step === 'teams';
  const goToCard = (n: number) => {
    const card = document.querySelectorAll<HTMLElement>('.case-card')[n];
    if (!card) return;
    const roster = document.querySelectorAll<HTMLButtonElement>('.roster-selector button')[n];
    if (roster) roster.click();
    const toggle = card.querySelector<HTMLElement>('.case-card__toggle');
    if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
    setTimeout(() => card.querySelector<HTMLElement>('button.prow')?.focus(), 0);
  };
  useShortcuts(prefs.shortcuts, {
    m: () => { toggleSound(); },
    '?': () => setSettings('shortcuts'),
    ...(inCase ? { '1': () => goToCard(0), '2': () => goToCard(1), '3': () => goToCard(2) } : {}),
    Enter: () => { const b = document.querySelector<HTMLButtonElement>('.draftbar .cta'); if (b && !b.disabled) b.click(); },
  }, !!(help || twitch || settings || invite));
  const goNext = () => {
    // Once today's pro is found, one button for what to do next (#129). A run that is already under way is continued, never replaced from here (#182):
    // an earlier day's daily, today's, or a free run. Only with nothing under way does it start today's draft, or free play when the daily is done.
    const h = homeState(s, stats, today());
    if (h.oldRun || h.daily === 'progress' || h.freeInProgress) return setView('draft');
    if (h.daily === 'new') { dispatch({ type: 'reset', mode: 'daily' }); setBegan(true); return setView('draft'); }
    dispatch({ type: 'reset', mode: 'free' }); setBegan(true); setView('draft');
  };
  const hs = homeState(s, stats, today());
  const guessNext = {
    label: hs.oldRun ? `Continue Daily #${hs.oldRun.n}` : hs.daily === 'progress' ? "Continue today's draft" : hs.freeInProgress ? (s.mode === 'duel' ? 'Continue your draft duel' : 'Continue your free run') : hs.daily === 'new' ? "Play today's draft" : 'Free play',
    go: goNext,
  };

  // The radar is scenery while you draft, so it leaves the draft screen; the lobby and the match keep it (#102).
  const showBoard = s.phase !== 'final' && s.phase !== 'draft' && s.phase !== 'live' && s.phase !== 'ready' && s.phase !== 'preview' && view === 'draft';
  // The very first screen: on phones the empty team strip would only push the intro and the case down.
  const start = view === 'draft' && s.phase === 'draft' && s.offerKey === 0 && s.picks.length === 0;
  // Once the first case is open the draft has a lineup panel and a sidebar of its own (#102).
  const drafting = view === 'draft' && s.phase === 'draft' && !start;
  // The arena sits behind the draft only. A saved run can be mid-draft while you are on Home or Guess, which have their own scenes (#225).
  const scene = view === 'draft' && s.phase === 'draft';
  // While the three reels turn, the heading says so; it goes back to the round's own title when they have landed (#225). Fast reveals and reduced motion skip the reels.
  const opening = scene && s.step === 'teams' && reelFor === s.offerKey && !prefs.fastReveals && !reduceMotion();
  const heading = opening ? 'Opening your case' : title;

  return (
    <>
    <TopBar view={view} setView={setView} backView={backView} onHelp={() => setHelp('play')} onStats={() => setView('stats')} onTwitch={() => setTwitch(true)} onSettings={() => setSettings(true)}
      onBrowse={() => setView('archive')} abandon={dailyStarted(s)} onNewRun={() => { setReelFor(null); setBegan(false); dispatch({ type: 'reset' }); setView('home'); }} />
    <UnsavedBar run={s} />
    {scene && <DraftScene />}
    <div className={`page phase-${s.phase} ${start ? 'is-start' : ''} ${drafting ? 'is-wide' : ''} ${view === 'home' ? 'is-home' : ''} ${scene ? 'is-scene' : ''}`}>
      {view === 'home' && <HomeScreen s={s} stats={stats} dispatch={dispatch} showDraft={beginDraft} showSetup={() => setView('setup')} showGuess={() => setView('guess')} showDuo={() => setView('duo')} onStats={() => setView('stats')} onBrowse={() => setView('archive')} />}
      {view === 'guess' && <GuessScreen next={guessNext} />}
      {view === 'duo' && <DuoScreen next={guessNext} />}
      {view === 'stats' && <StatsPage stats={stats} next={guessNext} />}
      {view === 'setup' && <SetupScreen s={s} dispatch={dispatch} onStart={beginDraft} onBack={() => setView('home')} />}
      {view === 'archive' && <RosterBrowser page hard={!!s.opts?.hard && s.offerKey > 0 && s.phase !== 'final'} onClose={() => setView('home')} />}
      {view !== 'home' && view !== 'guess' && view !== 'duo' && view !== 'archive' && view !== 'stats' && view !== 'setup' && <main className="console">
        <div className={`console__head ${s.phase === 'live' || s.phase === 'final' ? 'console__head--progress' : ''}`}>
          {view === 'draft' && s.phase === 'draft' && s.step === 'players' && (
            <button className="back-btn" onClick={() => dispatch({ type: 'back' })} aria-label="Back to teams">‹ Teams</button>
          )}
          {s.phase === 'live' || s.phase === 'final'
            ? <h2 className="sr">{title}</h2>
            : <div className="console__titles"><p className="console__eyebrow kicker">{kicker}</p>
              <h2 className="console__title" key={heading}>{scene ? <>{heading.split(' ')[0]} <em>{heading.split(' ').slice(1).join(' ')}</em></> : title}</h2>
              {scene && !start && (
                <p className="console__picks"><b>{roundNumber(s) - 1} / {draftRounds(s)}</b> picks made
                  <span className="console__pips" aria-hidden="true">{Array.from({ length: draftRounds(s) }, (_, i) => <i key={i} className={i < roundNumber(s) - 1 ? 'is-done' : i === roundNumber(s) - 1 ? 'is-now' : ''} />)}</span></p>
              )}</div>}
          {view === 'draft' && <RunProgress steps={steps.map((x) => x.label)} stepIdx={stepIdx} />}
        </div>
        {view === 'draft' && s.phase === 'draft' && <><div className={`${drafting ? 'desktop-strip' : ''} ${start ? 'strip-wait' : 'strip-in'}`} aria-hidden={start ? true : undefined}><TeamStrip s={s} preview={preview} /></div>{drafting && <MobileLineup s={s} preview={preview} onHelp={() => { setHelpTopic('Chemistry'); setHelp('play'); }} />}{drafting && <DraftStatus s={s} onChemistryHelp={() => { setHelpTopic('Chemistry'); setHelp('play'); }} />}</>}

        <div className={`console__body ${showBoard ? 'has-board' : ''} phase-${s.phase}`}>
          <section className="console__main">
            <ChatVoteBar />
            {s.phase === 'draft' && <DraftScreen s={s} dispatch={dispatch} reelFor={reelFor} setReelFor={setReelFor} stats={stats} onPreview={setPreview} toSetup={() => setView('setup')} />}
            {s.phase === 'ready' && mine && <ReadyScreen mine={mine} s={s} dispatch={dispatch} />}
            {s.phase === 'preview' && mine && s.pending && <PreviewScreen mine={mine} s={s} pending={s.pending} t={s.t} dispatch={dispatch} />}
            {s.phase === 'live' && playing && s.current && <LiveScreen key={`${s.t.matches.length}:${adopted}`} board={<BoardHost s={s} mine={playing} />} mine={playing} m={s.current} t={s.t} coach={s.coach} dispatch={dispatch} />}
            {s.phase === 'final' && mine && <FinalScreen mine={mine} s={s} stats={stats} dispatch={dispatch} />}
          </section>
          {showBoard && <BoardHost s={s} mine={playing} />}
        </div>
      </main>}

      <footer className="foot">
        <div className="foot__group"><DatabaseIcon size={24} /><p><strong>Data and credits</strong>Rosters and placements from Wikipedia's Major final standings (retrieved 28 Sep and 4 Oct 2026); every roster links to Liquipedia. Photos and logos from bo3.gg and Wikimedia Commons: see <button type="button" className="link-btn" onClick={() => setHelp('sources')}>sources and credits</button>. Logos are trademarks of their teams.</p></div>
        <div className="foot__group"><RosterIcon size={24} /><p><strong>Fan project</strong>Not affiliated with Valve or any team. Player strength is hidden and match ratings are simulated.</p></div>
        <div className="foot__group"><GamepadIcon size={24} /><p><strong>Built by fans</strong>A love letter to Counter-Strike and its Major history.</p></div>
      </footer>

      {invite && <DuelInvite duel={invite.duel} abandon={dailyStarted(s)} onClose={() => setInvite(null)}
        onAccept={(d) => { setInvite(null); setReelFor(null); dispatch({ type: 'duel', duel: d }); setView('draft'); }} />}
      {twitch && <TwitchPanel onClose={() => setTwitch(false)} />}
      {settings && <SettingsDialog run={s} onClose={() => setSettings(false)} toShortcuts={settings === 'shortcuts'} onTwitch={() => setTwitch(true)} abandon={dailyStarted(s)} onNewRun={() => { setReelFor(null); setBegan(false); dispatch({ type: 'reset' }); setView('home'); }} />}
      {help && <HelpModal tab={help} topic={helpTopic ?? undefined} onClose={() => { setHelp(null); setHelpTopic(null); }} />}
      <DebugMenu run={s} jump={(b) => {
        // The match page reads where it was left when it opens, so leave the page and come back so it opens fresh.
        setReelFor(null); setPreview(null); setBegan(false); setView('home');
        // Written only once the old match page is gone: while it is still mounted its own effect keeps saving where it was, over this.
        setTimeout(() => { setPlaybackFor(b.run, b.seen ?? null); setAdopted((n) => n + 1); dispatch({ type: 'adopt', run: b.run }); setBegan(true); setView('draft'); }, 0);
      }} />
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
            <p>A draft duel: you draft your own seven, then your team plays {duel.name}'s in a best-of-three showmatch.</p>
            <p><b>{duelTerms(duel).headline}.</b></p>
            <ul className="duel-terms">{duelTerms(duel).lines.map((l) => <li key={l}>{l}</li>)}</ul>
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
