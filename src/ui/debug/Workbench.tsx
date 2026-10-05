import React, { useEffect, useRef, useState } from 'react';
import * as G from '../../game/logic';
import { LEGENDS, LegendKind, MatchEvent } from '../../game/match';
import { debugHooks } from '../../game/debugHooks';
import { clockOffset, nowDate, setClockOffset } from '../../game/clock';
import { Run, today } from '../../game/state';
import { LEGEND_INFO, LegendOverlay } from '../Legend';
import { debugForceLite, debugForceReducedMotion, setDebugForceLite, setDebugForceReducedMotion } from '../debugFlags';
import { SCENARIOS, SCENARIO_GROUPS, Built, draftedRun, scenarioById } from './scenarios';
import { Finding, bugReport, clearScan, dropSnapshot, restoreSnapshot, scanPage, snapshotInfo, snapshotOnce } from './tools';

/** The debug workbench (#296): scenarios, effects, the environment and some tools. Everything here is reached from the hidden debug menu. */
type Say = (msg: string) => void;

export function ScenariosTab({ jump, say, onRan }: { jump: (b: Built) => void; say: Say; onRan: (id: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = (id: string) => {
    const sc = scenarioById.get(id);
    if (!sc) return;
    setBusy(id);
    // Let the "Searching…" show before a search that can take a moment blocks the page.
    setTimeout(() => {
      const t0 = performance.now();
      try {
        const b = sc.build();
        if (!b) say(`Could not find “${sc.title}” in the search budget. Try again.`);
        else { snapshotOnce(); onRan(id); jump(b); say(`${sc.title} (${Math.round(performance.now() - t0)} ms)`); }
      } catch (e) { say(`Failed: ${(e as Error).message}`); }
      setBusy(null);
    }, 30);
  };
  return (
    <div className="dbg__scen">
      <p className="dbg__hint">Every state is built by playing the real game, then opened on its page. Searches look through real runs for the one you ask for.</p>
      {SCENARIO_GROUPS.map((g) => (
        <details key={g} open={g === 'Live match' || g === 'Legendary moments'}>
          <summary>{g}<small>{SCENARIOS.filter((s) => s.group === g).length}</small></summary>
          <ul>
            {SCENARIOS.filter((s) => s.group === g).map((s) => (
              <li key={s.id}>
                <button type="button" disabled={busy !== null} onClick={() => run(s.id)} title={s.note}>{busy === s.id ? 'Searching…' : s.title}</button>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

const fakeEvent = (kind: LegendKind, who?: string): MatchEvent => ({
  round: 14, kind: 'legend', legend: kind, mine: true, good: true, playerId: who,
  text: kind === 'ace' ? 'Somebody aces the round: five kills and nobody left to answer.' : kind === 'clutch5' ? 'Somebody clutches a 1v5. Five of them, one player.' : kind === 'flawless' ? 'Flawless victory: 13–0 and not one round dropped.' : 'Miracle comeback: 9 rounds down and still won the map.',
});

export function EffectsTab({ say, jump }: { say: Say; jump: (b: Built) => void }) {
  const [demo, setDemo] = useState<{ kind: LegendKind; mine: G.Lineup[] } | null>(null);
  const [rate, setRate] = useState(1);
  const [paused, setPaused] = useState(false);
  const [armed, setArmed] = useState<LegendKind | null>(debugHooks.legend);
  // Slow motion and pause apply to every running CSS animation and transition on the page; new ones are picked up as they start.
  useEffect(() => {
    if (rate === 1 && !paused) return;
    const apply = () => document.getAnimations().forEach((a) => { a.playbackRate = rate; if (paused && a.playState === 'running') a.pause(); if (!paused && a.playState === 'paused') a.play(); });
    apply();
    const id = setInterval(apply, 120);
    return () => { clearInterval(id); document.getAnimations().forEach((a) => { a.playbackRate = 1; if (a.playState === 'paused') a.play(); }); };
  }, [rate, paused]);
  const replay = () => {
    const all = document.getAnimations().filter((a) => !(a.effect as KeyframeEffect | null)?.target?.closest?.('.dbg'));
    all.forEach((a) => { a.cancel(); a.play(); });
    say(`Restarted ${all.length} animation${all.length === 1 ? '' : 's'} on this page.`);
  };
  const open = (kind: LegendKind) => { const mine = G.lineupFromPicks(draftedRun(7).picks); setDemo({ kind, mine }); };
  const arm = (k: LegendKind | null) => { debugHooks.legend = k; setArmed(k); say(k ? `Armed: the first round your team wins on the next map played is ${LEGEND_INFO[k].title}.` : 'Disarmed.'); };
  return (
    <div className="dbg__fx">
      <h4>Legendary moment cinematic</h4>
      <div className="dbg__grid">
        {LEGENDS.map((k) => <button key={k} type="button" onClick={() => open(k)}>{LEGEND_INFO[k].title}</button>)}
      </div>
      <p className="dbg__hint">Plays the real card with a random lineup. Any key or a tap closes it.</p>
      <h4>Arm a real one</h4>
      <div className="dbg__grid">
        <button type="button" aria-pressed={armed === 'ace'} onClick={() => arm(armed === 'ace' ? null : 'ace')}>Next map: an ace</button>
        <button type="button" aria-pressed={armed === 'clutch5'} onClick={() => arm(armed === 'clutch5' ? null : 'clutch5')}>Next map: a 1v5</button>
      </div>
      <p className="dbg__hint">Or use “Legendary moments” in the scenarios, which arms it and opens the match one round before.</p>
      <h4>This page</h4>
      <div className="dbg__grid">
        <button type="button" onClick={replay}>Replay animations</button>
        <button type="button" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>{paused ? 'Resume animations' : 'Freeze animations'}</button>
      </div>
      <div className="dbg__seg" role="group" aria-label="Animation speed">
        {[0.1, 0.25, 0.5, 1].map((r) => <button key={r} type="button" aria-pressed={rate === r} onClick={() => setRate(r)}>{r === 1 ? 'Normal' : `×${r}`}</button>)}
      </div>
      <h4>Where each one plays</h4>
      <ul className="dbg__where">
        {[
          ['Reel, tilt, skip', 'draft-sealed', 'press Open case'],
          ['Veto stamps, locked map', 'veto-start', 'ban maps'],
          ['Knife badge', 'knife-won', ''],
          ['Score pop, round log, markers', 'live-r0', 'press Resume'],
          ['Timeout boost and card', 'live-timeout', ''],
          ['Key moments, MVP pop', 'map-won', ''],
          ['Champion, W/L blocks', 'results-champion', ''],
        ].map(([label, id, how]) => <li key={id}><button type="button" onClick={() => { const b = scenarioById.get(id)?.build(); if (b) { snapshotOnce(); jump(b); say(`${label}${how ? `: ${how}` : ''}`); } }}>{label}</button>{how && <small>{how}</small>}</li>)}
      </ul>
      {demo && <LegendOverlay e={fakeEvent(demo.kind, demo.mine[0]?.player.id)} mine={demo.mine} map="Mirage" onDone={() => setDemo(null)} />}
    </div>
  );
}

const SIZES: [number, string][] = [[320, 'small phone'], [360, 'Android'], [375, 'iPhone'], [390, 'iPhone 14'], [430, 'iPhone Max'], [768, 'tablet'], [1024, 'laptop']];

function DevicePreview({ width, onClose }: { width: number; onClose: () => void }) {
  const url = `${location.origin}${location.pathname}${location.search || '?debug'}${location.hash}`;
  return (
    <div className="dbg-preview" role="group" aria-label={`Preview at ${width} pixels wide`}>
      <header><b>{width}px wide</b><span>Same saves as this tab: playing here changes them there.</span><button type="button" onClick={onClose} aria-label="Close preview">×</button></header>
      <div className="dbg-preview__stage"><iframe title={`Game at ${width}px`} src={url} style={{ width }} /></div>
    </div>
  );
}

export function EnvironmentTab({ say }: { say: Say }) {
  const [width, setWidth] = useState<number | null>(null);
  const [lite, setLite] = useState(debugForceLite());
  const [rm, setRm] = useState(debugForceReducedMotion());
  const off = clockOffset();
  const [date, setDate] = useState(today());
  const reload = (msg: string) => { say(`${msg} Reloading…`); setTimeout(() => location.reload(), 250); };
  const toDate = () => { const d = new Date(`${date}T12:00:00`); if (Number.isNaN(d.getTime())) return say('That is not a date.'); setClockOffset(d.getTime() - Date.now()); reload(`Clock set to ${date} at noon.`); };
  const beforeMidnight = () => { const n = new Date(); const m = new Date(n); m.setHours(23, 59, 50, 0); setClockOffset(m.getTime() - n.getTime()); reload('Clock set to 10 seconds before midnight.'); };
  return (
    <div className="dbg__env">
      <h4>Phone and tablet sizes</h4>
      <div className="dbg__grid dbg__grid--3">
        {SIZES.map(([w, label]) => <button key={w} type="button" onClick={() => setWidth(w)}><b>{w}</b><small>{label}</small></button>)}
      </div>
      <p className="dbg__hint">Opens the game at that width in a frame, with the same saves. Use it with the Tools scan.</p>
      <h4>Device behaviour</h4>
      <div className="dbg__grid">
        <button type="button" aria-pressed={lite} onClick={() => { setDebugForceLite(!lite); setLite(!lite); say(`Lite reel ${!lite ? 'forced on' : 'off'} (applies to the next case).`); }}>Lite reel: {lite ? 'on' : 'off'}</button>
        <button type="button" aria-pressed={rm} onClick={() => { setDebugForceReducedMotion(!rm); setRm(!rm); say(`Reduced motion in code ${!rm ? 'forced on' : 'off'} (the stylesheet follows the system setting).`); }}>Reduced motion (code): {rm ? 'on' : 'off'}</button>
      </div>
      <h4>Clock</h4>
      <p className="dbg__hint">Now: <b>{nowDate().toLocaleString()}</b>{off ? ` (${Math.round(off / 3600000)} h from the real time)` : ' (real time)'}</p>
      <div className="dbg__row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Pretend it is this date" />
        <button type="button" onClick={toDate}>Set</button>
      </div>
      <div className="dbg__grid">
        <button type="button" onClick={beforeMidnight}>10 s before midnight</button>
        <button type="button" onClick={() => { setClockOffset(0); reload('Real clock restored.'); }}>Real time</button>
      </div>
      <p className="dbg__hint">A date in the past or future changes the daily and its rules version. Watch the “New daily” notice appear at midnight.</p>
      {width && <DevicePreview width={width} onClose={() => setWidth(null)} />}
    </div>
  );
}

export function ToolsTab({ run, scenario, say }: { run: Run; scenario: string | null; say: Say }) {
  const [found, setFound] = useState<Finding[] | null>(null);
  const [snap, setSnap] = useState(snapshotInfo());
  const counts = found ? { overflow: found.filter((f) => f.kind === 'overflow').length, tap: found.filter((f) => f.kind === 'tap').length, text: found.filter((f) => f.kind === 'text').length } : null;
  const link = scenario ? `${location.origin}${location.pathname}?debug&scenario=${scenario}` : '';
  const copy = (text: string, ok: string) => navigator.clipboard?.writeText(text).then(() => say(ok), () => say('Could not copy.'));
  const ref = useRef(0);
  useEffect(() => () => { clearScan(); ref.current++; }, []);
  return (
    <div className="dbg__tools">
      <h4>Scan this page</h4>
      <div className="dbg__grid">
        <button type="button" onClick={() => { const f = scanPage(); setFound(f); say(`${f.length} thing${f.length === 1 ? '' : 's'} flagged, outlined in red (overflow), orange (tap target) or yellow (small text).`); }}>Scan</button>
        <button type="button" onClick={() => { clearScan(); setFound(null); }}>Clear outlines</button>
      </div>
      {counts && <p className="dbg__hint">{counts.overflow} overflow · {counts.tap} tap targets under 40px · {counts.text} texts under 11.5px</p>}
      {found && found.length > 0 && <ul className="dbg__found">{found.slice(0, 40).map((f, i) => <li key={i} data-kind={f.kind}><b>{f.kind}</b><span>{f.label}</span><small>{f.detail}</small></li>)}</ul>}
      <h4>This run</h4>
      <p className="dbg__hint">phase <b>{run.phase}</b> · step <b>{run.step}</b> · mode <b>{run.mode}</b> · rules <b>v{run.rules ?? '?'}</b> · seed <code>{run.seed}</code></p>
      <div className="dbg__grid">
        <button type="button" onClick={() => copy(bugReport(run, scenario ?? undefined), 'Bug report copied.')}>Copy bug report</button>
        <button type="button" disabled={!link} onClick={() => copy(link, 'Scenario link copied.')} title={link || 'Open a scenario first'}>Copy scenario link</button>
      </div>
      <h4>Your real data</h4>
      <p className="dbg__hint">{snap ? `A snapshot of your saves was taken ${new Date(snap.at).toLocaleString()} (${snap.keys} items), before the first change.` : 'Nothing has been changed yet; a snapshot is taken before the first change.'}</p>
      <div className="dbg__grid">
        <button type="button" disabled={!snap} onClick={() => { if (restoreSnapshot()) { say('Your data is back. Reloading…'); setTimeout(() => location.reload(), 250); } }}>Restore my data</button>
        <button type="button" disabled={!snap} onClick={() => { dropSnapshot(); setSnap(null); say('Snapshot forgotten.'); }}>Forget snapshot</button>
      </div>
    </div>
  );
}
