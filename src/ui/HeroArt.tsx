import React from 'react';

// The home screen's arena (#119): stage lights, light shafts, a crowd and a trophy, drawn for this game as one inline SVG.
// It is original art: no characters, no weapons, no Counter-Strike or Valve mark, no in-game screenshot. Decoration only (aria-hidden).
// The accent is the T colour and the cool blue the CT colour, the same two the match uses.

/** A row of crowd silhouettes: a head and a pair of shoulders each, at slightly different heights so it reads as people. */
function Crowd({ y, size, fill, gap }: { y: number; size: number; fill: string; gap: number }) {
  const n = Math.ceil(1240 / gap);
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
    <svg className="hero__art" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="ha-glow" cx="50%" cy="8%" r="75%">
          <stop offset="0" stopColor="var(--accent)" stopOpacity=".34" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ha-cool-l" cx="0%" cy="60%" r="55%">
          <stop offset="0" stopColor="var(--ct)" stopOpacity=".32" />
          <stop offset="1" stopColor="var(--ct)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ha-cool-r" cx="100%" cy="60%" r="55%">
          <stop offset="0" stopColor="var(--ct)" stopOpacity=".32" />
          <stop offset="1" stopColor="var(--ct)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ha-shaft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent-hi)" stopOpacity=".5" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1200" height="420" fill="var(--inset)" />
      <rect width="1200" height="420" fill="url(#ha-glow)" />
      <rect width="1200" height="420" fill="url(#ha-cool-l)" />
      <rect width="1200" height="420" fill="url(#ha-cool-r)" />

      {/* Light shafts from the rig: the middle three sweep slowly. */}
      <g className="hero__sweep" fill="url(#ha-shaft)">
        <path d="M150 14 L190 14 L470 400 L60 400z" opacity=".55" />
        <path d="M430 14 L470 14 L640 400 L330 400z" opacity=".7" />
        <path d="M730 14 L770 14 L870 400 L560 400z" opacity=".7" />
        <path d="M1010 14 L1050 14 L1150 400 L740 400z" opacity=".55" />
      </g>
      {/* The rig: a bar of stage lights. */}
      <rect x="90" y="8" width="1020" height="6" rx="3" fill="var(--panel-2)" />
      {[170, 450, 750, 1030].map((x) => <circle key={x} cx={x} cy="11" r="9" fill="var(--accent-hi)" />)}

      {/* Far crowd, the stage with its trophy, near crowd. */}
      <Crowd y={290} size={12} fill="var(--crowd-far)" gap={30} />
      <path d="M330 372 H870 L840 336 H360z" fill="var(--panel-2)" />
      <rect x="360" y="332" width="480" height="5" fill="var(--accent)" />
      <g fill="none" stroke="var(--accent-hi)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M562 226 H638 V262 C638 290 622 304 600 308 C578 304 562 290 562 262 Z" fill="var(--accent)" />
        <path d="M562 238 H538 C538 268 552 280 568 282 M638 238 H662 C662 268 648 280 632 282" />
        <path d="M600 308 V332 M572 332 H628" />
      </g>
      <ellipse cx="600" cy="352" rx="150" ry="10" fill="var(--accent)" opacity=".18" />
      <Crowd y={330} size={17} fill="var(--crowd-near)" gap={44} />
      <rect y="396" width="1200" height="24" fill="var(--crowd-near)" />
    </svg>
  );
}
