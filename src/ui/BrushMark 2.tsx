import React, { useId } from 'react';

export interface BrushLine { text: string; size: number; width: number; className?: string }

/** The ace's brush-cut wordmark treatment for any short title: heavy italic letters, tilted, with the same diagonal cuts, notches and
 *  scratches knocked out of them. Inline vector art with no font or texture download beyond the game's display face. Lines are stacked and centred. */
export function BrushMark({ lines, width = 720, label }: { lines: BrushLine[]; width?: number; label: string }) {
  const id = useId().replace(/:/g, '');
  let y = 0; const rows = lines.map((l) => { y += l.size * (y ? .9 : .84); return { ...l, base: y }; });
  const height = Math.round(y + 90);
  const cuts = Array.from({ length: 6 }, (_, i) => { const x = (i * 83 + 20) % width, y0 = height * .5 + (i * 37) % (height * .42); return `M${x} ${y0}l${90 + (i * 29) % 80} -${70 + (i * 13) % 40}`; }).join('');
  const notches = Array.from({ length: 3 }, (_, i) => { const x = 60 + (i * 241) % (width - 160), y0 = height * .3 + (i * 91) % (height * .5); return `M${x} ${y0}l${30 + i * 5} -${10 + i * 3} -${24 + i * 4} ${14 + i * 2}Z`; }).join('');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="brush-mark" style={{ overflow: 'visible' }} role="img" aria-label={label}>
      <defs><mask id={id} maskUnits="userSpaceOnUse" x={-120} y={-120} width={width + 240} height={height + 240}><rect x={-120} y={-120} width={width + 240} height={height + 240} fill="white" />
        <path d={cuts} stroke="black" strokeWidth="2" />
        <path d={notches} fill="black" />
        {Array.from({ length: 22 }, (_, i) => { const x = 28 + (i * 61) % (width - 70), y0 = height * .22 + (i * 37) % (height * .6); return <path key={i} d={`M${x} ${y0}l${12 + i % 17} -${6 + i % 9}`} stroke="black" strokeWidth={i % 3 === 0 ? 2.8 : .8} />; })}
      </mask></defs>
      <g fill="currentColor" mask={`url(#${id})`} transform={`rotate(-8 ${width / 2} ${height / 2})`} style={{ fontFamily: 'var(--f-head, sans-serif)', fontWeight: 900, fontStyle: 'italic' }}>
        {rows.map((l) => <text key={l.text} className={l.className} x={width / 2} y={l.base + 34} textAnchor="middle" fontSize={l.size} textLength={l.width} lengthAdjust="spacingAndGlyphs">{l.text}</text>)}
      </g>
    </svg>
  );
}
