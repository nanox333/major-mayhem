import React, { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { SHORTCUTS } from './shortcuts';
import { setPrefs, usePrefs } from './prefs';
import { setTipsOn, useTipsOn } from './tips';
import { useSoundOn } from './sound';
import { RefreshIcon, TwitchIcon } from './icons';
import { BackupPreview, applyBackup, backupFileName, backupText, createBackup, downloadText, previewBackup } from '../game/backup';
import { Run } from '../game/state';
import { LANGUAGES, plural, tNode, useT } from '../i18n';

/** An on/off control with a name a screen reader says: "Sound effects, switch, on". */
function Switch({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (on: boolean) => void }) {
  const t = useT();
  return (
    <div className="setrow">
      <div className="setrow__text"><b>{label}</b>{hint && <small>{hint}</small>}</div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'is-on' : ''}`} data-sfx="none" onClick={() => onChange(!on)}><i aria-hidden="true" /><span className="switch__word" aria-hidden="true">{on ? t('common.on') : t('common.off')}</span></button>
    </div>
  );
}

/**
 * Settings (#110): everything you can change about how the game looks, sounds and listens, and the things the top bar used to hold (chat votes, a new run).
 * Kept in this browser. Single-key shortcuts have an off switch here because they must (WCAG 2.1.4).
 */
export function SettingsDialog({ onClose, onTwitch, onNewRun, abandon, toShortcuts, run }: { onClose: () => void; onTwitch: () => void; onNewRun: () => void; abandon: boolean; toShortcuts?: boolean; /** The run on screen, so a backup has it even if the browser could not save it. */ run?: Run }) {
  const t = useT();
  const prefs = usePrefs();
  const [sound, toggleSound] = useSoundOn();
  const tips = useTipsOn();
  const [ask, setAsk] = useState(false);
  const keys = useRef<HTMLElement>(null);
  useEffect(() => { if (toShortcuts) keys.current?.scrollIntoView({ block: 'start' }); }, [toShortcuts]);
  useEffect(() => { if (!ask) return; const timer = setTimeout(() => setAsk(false), 3000); return () => clearTimeout(timer); }, [ask]);
  return (
    <Modal label={t('settings.title')} onClose={onClose} wide>
     <div className="st">
      <header className="st__head">
        <span className="st__kick">{t('settings.kicker')}</span>
        <h3>{t('settings.title')}</h3>
        <p>{t('settings.saved')}</p>
      </header>

      <section className="settings__sec" aria-labelledby="set-sound">
        <h4 id="set-sound">{t('settings.sound')}</h4>
        <Switch label={t('settings.soundFx')} hint={t('settings.soundFxHint')} on={sound} onChange={() => toggleSound()} />
      </section>

      <section className="settings__sec" aria-labelledby="set-look">
        <h4 id="set-look">{t('settings.appearance')}</h4>
        <Switch label={t('settings.contrast')} hint={t('settings.contrastHint')} on={prefs.contrast} onChange={(contrast) => setPrefs({ contrast })} />
        <Switch label={t('settings.fastReveals')} hint={t('settings.fastRevealsHint')} on={prefs.fastReveals} onChange={(fastReveals) => setPrefs({ fastReveals })} />
      </section>

      <section className="settings__sec" aria-labelledby="set-lang">
        <h4 id="set-lang">{t('settings.language')}</h4>
        <div className="setrow">
          <div className="setrow__text"><small>{t('settings.languageHint')}</small></div>
          <select id="set-lang-select" className="settings__select" aria-label={t('settings.language')} value={prefs.language} onChange={(e) => setPrefs({ language: e.target.value })}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </div>
      </section>

      <section className="settings__sec" aria-labelledby="set-tips">
        <h4 id="set-tips">{t('settings.tips')}</h4>
        <Switch label={t('settings.tipsOn')} hint={t('settings.tipsHint')} on={tips} onChange={setTipsOn} />
      </section>

      <section className="settings__sec" aria-labelledby="set-keys" ref={keys}>
        <h4 id="set-keys">{t('settings.shortcuts')}</h4>
        <Switch label={t('settings.shortcutsOn')} hint={t('settings.shortcutsHint')} on={prefs.shortcuts} onChange={(shortcuts) => setPrefs({ shortcuts })} />
        <table className="settings__keys">
          <caption className="sr">{t('settings.shortcutsCaption')}</caption>
          <tbody>{SHORTCUTS.map((k) => <tr key={k.keys}><th scope="row">{k.keys.split('  ').map((x) => <kbd key={x}>{x}</kbd>)}</th><td>{k.does}</td><td className="muted">{k.where}</td></tr>)}</tbody>
        </table>
      </section>

      <DataSection run={run} />

      <section className="settings__sec" aria-labelledby="set-more">
        <h4 id="set-more">{t('settings.more')}</h4>
        <div className="settings__btns">
          <button type="button" className="st-btn" onClick={() => { onClose(); onTwitch(); }}><TwitchIcon size={16} /> {t('settings.twitch')}</button>
          <button type="button" className={`st-btn ${ask ? 'is-ask' : ''}`} title={ask && abandon ? t('nav.dailyAbandoned') : undefined}
            onClick={() => { if (ask) { setAsk(false); onClose(); onNewRun(); } else setAsk(true); }}>
            <RefreshIcon size={16} /> {ask ? (abandon ? t('nav.abandonAsk') : t('settings.startNewRunAsk')) : t('nav.newRun')}
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
  const t = useT();
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const choose = async (f: File | undefined) => {
    if (!f) return;
    setFailed(false);
    try { setPreview(previewBackup(await f.text())); } catch { setPreview({ ok: false, problem: t('settings.cannotRead') }); }
    if (file.current) file.current.value = '';
  };
  const s = preview?.ok ? preview.summary : null;
  return (
    <section className="settings__sec" aria-labelledby="set-data">
      <h4 id="set-data">{t('settings.dataTitle')}</h4>
      <p className="muted small">{t('settings.dataBody')}</p>
      <div className="settings__btns">
        <button type="button" className="st-btn" onClick={() => downloadText(backupFileName(), backupText(createBackup(run)))}>{t('settings.download')}</button>
        <button type="button" className="st-btn" onClick={() => file.current?.click()}>{t('settings.restore')}</button>
        <input ref={file} type="file" accept=".json,application/json" hidden aria-label={t('settings.chooseBackup')} onChange={(e) => choose(e.target.files?.[0])} />
      </div>
      {preview && !preview.ok && <p className="settings__warn" role="alert">{preview.problem}</p>}
      {preview?.ok && s && (
        <div className="settings__restore" role="group" aria-label={t('settings.restoreAria')}>
          <p><b>{t('backup.intro', { from: s.exportedAt ? t('backup.from', { date: s.exportedAt }) : '' })}</b> {t('backup.contents', {
            runs: plural('backup.runs', s.runs),
            titles: plural('backup.titles', s.titles),
            dailies: plural('backup.dailies', s.dailies),
            guessDays: plural('backup.guessDays', s.guessDays),
            open: s.run ? t('backup.openRun', { run: s.run }) : t('backup.noOpenRun'),
          })}</p>
          <p>{tNode('backup.restoreWarn', { replaces: <b>{t('backup.replaces')}</b> })}</p>
          <div className="settings__btns">
            <button type="button" className="st-btn is-ask" onClick={() => { if (applyBackup(preview.backup)) location.reload(); else setFailed(true); }}>{t('backup.replace')}</button>
            <button type="button" className="st-btn" onClick={() => { setPreview(null); setFailed(false); }}>{t('backup.cancel')}</button>
          </div>
          {failed && <p className="settings__warn" role="alert">{t('backup.failed')}</p>}
        </div>
      )}
    </section>
  );
}
