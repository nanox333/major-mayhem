import React from 'react';

// The home screen's arena (#119): stage lights, light shafts, a crowd and a trophy, drawn for this game as one inline SVG.
// It is original art: no characters, no weapons, no Counter-Strike or Valve mark, no in-game screenshot. Decoration only (aria-hidden).
// The accent is the T colour and the cool blue the CT colour, the same two the match uses.

/** A row of crowd silhouettes: a head and a pair of shoulders each, at slightly different heights so it reads as people. */
export function Crowd({ y, size, fill, gap, width = 1240 }: { y: number; size: number; fill: string; gap: number; width?: number }) {
  const n = Math.ceil(width / gap);
  return (
    <g fill={fill}>
      {Array.from({ length: n }, (_, i) => {
        const x = i * gap - 20 + ((i * 37) % 11);
        const dy = ((i * 53) % 7) * 2;
        return (
          <g key={i} transform={`translate(${x} ${y + dy})`}>
            <circle cx={size} cy={size * 0.8} r={size * 0.62} />
            <path d={`M0 ${size * 3} c0 ${-size * 1.5} ${size * 0.5} ${-size * 1.9} ${size} ${-size * 1.9} s${size} ${size * 0.4} ${size} ${size * 1.9}z`} transform={`translate(0 ${size * 0.6})`} />
          </g>
        );
      })}
    </g>
  );
}

export function HeroArt() {
  return (
    <svg className="hero__art" viewBox="0 0 1200 420" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="ha-spot" cx="73%" cy="62%" r="34%">
          <stop offset="0" stopColor="var(--accent-hi)" stopOpacity=".42" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ha-cool-l" cx="0%" cy="60%" r="55%">
          <stop offset="0" stopColor="var(--ct)" stopOpacity=".26" />
          <stop offset="1" stopColor="var(--ct)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ha-shaft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent-hi)" stopOpacity=".55" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity=".04" />
        </linearGradient>
      </defs>
      <rect width="1200" height="420" fill="var(--inset)" />
      <rect width="1200" height="420" fill="url(#ha-cool-l)" />
      <rect width="1200" height="420" fill="url(#ha-spot)" />

      {/* Light shafts: three converge on the trophy, and the rest sweep faintly behind the words. */}
      <g className="hero__sweep" fill="url(#ha-shaft)">
        <path d="M150 14 L190 14 L420 400 L60 400z" opacity=".28" />
        <path d="M430 14 L470 14 L640 400 L330 400z" opacity=".3" />
        <path d="M700 14 L740 14 L940 336 L820 336z" opacity=".9" />
        <path d="M860 14 L900 14 L960 336 L800 336z" opacity=".55" />
        <path d="M1020 14 L1060 14 L940 336 L820 336z" opacity=".9" />
      </g>
      {/* The rig: a bar of stage lights, with a bright one over the trophy. */}
      <rect x="90" y="8" width="1020" height="6" rx="3" fill="var(--panel-2)" />
      {[170, 450].map((x) => <circle key={x} cx={x} cy="11" r="8" fill="var(--muted-2)" />)}
      {[720, 880, 1040].map((x) => <circle key={x} cx={x} cy="11" r="10" fill="var(--accent-hi)" />)}

      {/* Three rows of crowd, each darker and lower than the one behind, then the stage and the trophy on it. */}
      <Crowd y={286} size={11} fill="var(--crowd-far)" gap={28} />
      <Crowd y={306} size={14} fill="var(--crowd-mid)" gap={38} />
      <path d="M690 376 H1070 L1044 334 H716z" fill="var(--panel-2)" />
      <ellipse cx="880" cy="336" rx="190" ry="12" fill="var(--accent)" opacity=".28" />
      <g transform="translate(880 334) scale(1.6) translate(-600 -332)">
        <g fill="none" stroke="var(--accent-hi)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M562 226 H638 V262 C638 290 622 304 600 308 C578 304 562 290 562 262 Z" fill="var(--accent)" />
          <path d="M562 238 H538 C538 268 552 280 568 282 M638 238 H662 C662 268 648 280 632 282" />
          <path d="M600 308 V332 M572 332 H628" />
        </g>
      </g>
      <Crowd y={342} size={18} fill="var(--crowd-near)" gap={46} />
      <rect y="400" width="1200" height="20" fill="var(--crowd-near)" />
    </svg>
  );
}
