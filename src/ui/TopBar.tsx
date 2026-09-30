import React, { useEffect, useRef, useState } from 'react';
import { track } from '../analytics';
import { play, useSoundOn } from './sound';
import { Sr } from './art';
import { TwitchButton, useTwitchStatus } from './ChatVote';
import * as I from './icons';

// The one slim bar at the top (#101): the mark and wordmark, the four progress steps, Guess the pro, and help, sound and a menu.
// The steps show where you are in a run; they are not links (a draft has no undo). Everything else lives one press away.

export type View = 'draft' | 'guess';

const STEP_ICONS = [I.CaseIcon, I.RosterIcon, I.TrophyIcon, I.FlagIcon];
const SHIELD = 'M20 2 L36 9 V22 C36 30 29 36 20 38 C11 36 4 30 4 22 V9 Z';

/** A shield (the game's own team-badge shape) with a stencil M. Interim mark until the brand work in #112. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg className="logomark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path d={SHIELD} fill="var(--panel-2)" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" />
      <text x="20" y="27.5" textAnchor="middle" fontSize="20" fill="var(--accent)" style={{ fontFamily: 'var(--f-logo)' }}>M</text>
    </svg>
  );
}

interface TopBarProps {
  steps: string[];
  stepIdx: number;
  view: View;
  setView: (v: View) => void;
  onHelp: () => void;
  onStats: () => void;
  onTwitch: () => void;
  abandon: boolean;
  onNewRun: () => void;
}

export function TopBar({ steps, stepIdx, view, setView, onHelp, onStats, onTwitch, abandon, onNewRun }: TopBarProps) {
  const twitch = useTwitchStatus();
  return (
    <header className="topbar">
      <div className="topbar__in">
        <h1 className="brand"><LogoMark /><span className="wordmark"><b>Major</b> <i>Mayhem</i></span></h1>

        {view === 'draft' ? (
          <ol className="stabs" role="list" aria-label="Progress">
            {steps.map((label, i) => {
              const Icon = STEP_ICONS[i];
              return (
                <li key={label} className={`stab ${i === stepIdx ? 'is-on' : ''} ${i < stepIdx ? 'is-done' : ''}`} aria-current={i === stepIdx ? 'step' : undefined}>
                  <span className="stab__icon"><Icon size={20} />{i < stepIdx && <span className="stab__tick" aria-hidden="true">✓</span>}</span>
                  <span className="stab__label">{label}</span>
                  {i < stepIdx && <Sr> (done)</Sr>}{i > stepIdx && <Sr> (not yet)</Sr>}
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="stabs">
            <button type="button" className="stab stab--back" onClick={() => setView('draft')}><I.ChevronLeftIcon size={20} /><span className="stab__label">Back to the draft</span></button>
          </div>
        )}

        <button type="button" className={`gamelink ${view === 'guess' ? 'is-on' : ''}`} aria-pressed={view === 'guess'} aria-label="Guess the pro" onClick={() => setView(view === 'guess' ? 'draft' : 'guess')}>
          <I.CrosshairIcon size={20} /><span className="gamelink__label"><span className="gamelink__long">Guess the pro</span><span className="gamelink__short" aria-hidden="true">Guess</span></span>
        </button>

        <div className="topbar__end" role="group" aria-label="Help, sound and more">
          <button type="button" className="hud-btn" onClick={onHelp} aria-label="How to play and data sources" title="How to play"><I.HelpIcon /></button>
          <SoundButton />
          {/* Once chat votes are connected (or trying to), the button stays in view so the connection state does. Before that it's in the menu. */}
          {twitch !== 'off' && <TwitchButton onClick={onTwitch} />}
          <MoreMenu showTwitch={twitch === 'off'} onStats={onStats} onTwitch={onTwitch} abandon={abandon} onNewRun={onNewRun} />
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

/** Stats, Twitch chat votes and a new run: the things you use now and then. A settings panel replaces this in #110. */
function MoreMenu({ showTwitch, onStats, onTwitch, abandon, onNewRun }: { showTwitch: boolean; onStats: () => void; onTwitch: () => void; abandon: boolean; onNewRun: () => void }) {
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

  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div className="menu" ref={box} onBlur={(e) => { if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <button ref={trigger} type="button" className="hud-btn" aria-haspopup="true" aria-expanded={open} aria-controls="topbar-menu" aria-label="More" title="More" onClick={() => setOpen((o) => !o)}>
        <I.MoreIcon />
      </button>
      {open && (
        <div id="topbar-menu" className="menu__panel" role="group" aria-label="More">
          <button type="button" className="menu__item" onClick={pick(onStats)} aria-label="Your stats"><I.StatsIcon /><span>Stats</span></button>
          {showTwitch && <TwitchButton variant="menu" onClick={pick(onTwitch)} />}
          <button type="button" className={`menu__item ${ask ? 'is-ask' : ''}`} aria-label="Start a new run" title={ask && abandon ? "Today's daily will count as abandoned" : undefined}
            onClick={() => { if (ask) { setAsk(false); setOpen(false); onNewRun(); } else setAsk(true); }}>
            <I.RefreshIcon /><span>{ask ? (abandon ? 'Abandon daily?' : 'New run?') : 'New run'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
