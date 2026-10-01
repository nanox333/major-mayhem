import React from 'react';
import { Crowd } from './HeroArt';

// The draft's arena (#225): a dark hall with a rig of warm lights and a few shafts across the top of the view, and a crowd along the bottom of the window.
// Original art, as the home's arena is: no people, weapons or marks, only light and silhouettes. Decoration only; nothing here is read or clicked.
// It is static. The reading zones (header, cards, decision) sit on near-solid surfaces over it; see draft-scene.css for how it fades out.

// Right-weighted, like a stage rig seen from the floor: the left, where the title sits, stays dark and quiet.
const LIGHTS = Array.from({ length: 16 }, (_, i) => ({ x: 560 + i * 64 + ((i * 31) % 17), y: 96 + ((i * 47) % 37), r: 2.5 + ((i * 7) % 4) * 1.1 }));

export function DraftScene() {
  return (
    <>
      <div className="draft-scene draft-scene--rig" aria-hidden="true">
        <svg viewBox="0 0 1600 640" preserveAspectRatio="xMidYMin slice" focusable="false">
          <defs>
            <linearGradient id="ds-shaft" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--accent-hi)" stopOpacity=".5" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="ds-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="var(--accent-hi)" stopOpacity=".9" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="ds-hot" cx="50%" cy="0%" r="70%">
              <stop offset="0" stopColor="var(--accent)" stopOpacity=".4" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="1180" cy="80" rx="560" ry="300" fill="url(#ds-hot)" />
          {/* Shafts from the rig, steep and soft, so they read as haze in a lit hall and not as beams. */}
          <g fill="url(#ds-shaft)">
            <path d="M700 70 L740 70 L880 560 L560 560z" opacity=".3" />
            <path d="M1000 70 L1040 70 L1250 600 L860 600z" opacity=".36" />
            <path d="M1330 70 L1370 70 L1560 560 L1240 560z" opacity=".42" />
          </g>
          {/* The rig: a bar of lamps, each with a small bloom. */}
          <rect x="520" y="86" width="1040" height="4" fill="#2a2d2b" />
          {LIGHTS.map((l) => (
            <g key={l.x}>
              <circle cx={l.x} cy={l.y} r={l.r * 5} fill="url(#ds-glow)" opacity=".3" />
              <circle cx={l.x} cy={l.y} r={l.r} fill="var(--accent-hi)" />
            </g>
          ))}
        </svg>
      </div>
      <div className="draft-scene draft-scene--floor" aria-hidden="true">
        <svg viewBox="0 0 1600 260" preserveAspectRatio="xMidYMax slice" focusable="false">
          <Crowd y={60} size={13} fill="#17100c" gap={34} width={1640} />
          <Crowd y={110} size={17} fill="#0f0b08" gap={44} width={1640} />
          <Crowd y={170} size={22} fill="#080605" gap={58} width={1640} />
        </svg>
      </div>
    </>
  );
}
