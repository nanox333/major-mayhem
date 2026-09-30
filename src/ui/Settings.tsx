import React, { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { SHORTCUTS } from './shortcuts';
import { Theme, setPrefs, usePrefs } from './prefs';
import { setTipsOn, useTipsOn } from './tips';
import { useSoundOn } from './sound';
import { RefreshIcon, TwitchIcon } from './icons';

/** An on/off control with a name a screen reader says: "Sound effects, switch, on". */
function Switch({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="setrow">
      <div className="setrow__text"><b>{label}</b>{hint && <small>{hint}</small>}</div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'is-on' : ''}`} data-sfx="none" onClick={() => onChange(!on)}><i aria-hidden="true" /><span className="switch__word" aria-hidden="true">{on ? 'On' : 'Off'}</span></button>
    </div>
  );
}

const THEMES: [Theme, string][] = [['system', 'System'], ['dark', 'Dark'], ['light', 'Light']];

/**
 * Settings (#110): everything you can change about how the game looks, sounds and listens, and the things the top bar used to hold (chat votes, a new run).
 * Kept in this browser. Single-key shortcuts have an off switch here because they must (WCAG 2.1.4).
 */
export function SettingsDialog({ onClose, onTwitch, onNewRun, abandon, toShortcuts }: { onClose: () => void; onTwitch: () => void; onNewRun: () => void; abandon: boolean; toShortcuts?: boolean }) {
  const prefs = usePrefs();
  const [sound, toggleSound] = useSoundOn();
  const tips = useTipsOn();
  const [ask, setAsk] = useState(false);
  const keys = useRef<HTMLElement>(null);
  useEffect(() => { if (toShortcuts) keys.current?.scrollIntoView({ block: 'start' }); }, [toShortcuts]);
  useEffect(() => { if (!ask) return; const t = setTimeout(() => setAsk(false), 3000); return () => clearTimeout(t); }, [ask]);
  return (
    <Modal label="Settings" onClose={onClose}>
      <h3>Settings</h3>
      <p className="muted small">Saved in this browser.</p>

      <section className="settings__sec" aria-labelledby="set-sound">
        <h4 id="set-sound">Sound</h4>
        <Switch label="Sound effects" hint="Notes, the case reel and the match." on={sound} onChange={() => toggleSound()} />
      </section>

      <section className="settings__sec" aria-labelledby="set-look">
        <h4 id="set-look">Appearance</h4>
        <div className="setrow">
          <div className="setrow__text"><b id="set-theme">Theme</b><small>System follows your device.</small></div>
          <div className="seg" role="group" aria-labelledby="set-theme">
            {THEMES.map(([v, name]) => <button key={v} type="button" className={prefs.theme === v ? 'is-on' : ''} aria-pressed={prefs.theme === v} data-sfx="none" onClick={() => setPrefs({ theme: v })}>{name}</button>)}
          </div>
        </div>
        <Switch label="High contrast" hint="Stronger borders, brighter text and a thicker focus ring." on={prefs.contrast} onChange={(contrast) => setPrefs({ contrast })} />
      </section>

      <section className="settings__sec" aria-labelledby="set-tips">
        <h4 id="set-tips">Tips</h4>
        <Switch label="First-time tips" hint="A short explanation the first time each part of the game comes up. Turning them on shows them all again." on={tips} onChange={setTipsOn} />
      </section>

      <section className="settings__sec" aria-labelledby="set-keys" ref={keys}>
        <h4 id="set-keys">Keyboard shortcuts</h4>
        <Switch label="Single-key shortcuts" hint="They never fire while you type. Everything they do is also a button." on={prefs.shortcuts} onChange={(shortcuts) => setPrefs({ shortcuts })} />
        <table className="settings__keys">
          <caption className="sr">Keyboard shortcuts</caption>
          <tbody>{SHORTCUTS.map((k) => <tr key={k.keys}><th scope="row">{k.keys.split('  ').map((x) => <kbd key={x}>{x}</kbd>)}</th><td>{k.does}</td><td className="muted">{k.where}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="settings__sec" aria-labelledby="set-more">
        <h4 id="set-more">More</h4>
        <div className="settings__btns">
          <button type="button" className="ghost-btn ghost-btn--big" onClick={() => { onClose(); onTwitch(); }}><TwitchIcon size={16} /> Twitch chat votes</button>
          <button type="button" className={`ghost-btn ghost-btn--big ${ask ? 'is-ask' : ''}`} title={ask && abandon ? "Today's daily will count as abandoned" : undefined}
            onClick={() => { if (ask) { setAsk(false); onClose(); onNewRun(); } else setAsk(true); }}>
            <RefreshIcon size={16} /> {ask ? (abandon ? 'Abandon daily?' : 'Start a new run?') : 'New run'}
          </button>
        </div>
      </section>
    </Modal>
  );
}
