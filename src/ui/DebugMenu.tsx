import React, { useEffect, useState } from 'react';
import { ROSTERS } from '../data/rosters';
import { ACHIEVEMENTS } from '../game/achievements';
import { Run, today } from '../game/state';
import { Built, scenarioById } from './debug/scenarios';
import { EffectsTab, EnvironmentTab, ScenariosTab, ToolsTab } from './debug/Workbench';
import { snapshotOnce } from './debug/tools';
import { DEBUG_FLAG, debugEnabled as enabled, debugInUrl, setDebugRatings, useDebugRatings } from './debugFlags';

/** Debug tools: hidden unless ?debug is in the address or Ctrl+Shift+D was pressed (remembered in this browser), in every build. Nothing here is part of the game. */
const FLAG = DEBUG_FLAG;
const mine = (k: string) => k.startsWith('major-mayhem') || k.startsWith('mm-');
const read = () => { try { return Object.keys(localStorage).filter(mine).sort().map((k) => ({ k, n: (localStorage.getItem(k) ?? '').length })); } catch { return []; } };


const STATS_KEY = 'major-mayhem-stats-v1';
const dayBack = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return today(d); };
const PLACES: [string, number][] = [['Champions', 4], ['Runner-up', 3], ['Semifinal', 2], ['Champions', 4], ['Quarterfinal', 1], ['Runner-up', 3], ['Out in the Swiss stage', 0]];
const NICKS = ['ZywOo', 's1mple', 'NiKo', 'donk', 'm0NESY', 'device', 'electroNic'];
const readStats = () => { try { return JSON.parse(localStorage.getItem(STATS_KEY) ?? 'null'); } catch { return null; } };
const baseStats = () => readStats() ?? { v: 1, runs: 0, titles: 0, reached: [0, 0, 0, 0, 0], streak: 0, bestStreak: 0, drafted: {}, daily: {}, ach: {}, lastNew: [], duels: { w: 0, l: 0 } };
const dailyEntry = (i: number) => { const [placement, reached] = PLACES[i % PLACES.length]; return { placement, reached, mvp: NICKS[i % NICKS.length], grade: 0.7 + ((i * 7) % 30) / 100, abandoned: false, share: `Major Mayhem Daily (dummy ${i})` }; };
const write = (st: unknown) => { try { localStorage.setItem(STATS_KEY, JSON.stringify(st)); } catch { /* ignore */ } };

const TABS = [['scenarios', 'Scenarios'], ['effects', 'Effects'], ['env', 'Environment'], ['tools', 'Tools'], ['data', 'Data']] as const;
type Tab = (typeof TABS)[number][0];

export function DebugMenu({ jump, run }: { /** Replaces the run on screen and opens it on the right page (and, for a match, at the right round). */ jump?: (built: Built) => void; /** The run on screen, for the tools. */ run: Run }) {
  // Asking for it in the address turns it on for this browser, since a page address can lose the `?debug` as you move about (until "Hide debug").
  const [on, setOn] = useState(() => { if (debugInUrl()) { try { localStorage.setItem(FLAG, '1'); } catch { /* storage unavailable */ } } return enabled(); });
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState(read);
  const [note, setNote] = useState('');
  const [days, setDays] = useState(5);
  const [tab, setTab] = useState<Tab>('scenarios');
  const [scenario, setScenario] = useState<string | null>(null);
  const ratings = useDebugRatings();
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); try { localStorage.setItem(FLAG, '1'); } catch { /* storage unavailable */ } setOn(true); setOpen((o) => !o); }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, []);
  useEffect(() => { if (open) setKeys(read()); }, [open]);
  // ?debug&scenario=<id> opens that scenario once when the page loads, so a state can be linked in an issue or used by a test.
  useEffect(() => {
    if (!on || !jump) return;
    const id = new URLSearchParams(location.search + (location.hash.includes('?') ? location.hash.slice(location.hash.indexOf('?')) : '')).get('scenario');
    const sc = id ? scenarioById.get(id) : null;
    if (!sc) return;
    try { history.replaceState(null, '', location.pathname + location.hash.replace(/\?.*$/, '')); } catch { /* ignore */ }
    const b = sc.build();
    if (b) { snapshotOnce(); setScenario(sc.id); jump(b); }
  }, []);
  if (!on) return null;
  const refresh = (msg: string) => { setKeys(read()); setNote(msg); };
  const drop = (...ks: string[]) => { ks.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } }); };
  const dropAndReload = (msg: string, ...ks: string[]) => { snapshotOnce(); drop(...ks); setNote(`${msg} Reloading…`); setTimeout(() => location.reload(), 250); };
  const fakeDaily = () => {
    try {
      const st = JSON.parse(localStorage.getItem('major-mayhem-stats-v1') ?? 'null') ?? { v: 1, runs: 1, titles: 0, reached: [0, 0, 0, 1, 0], streak: 1, bestStreak: 1 };
      st.daily = { ...(st.daily ?? {}), [today()]: { placement: 'Runner-up', reached: 3, mvp: 'ZywOo', grade: 0.94, abandoned: false, share: 'Major Mayhem daily (debug)' } };
      localStorage.setItem('major-mayhem-stats-v1', JSON.stringify(st));
    } catch { /* ignore */ }
    dropAndReload("Today's daily marked finished.", 'major-mayhem-run-v2');
  };
  const clearToday = () => {
    try {
      const st = JSON.parse(localStorage.getItem('major-mayhem-stats-v1') ?? 'null');
      if (st?.daily) { delete st.daily[today()]; localStorage.setItem('major-mayhem-stats-v1', JSON.stringify(st)); }
    } catch { /* ignore */ }
    dropAndReload("Today's daily result cleared.");
  };
  const loadDummy = () => {
    const daily: Record<string, unknown> = {};
    for (let i = 0; i < 9; i++) if (i !== 4) daily[dayBack(i)] = dailyEntry(i);
    const players = ROSTERS.flatMap((r) => r.players).slice(0, 40);
    const drafted: Record<string, number> = {};
    players.slice(0, 8).forEach((p, i) => { drafted[p.id] = 8 - i; });
    const ach = Object.fromEntries(ACHIEVEMENTS.slice(0, 6).map((a, i) => [a.id, dayBack(i)]));
    write({ v: 1, runs: 18, titles: 5, reached: [4, 3, 3, 3, 5], streak: 2, bestStreak: 3, drafted, daily, ach, lastNew: [], duels: { w: 3, l: 1 }, byMode: { since: dayBack(30), daily: { runs: 9, titles: 3 }, free: { all: { runs: 9, titles: 2 } } } });
    dropAndReload('Dummy stats loaded.', 'major-mayhem-run-v2');
  };
  const setStreak = (n: number) => {
    const st = baseStats();
    for (let i = 0; i < n; i++) st.daily[dayBack(i)] = st.daily[dayBack(i)] ?? dailyEntry(i);
    for (let i = n; i < n + 1; i++) delete st.daily[dayBack(i)];
    st.runs = Math.max(st.runs, n);
    write(st);
    dropAndReload(`Daily streak set to ${n}.`, 'major-mayhem-run-v2');
  };
  const setAch = (all: boolean) => {
    const st = baseStats();
    st.ach = all ? Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, today()])) : {};
    write(st);
    dropAndReload(all ? 'All achievements unlocked.' : 'Achievements cleared.');
  };
  const all = keys.map((x) => x.k);
  return (
    <div className="dbg">
      {open && (
        <section className="dbg__panel" aria-label="Debug menu">
          <header><b>Debug</b><button type="button" onClick={() => setOpen(false)} aria-label="Close debug menu">×</button></header>
          <div className="dbg__tabs" role="tablist" aria-label="Debug sections">
            {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
          </div>
          {tab === 'scenarios' && jump && <ScenariosTab jump={(b) => { jump(b); setOpen(false); }} say={setNote} onRan={setScenario} />}
          {tab === 'effects' && jump && <EffectsTab jump={(b) => { jump(b); setOpen(false); }} say={setNote} />}
          {tab === 'env' && <EnvironmentTab say={setNote} />}
          {tab === 'tools' && <ToolsTab run={run} scenario={scenario} say={setNote} />}
          {tab === 'data' && <>
          <div className="dbg__grid">
            <button type="button" className="is-danger" onClick={() => dropAndReload('Everything cleared.', ...all)}>Clear all data</button>
            <button type="button" onClick={() => dropAndReload('Run cleared.', 'major-mayhem-run-v2')}>Clear current run</button>
            <button type="button" onClick={() => dropAndReload('Stats cleared.', 'major-mayhem-stats-v1')}>Clear stats</button>
            <button type="button" onClick={() => dropAndReload('Guess the pro cleared.', 'major-mayhem-guess-v1')}>Clear Guess data</button>
            <button type="button" onClick={() => dropAndReload('Tips will show again.', 'mm-tips')}>Reset tips</button>
            <button type="button" onClick={() => dropAndReload('Settings cleared.', 'mm-prefs', 'mm-sound')}>Reset settings</button>
            <button type="button" onClick={fakeDaily}>Mark today's daily done</button>
            <button type="button" onClick={clearToday}>Clear today's daily</button>
          </div>
          <h4>Test data</h4>
          <div className="dbg__grid">
            <button type="button" onClick={loadDummy}>Load dummy stats</button>
            <button type="button" onClick={() => setAch(true)}>Unlock all achievements</button>
            <button type="button" onClick={() => setAch(false)}>Clear achievements</button>
            <button type="button" aria-pressed={ratings} onClick={() => setDebugRatings(!ratings)}>Player ratings (archive and draft): {ratings ? 'on' : 'off'}</button>
            <label className="dbg__streak"><span>Streak</span><input type="number" min={0} max={60} value={days} onChange={(e) => setDays(Math.max(0, Math.min(60, Number(e.target.value) || 0)))} aria-label="Daily streak days" /><button type="button" onClick={() => setStreak(days)}>Set</button></label>
          </div>
          <h4>Saved in this browser</h4>
          <ul className="dbg__keys">
            {keys.length === 0 && <li className="dbg__empty">Nothing saved.</li>}
            {keys.map(({ k, n }) => (
              <li key={k}><code>{k}</code><span>{n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`}</span>
                <button type="button" onClick={() => { drop(k); refresh(`Removed ${k}. Reload to see it take effect.`); }} aria-label={`Remove ${k}`}>Remove</button></li>
            ))}
          </ul>
          <div className="dbg__foot">
            <button type="button" onClick={() => { navigator.clipboard?.writeText(localStorage.getItem('major-mayhem-run-v2') ?? '').then(() => setNote('Run copied.'), () => setNote('Could not copy.')); }}>Copy run JSON</button>
            <button type="button" onClick={() => location.reload()}>Reload</button>
            <button type="button" onClick={() => { try { localStorage.removeItem(FLAG); } catch { /* ignore */ } setOn(enabled()); setOpen(false); }}>Hide debug</button>
          </div>
          </>}
          {note && <p role="status" className="dbg__note">{note}</p>}
        </section>
      )}
      <button type="button" className="dbg__fab" aria-expanded={open} onClick={() => setOpen((o) => !o)}>Debug</button>
    </div>
  );
}
