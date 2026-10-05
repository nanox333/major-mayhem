import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LegendKind } from '../../game/match';
import { Stage, CINEMATIC_FPS } from '../legend3d/Stage';
import { LEGEND_INFO } from '../Legend';

/** Seek the same rendered video used in the game, frame by frame or at a chosen speed. */
export function Scrub({ kind, onClose }: { kind: LegendKind; onClose: () => void }) {
  const [failed, setFailed] = useState(false);
  const [dur, setDur] = useState(0);
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
      <Stage kind={kind} at={t} onReady={setDur} onError={() => setFailed(true)} />
      <div className="dbg-scrub__bar">
        {failed && <span role="alert">Video could not load. Close and retry.</span>}
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
