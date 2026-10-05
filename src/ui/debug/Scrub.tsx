import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LegendKind } from '../../game/match';
import { Stage } from '../legend3d/Stage';
import { LEGEND_INFO } from '../Legend';

/** Full-screen view of one 3D scene with a frame scrubber: drag to any moment, step a frame at a time, or play it at a chosen speed. Every 3D scene is a pure function of time, so this shows exactly what the game shows. */
export function Scrub({ kind, onClose }: { kind: LegendKind; onClose: () => void }) {
  const [dur, setDur] = useState(0);
  const [t, setT] = useState(0);
  const [play, setPlay] = useState(false);
  const [rate, setRate] = useState(1);
  const last = useRef(0);
  useEffect(() => {
    if (!play || !dur) return;
    let raf = 0; last.current = performance.now();
    const tick = (n: number) => { const dt = (n - last.current) / 1000 * rate; last.current = n; setT((v) => (v + dt >= dur ? 0 : v + dt)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, dur, rate]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === ' ') { e.preventDefault(); setPlay((p) => !p); }
      else if (e.key === 'ArrowRight') { setPlay(false); setT((v) => Math.min(dur, v + 1 / 60)); }
      else if (e.key === 'ArrowLeft') { setPlay(false); setT((v) => Math.max(0, v - 1 / 60)); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [dur]);
  const step = (d: number) => { setPlay(false); setT((v) => Math.min(dur, Math.max(0, v + d / 60))); };
  return createPortal(
    <div className="dbg-scrub" role="dialog" aria-label={`${LEGEND_INFO[kind].title}, frame scrubber`}>
      <Stage kind={kind} at={t} onReady={setDur} />
      <div className="dbg-scrub__bar">
        <button type="button" onClick={() => setPlay((p) => !p)}>{play ? 'Pause' : 'Play'}</button>
        <button type="button" onClick={() => step(-1)} aria-label="Back one frame">◀</button>
        <button type="button" onClick={() => step(1)} aria-label="Forward one frame">▶</button>
        <input type="range" min={0} max={dur || 1} step={1 / 120} value={t} onChange={(e) => { setPlay(false); setT(Number(e.target.value)); }} aria-label="Time" />
        <output>{t.toFixed(2)} / {dur.toFixed(2)}s · f{Math.round(t * 60)}</output>
        {[0.1, 0.25, 0.5, 1].map((r) => <button key={r} type="button" aria-pressed={rate === r} onClick={() => setRate(r)}>{r === 1 ? '1×' : `×${r}`}</button>)}
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>, document.body);
}
