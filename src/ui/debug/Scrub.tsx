import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lineup } from '../../game/lineup';
import type { LegendKind } from '../../game/match';
import { Stage, CINEMATIC_FPS } from '../legend3d/Stage';
import { AceHighlight } from '../ace/AceHighlight';
import { ACE_DURATION } from '../ace/timeline';
import { NinjaDefuseHighlight } from '../ninja/NinjaDefuseHighlight';
import { NINJA_REAL } from '../ninja/timeline';
import { KnifeKillHighlight } from '../knife/KnifeKillHighlight';
import { KNIFE_DURATION } from '../knife/timeline';
import { ClutchHighlight } from '../clutch/ClutchHighlight';
import { CLUTCH_DURATION } from '../clutch/timeline';
import { LEGEND_INFO } from '../Legend';

/** Seek the same real-time highlight used in the game, frame by frame or at a chosen speed. */
export function Scrub({ kind, onClose, who }: { kind: LegendKind; onClose: () => void; who?:Lineup }) {
  const [failed, setFailed] = useState(false);
  const [dur, setDur] = useState(kind === 'ace' ? ACE_DURATION : kind === 'ninja' ? NINJA_REAL : kind === 'knife' ? KNIFE_DURATION : kind === 'clutch5' ? CLUTCH_DURATION : 0);
  const end = Math.max(0, dur - 1 / CINEMATIC_FPS);
  const [t, setT] = useState(0);
  const [play, setPlay] = useState(false);
  const [rate, setRate] = useState(1);
  const last = useRef(0);
  useEffect(() => {
    if (!play || !dur) return;
    let raf = 0; last.current = performance.now();
    const tick = (n: number) => { const dt = (n - last.current) / 1000 * rate; last.current = n; setT((v) => (v + dt > end ? 0 : v + dt)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, dur, end, rate]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === ' ') { e.preventDefault(); setPlay((p) => !p); }
      else if (e.key === 'ArrowRight') { setPlay(false); setT((v) => Math.min(end, v + 1 / CINEMATIC_FPS)); }
      else if (e.key === 'ArrowLeft') { setPlay(false); setT((v) => Math.max(0, v - 1 / CINEMATIC_FPS)); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [end]);
  const step = (d: number) => { setPlay(false); setT((v) => Math.min(end, Math.max(0, v + d / CINEMATIC_FPS))); };
  return createPortal(
    <div className="dbg-scrub" role="dialog" aria-label={`${LEGEND_INFO[kind].title}, frame scrubber`}>
      {kind === 'clutch5' ? <ClutchHighlight at={t} who={who} map="Mirage" round={14} /> : kind === 'knife' ? <KnifeKillHighlight at={t} who={who} map="Mirage" round={14} /> : kind === 'ninja' ? <NinjaDefuseHighlight at={t} who={who} map="Mirage" round={14} /> : kind === 'ace' ? <AceHighlight at={t} who={who} map="Mirage" round={14} /> : <Stage kind={kind} at={t} who={who} map="Mirage" round={14} onReady={setDur} onError={() => setFailed(true)} />}
      <div className="dbg-scrub__bar">
        {failed && <span role="alert">3D scene could not load. Close and retry.</span>}
        <button type="button" onClick={() => setPlay((p) => !p)}>{play ? 'Pause' : 'Play'}</button>
        <button type="button" onClick={() => step(-1)} aria-label="Back one frame">◀</button>
        <button type="button" onClick={() => step(1)} aria-label="Forward one frame">▶</button>
        <input type="range" min={0} max={end || 1} step={1 / CINEMATIC_FPS} value={t} onChange={(e) => { setPlay(false); setT(Number(e.target.value)); }} aria-label="Time" />
        <output>{t.toFixed(2)} / {dur.toFixed(2)}s · f{Math.round(t * CINEMATIC_FPS)}</output>
        {[0.1, 0.25, 0.5, 1].map((r) => <button key={r} type="button" aria-pressed={rate === r} onClick={() => setRate(r)}>{r === 1 ? '1×' : `×${r}`}</button>)}
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>, document.body);
}
