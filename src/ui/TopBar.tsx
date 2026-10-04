import React, { useEffect, useRef, useState } from 'react';
import { track } from '../analytics';
import { play, useSoundOn } from './sound';
import { TwitchButton, useTwitchStatus } from './ChatVote';
import * as I from './icons';

// The one slim bar at the top (#101): the mark and wordmark, Guess the pro, help, sound and a menu. It never carries the run's progress:
// the four steps live in the head of the console with the run they describe (#140).

export type View = 'home' | 'draft' | 'guess' | 'archive' | 'stats' | 'setup';

const SHIELD = 'M20 2 L36 9 V22 C36 30 29 36 20 38 C11 36 4 30 4 22 V9 Z';

/** A shield (the game's own team-badge shape) with a stencil M. Interim mark until the brand work in #112. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg className="logomark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path d={SHIELD} fill="var(--accent)" />
      <text x="20" y="27.5" textAnchor="middle" fontSize="20" fill="#170c03" style={{ fontFamily: 'var(--f-logo)' }}>M</text>
    </svg>
  );
}

interface TopBarProps {
  view: View;
  setView: (v: View) => void;
  /** Where "back" goes from Guess the pro: the home, or the run in progress. */
  backView: View;
  onHelp: () => void;
  onStats: () => void;
  onTwitch: () => void;
  /** Opens the settings dialog. */
  onSettings: () => void;
  abandon: boolean;
  onNewRun: () => void;
  onBrowse?: () => void;
}

export function TopBar({ view, setView, backView, onHelp, onStats, onTwitch, onSettings, abandon, onNewRun, onBrowse }: TopBarProps) {
  const twitch = useTwitchStatus();
  const inGuess = view === 'guess';
  const inArchive = view === 'archive';
  const toggleGame = () => setView('guess');
  const backLabel = backView === 'home' ? 'Back to home' : 'Back to the draft';
  return (
    <header className={`topbar ${twitch !== 'off' ? 'topbar--twitch' : ''}`}>
      <div className="topbar__in">
        <h1 className="brand">
          {/* The wordmark is the way home, from anywhere; a run in progress is never touched by going there (#115). */}
          {/* On the home it stays a button, so it never turns into dead text: it just scrolls back to the top. */}
          <button type="button" className="brand__btn" onClick={() => { setView('home'); if (view === 'home') window.scrollTo({ top: 0 }); }} aria-label="Major Mayhem: home" data-sfx="none"><LogoMark /><span className="wordmark"><b>Major</b> <i>Mayhem</i></span></button>
        </h1>

        <nav className="shell-nav" aria-label="Game modes">
          <button type="button" className="shell-link" aria-current={!inGuess && !inArchive && view !== 'stats' ? 'page' : undefined} onClick={() => setView('home')}>Home</button>
          <button type="button" className="gamelink" aria-current={inGuess ? 'page' : undefined} aria-label="Guess the pro" onClick={toggleGame}>
            <span>Guess the pro</span>
          </button>
          {onBrowse && <button type="button" className="shell-link" aria-current={inArchive ? 'page' : undefined} onClick={onBrowse}>Roster archive</button>}
        </nav>

        <div className="topbar__end" role="group" aria-label="Sound, stats and more">
          <SoundButton />
          <button type="button" className="hud-btn" aria-current={view === 'stats' ? 'page' : undefined} onClick={onStats} aria-label="Your stats" title="Your stats"><I.StatsIcon /></button>
          <button type="button" className="hud-btn hud-btn--gear" onClick={onSettings} aria-label="Settings" title="Settings" data-sfx="none"><I.SettingsIcon /></button>
          {/* Once chat votes are connected (or trying to), the button stays in view so the connection state does. Before that it's in the menu. */}
          {twitch !== 'off' && <TwitchButton onClick={onTwitch} />}
          <MoreMenu inGuess={inGuess} backLabel={backLabel} onGame={toggleGame} showTwitch={twitch === 'off'} onHelp={onHelp} onTwitch={onTwitch} onSettings={onSettings} abandon={abandon} onNewRun={onNewRun} onBrowse={onBrowse} onPlay={() => setView('home')} />
        </div>
      </div>
    </header>
  );
}

/** The master sound switch; on by default, and remembered. */
function SoundButton() {
  const [on, toggle] = useSoundOn();
  return (
    <button type="button" className="hud-btn" data-sfx="none" aria-pressed={on} aria-label={on ? 'Turn sound off' : 'Turn sound on'} title={on ? 'Sound on' : 'Sound off'}
      onClick={() => { toggle(); if (!on) play('click'); track('sound', { on: !on }); }}>
      <I.SoundIcon on={on} />
    </button>
  );
}

interface MoreProps { onBrowse?: () => void; onPlay: () => void; inGuess: boolean; backLabel: string; onGame: () => void; showTwitch: boolean; onHelp: () => void; onTwitch: () => void; onSettings: () => void; abandon: boolean; onNewRun: () => void }

/** How to play, Twitch chat votes and a new run: the things you use now and then (and Guess the pro and Settings, on a phone, where the gear has no room). */
function MoreMenu({ inGuess, backLabel, onGame, showTwitch, onHelp, onTwitch, onSettings, abandon, onNewRun, onBrowse, onPlay }: MoreProps) {
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Starting over asks once, and forgets the question after three seconds.
  useEffect(() => { if (!ask) return; const t = setTimeout(() => setAsk(false), 3000); return () => clearTimeout(t); }, [ask]);
  useEffect(() => {
    if (!open) { setAsk(false); return; }
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key); };
  }, [open]);

  // The menu closes and focus goes back to its button first, so a dialog opened from it hands focus back to something that is still on the page.
  const pick = (fn: () => void) => () => { setOpen(false); trigger.current?.focus(); fn(); };
  const game = 'Guess the pro';
  return (
    <div className="menu" ref={box} onBlur={(e) => { if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <button ref={trigger} type="button" className="hud-btn" aria-haspopup="true" aria-expanded={open} aria-controls="topbar-menu" aria-label="More" title="More" onClick={() => setOpen((o) => !o)}>
        <I.MoreIcon />
      </button>
      {open && (
        <div id="topbar-menu" className="menu__panel" role="group" aria-label="More">
          <button type="button" className="menu__item menu__item--mode" onClick={pick(onPlay)}><I.CaseIcon /><span>Play</span></button>
          {onBrowse && <button type="button" className="menu__item menu__item--mode" onClick={pick(onBrowse)}><I.RosterIcon /><span>Roster archive</span></button>}
          <button type="button" className="menu__item menu__item--game" onClick={pick(onGame)} aria-label={game}><I.CrosshairIcon /><span>{game}</span></button>
          {showTwitch && <TwitchButton variant="menu" onClick={pick(onTwitch)} />}
          <button type="button" className="menu__item" onClick={pick(onHelp)} aria-label="How to play and data sources"><I.HelpIcon /><span>How to play</span></button>
          <button type="button" className="menu__item menu__item--settings" onClick={pick(onSettings)} aria-label="Settings"><I.SettingsIcon /><span>Settings</span></button>
          <button type="button" className={`menu__item ${ask ? 'is-ask' : ''}`} aria-label="Start a new run" title={ask && abandon ? "Today's daily will count as abandoned" : undefined}
            onClick={() => { if (ask) { setAsk(false); setOpen(false); onNewRun(); } else setAsk(true); }}>
            <I.RefreshIcon /><span>{ask ? (abandon ? 'Abandon daily?' : 'New run?') : 'New run'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
