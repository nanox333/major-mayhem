import React, { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { SHORTCUTS } from './shortcuts';
import { Theme, setPrefs, usePrefs } from './prefs';
import { setTipsOn, useTipsOn } from './tips';
import { useSoundOn } from './sound';
import { RefreshIcon, TwitchIcon } from './icons';
import { BackupPreview, applyBackup, backupFileName, backupText, createBackup, downloadText, previewBackup } from '../game/backup';
import { Run } from '../game/state';

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
export function SettingsDialog({ onClose, onTwitch, onNewRun, abandon, toShortcuts, run }: { onClose: () => void; onTwitch: () => void; onNewRun: () => void; abandon: boolean; toShortcuts?: boolean; /** The run on screen, so a backup has it even if the browser could not save it. */ run?: Run }) {
  const prefs = usePrefs();
  const [sound, toggleSound] = useSoundOn();
  const tips = useTipsOn();
  const [ask, setAsk] = useState(false);
  const keys = useRef<HTMLElement>(null);
  useEffect(() => { if (toShortcuts) keys.current?.scrollIntoView({ block: 'start' }); }, [toShortcuts]);
  useEffect(() => { if (!ask) return; const t = setTimeout(() => setAsk(false), 3000); return () => clearTimeout(t); }, [ask]);
  return (
    <Modal label="Settings" onClose={onClose} wide>
     <div className="st">
      <header className="st__head">
        <span className="st__kick">Preferences</span>
        <h3>Settings</h3>
        <p>Saved in this browser.</p>
      </header>

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
        <Switch label="Fast case reveals" hint="Show the dealt case immediately. Reduced motion always skips the reel." on={prefs.fastReveals} onChange={(fastReveals) => setPrefs({ fastReveals })} />
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

      <DataSection run={run} />

      <section className="settings__sec" aria-labelledby="set-more">
        <h4 id="set-more">More</h4>
        <div className="settings__btns">
          <button type="button" className="st-btn" onClick={() => { onClose(); onTwitch(); }}><TwitchIcon size={16} /> Twitch chat votes</button>
          <button type="button" className={`st-btn ${ask ? 'is-ask' : ''}`} title={ask && abandon ? "Today's daily will count as abandoned" : undefined}
            onClick={() => { if (ask) { setAsk(false); onClose(); onNewRun(); } else setAsk(true); }}>
            <RefreshIcon size={16} /> {ask ? (abandon ? 'Abandon daily?' : 'Start a new run?') : 'New run'}
          </button>
        </div>
      </section>
     </div>
    </Modal>
  );
}

/**
 * A backup you keep and can restore from (#189). It holds your record, your Guess history and the run you have open, and stays on your device. Restoring
 * shows what is in the file first, replaces what is saved here (it never adds to it, so nothing is counted twice), and changes nothing if the file is bad.
 */
export function DataSection({ run }: { run?: Run }) {
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const choose = async (f: File | undefined) => {
    if (!f) return;
    setFailed(false);
    try { setPreview(previewBackup(await f.text())); } catch { setPreview({ ok: false, problem: "That file couldn't be read." }); }
    if (file.current) file.current.value = '';
  };
  return (
    <section className="settings__sec" aria-labelledby="set-data">
      <h4 id="set-data">Your data</h4>
      <p className="muted small">Your record, your Guess history and the run you have open are kept in this browser only. A backup is a file you keep; restoring one replaces what is saved here.</p>
      <div className="settings__btns">
        <button type="button" className="st-btn" onClick={() => downloadText(backupFileName(), backupText(createBackup(run)))}>Download a backup</button>
        <button type="button" className="st-btn" onClick={() => file.current?.click()}>Restore from a file…</button>
        <input ref={file} type="file" accept=".json,application/json" hidden aria-label="Choose a backup file" onChange={(e) => choose(e.target.files?.[0])} />
      </div>
      {preview && !preview.ok && <p className="settings__warn" role="alert">{preview.problem}</p>}
      {preview?.ok && (
        <div className="settings__restore" role="group" aria-label="Restore this backup?">
          <p><b>This backup{preview.summary.exportedAt ? ` (from ${preview.summary.exportedAt})` : ''} holds:</b> {preview.summary.runs} Major run{preview.summary.runs === 1 ? '' : 's'}, {preview.summary.titles} title{preview.summary.titles === 1 ? '' : 's'}, {preview.summary.dailies} daily result{preview.summary.dailies === 1 ? '' : 's'}, {preview.summary.guessDays} day{preview.summary.guessDays === 1 ? '' : 's'} of Guess history{preview.summary.run ? `, and an open run: ${preview.summary.run}` : ', and no open run'}.</p>
          <p>Restoring <b>replaces</b> what is saved here with this. Download a backup of your current data first if you want to keep it.</p>
          <div className="settings__btns">
            <button type="button" className="st-btn is-ask" onClick={() => { if (applyBackup(preview.backup)) location.reload(); else setFailed(true); }}>Replace my data</button>
            <button type="button" className="st-btn" onClick={() => { setPreview(null); setFailed(false); }}>Cancel</button>
          </div>
          {failed && <p className="settings__warn" role="alert">The browser would not save the restored data, so nothing was changed.</p>}
        </div>
      )}
    </section>
  );
}
