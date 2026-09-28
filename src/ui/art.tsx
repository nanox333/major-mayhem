import React, { useState } from 'react';
import { Role, Roster, Player } from '../data/rosters';
import radars from '../data/radars.json';

const RADARS = radars as Record<string, string>;

/** Small line icons for each role (drawn for this game). */
export function RoleIcon({ role, size = 14 }: { role: Role; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (role) {
    case 'IGL': // headset with mic
      return <svg {...common}><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="13" width="4" height="6" rx="1.5" /><rect x="17" y="13" width="4" height="6" rx="1.5" /><path d="M19 19c0 2-2 3-5 3h-2" /></svg>;
    case 'AWP': // scope reticle
      return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>;
    case 'ENTRY': // breach arrow
      return <svg {...common}><path d="M4 12h12" /><path d="M11 6l6 6-6 6" /><path d="M20 4v16" /></svg>;
    case 'LURK': // eye
      return <svg {...common}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></svg>;
    case 'SUP': // shield
      return <svg {...common}><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>;
  }
}

/** Fallback team badge: monogram in the org's color. Uses a logo URL if one is cached and loads. */
export function TeamBadge({ roster, size = 40 }: { roster: Roster; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (roster.logo && !broken)
    return (
      <span className="badge-logo" style={{ width: size, height: size, padding: Math.round(size * 0.14), ['--team' as string]: roster.color }}>
        <img src={roster.logo} alt={roster.org} onError={() => setBroken(true)} />
      </span>
    );
  const fs = roster.tag.length > 3 ? 7.2 : roster.tag.length > 2 ? 8.6 : 10.5;
  return (
    <svg className="badge" width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={roster.org}>
      <defs>
        <linearGradient id={`bg-${roster.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12283a" />
          <stop offset="1" stopColor="#050e16" />
        </linearGradient>
      </defs>
      <path d="M20 2 L36 9 V22 C36 30 29 36 20 38 C11 36 4 30 4 22 V9 Z" fill={`url(#bg-${roster.id})`} stroke={roster.color} strokeWidth="1.6" />
      <path d="M20 6 L32 11.5 V22 C32 28 27 32.6 20 34.3" fill="none" stroke={roster.color} strokeOpacity=".25" strokeWidth="1" />
      <text x="20" y="24.5" textAnchor="middle" fontFamily="'Bebas Neue', Impact, sans-serif" fontSize={fs} letterSpacing=".4" fill={roster.color}>{roster.tag}</text>
    </svg>
  );
}

/** Player portrait with a clean silhouette fallback tinted by team color. */
export function Avatar({ player, roster, className }: { player: Player; roster: Roster; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (player.portrait && !broken)
    return <img className={`photo ${className ?? ''}`} src={player.portrait} alt={player.nick} loading="lazy" onError={() => setBroken(true)} />;
  const gid = `av-${roster.id}-${player.id}`;
  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" role="img" aria-label={player.nick}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={roster.color} stopOpacity=".55" />
          <stop offset="1" stopColor="#0a1a26" stopOpacity=".95" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="38" r="17" fill={`url(#${gid})`} />
      <path d="M26 36 a24 22 0 0 1 48 0" fill="none" stroke="#0b1620" strokeWidth="5" />
      <rect x="21" y="33" width="8" height="13" rx="3" fill="#0b1620" />
      <rect x="71" y="33" width="8" height="13" rx="3" fill="#0b1620" />
      <path d="M14 100 C16 72 32 60 50 60 C68 60 84 72 86 100 Z" fill={`url(#${gid})`} />
      <text x="50" y="88" textAnchor="middle" fontFamily="'Bebas Neue', Impact, sans-serif" fontSize="17" fill="#f1e5c8" fillOpacity=".85">{player.nick.slice(0, 2).toUpperCase()}</text>
    </svg>
  );
}

/** Map radar (images supplied by the player, built by scripts/build-radars.mjs). Coordinates on it are 0–100 of the square. */
export function MapArt({ map }: { map: string }) {
  return <img className="map-art" src={RADARS[map] ?? RADARS.Dust2} alt={`${map} radar`} draggable={false} />;
}

type Spot = { x: number; y: number; hint: string };
export interface MapPositions { T: Record<Role, Spot>; CT: Spot[] }

// Your team attacks as T from each role's usual starting spot; opponents hold CT positions.
export const POSITIONS: Record<string, MapPositions> = {
  Dust2: {
    T: { ENTRY: { x: 88, y: 42, hint: 'Long A' }, SUP: { x: 69, y: 60, hint: 'Long doors' }, AWP: { x: 47, y: 52, hint: 'Mid' }, IGL: { x: 50, y: 78, hint: 'Outside mid' }, LURK: { x: 18, y: 61, hint: 'Upper tunnels' } },
    CT: [{ x: 79, y: 17, hint: 'A site' }, { x: 20, y: 14, hint: 'B site' }, { x: 59, y: 21, hint: 'CT spawn' }, { x: 47, y: 34, hint: 'CT mid' }, { x: 32, y: 22, hint: 'B doors' }],
  },
  Mirage: {
    T: { ENTRY: { x: 66, y: 64, hint: 'A ramp' }, SUP: { x: 78, y: 76, hint: 'Palace' }, AWP: { x: 62, y: 42, hint: 'Top mid' }, IGL: { x: 86, y: 52, hint: 'T ramp' }, LURK: { x: 46, y: 12, hint: 'B apartments' } },
    CT: [{ x: 53, y: 77, hint: 'A site' }, { x: 18, y: 21, hint: 'B site' }, { x: 28, y: 69, hint: 'CT spawn' }, { x: 36, y: 47, hint: 'Window' }, { x: 42, y: 27, hint: 'Short' }],
  },
  Inferno: {
    T: { ENTRY: { x: 44, y: 48, hint: 'Banana' }, SUP: { x: 33, y: 62, hint: 'Lower banana' }, AWP: { x: 56, y: 66, hint: 'Mid' }, IGL: { x: 15, y: 72, hint: 'T spawn' }, LURK: { x: 44, y: 86, hint: 'Apartments' } },
    CT: [{ x: 46, y: 20, hint: 'B site' }, { x: 83, y: 70, hint: 'A site' }, { x: 90, y: 36, hint: 'CT spawn' }, { x: 73, y: 55, hint: 'Arch' }, { x: 89, y: 86, hint: 'Pit' }],
  },
  Nuke: {
    T: { ENTRY: { x: 44, y: 46, hint: 'Hut' }, SUP: { x: 38, y: 55, hint: 'Lobby' }, AWP: { x: 52, y: 70, hint: 'Outside' }, IGL: { x: 22, y: 53, hint: 'T side' }, LURK: { x: 75, y: 70, hint: 'Secret' } },
    CT: [{ x: 55, y: 49, hint: 'A site' }, { x: 55, y: 31, hint: 'Heaven' }, { x: 83, y: 45, hint: 'CT spawn' }, { x: 67, y: 48, hint: 'Mini' }, { x: 63, y: 62, hint: 'Garage' }],
  },
  Ancient: {
    T: { ENTRY: { x: 16, y: 45, hint: 'A main' }, SUP: { x: 30, y: 45, hint: 'Donut' }, AWP: { x: 49, y: 52, hint: 'Mid' }, IGL: { x: 49, y: 80, hint: 'T ramp' }, LURK: { x: 80, y: 68, hint: 'B ramp' } },
    CT: [{ x: 29, y: 23, hint: 'A site' }, { x: 79, y: 41, hint: 'B site' }, { x: 52, y: 11, hint: 'CT spawn' }, { x: 48, y: 30, hint: 'Top mid' }, { x: 70, y: 55, hint: 'Cave' }],
  },
};
/** Maps without a radar yet (Anubis, Train) show on Dust 2. */
export const boardMap = (map: string | null | undefined) => (map && RADARS[map] && POSITIONS[map] ? map : 'Dust2');
