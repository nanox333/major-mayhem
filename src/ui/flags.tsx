import React from 'react';
import { COUNTRY } from '../game/synergy';

// Country flags (#106), simplified and drawn for this game as inline SVG on a 30x20 grid: the stripes, crosses and main symbols, not the
// fine detail of a coat of arms. A flag never stands alone: it sits beside the two-letter code and the full name is its accessible name.
// The colours are the flags' own, so they are literals here and not palette tokens.

const W = '#ffffff', R = '#d72b2b', B = '#1b3f94', K = '#111111';
const stripesH = (...c: string[]) => c.map((f, i) => <rect key={i} y={(20 / c.length) * i} width="30" height={20 / c.length + 0.05} fill={f} />);
const stripesV = (...c: string[]) => c.map((f, i) => <rect key={i} x={(30 / c.length) * i} width={30 / c.length + 0.05} height="20" fill={f} />);
/** A Nordic cross: a field, a cross with an optional border. */
const nordic = (field: string, cross: string, edge?: string) => (
  <>
    <rect width="30" height="20" fill={field} />
    {edge && <><rect x="8" width="6" height="20" fill={edge} /><rect y="7" width="30" height="6" fill={edge} /></>}
    <rect x={edge ? 9 : 8} width={edge ? 4 : 6} height="20" fill={cross} /><rect y={edge ? 8 : 7} width="30" height={edge ? 4 : 6} fill={cross} />
  </>
);
const star = (cx: number, cy: number, r: number, fill: string) => {
  const pts = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.42 : r; return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`; }).join(' ');
  return <polygon points={pts} fill={fill} />;
};
const unionJack = (w: number, h: number) => (
  <g>
    <rect width={w} height={h} fill="#1b2f7a" />
    <path d={`M0 0 L${w} ${h} M${w} 0 L0 ${h}`} stroke={W} strokeWidth={h * 0.2} />
    <path d={`M0 0 L${w} ${h} M${w} 0 L0 ${h}`} stroke={R} strokeWidth={h * 0.08} />
    <path d={`M${w / 2} 0 V${h} M0 ${h / 2} H${w}`} stroke={W} strokeWidth={h * 0.32} />
    <path d={`M${w / 2} 0 V${h} M0 ${h / 2} H${w}`} stroke={R} strokeWidth={h * 0.18} />
  </g>
);

const DRAW: Record<string, React.ReactNode> = {
  AU: <><rect width="30" height="20" fill="#1b2f7a" />{unionJack(15, 10)}{star(7.5, 15, 2.6, W)}{star(22, 15, 1.6, W)}{star(25, 8, 1.6, W)}{star(19, 6, 1.6, W)}{star(22, 3, 1.6, W)}</>,
  BA: <><rect width="30" height="20" fill="#1f3f9a" /><polygon points="8,0 24,0 24,20" fill="#f2c500" />{[3, 7, 11, 15].map((y, i) => <circle key={i} cx={7 + i * 3.4} cy={y - 1 + i * 0.6} r="1" fill={W} />)}</>,
  BG: stripesH(W, '#2a8a4b', R),
  BR: <><rect width="30" height="20" fill="#2a9a4b" /><polygon points="15,2.5 27,10 15,17.5 3,10" fill="#f6d000" /><circle cx="15" cy="10" r="4.4" fill="#1b3f94" /></>,
  CA: <><rect width="30" height="20" fill={W} /><rect width="7.5" height="20" fill={R} /><rect x="22.5" width="7.5" height="20" fill={R} /><path d="M15 3.5l1.6 3 2.2-.9-.6 4 2.2-1.6.4 2.3 1.9-.2-2.2 4.6-3.7-.7v3.6h-1.6v-3.6l-3.7.7-2.2-4.6 1.9.2.4-2.3 2.2 1.6-.6-4 2.2.9z" fill={R} /></>,
  CH: <><rect width="30" height="20" fill={R} /><rect x="13" y="4" width="4" height="12" fill={W} /><rect x="9" y="8" width="12" height="4" fill={W} /></>,
  DE: stripesH(K, R, '#f4c400'),
  DK: nordic(R, W),
  EE: stripesH('#3a87d4', K, W),
  FI: nordic(W, '#1b3f94'),
  FR: stripesV('#1b3f94', W, R),
  GB: unionJack(30, 20),
  GT: <>{stripesV('#6cb4e4', W, '#6cb4e4')}<circle cx="15" cy="10" r="3" fill="none" stroke="#3a8a4b" strokeWidth="1.2" /></>,
  HU: stripesH(R, W, '#3a8a4b'),
  IL: <><rect width="30" height="20" fill={W} /><rect y="2" width="30" height="2.6" fill="#1b3f94" /><rect y="15.4" width="30" height="2.6" fill="#1b3f94" /><g fill="none" stroke="#1b3f94" strokeWidth="1.1"><polygon points="15,6.2 19.2,13.4 10.8,13.4" /><polygon points="15,13.8 10.8,6.6 19.2,6.6" /></g></>,
  KZ: <><rect width="30" height="20" fill="#3fb4d8" /><circle cx="15" cy="8.6" r="3.4" fill="#f6d000" /><path d="M9 14.5h12" stroke="#f6d000" strokeWidth="1.4" /><rect x="2" y="2" width="1.4" height="16" fill="#f6d000" /></>,
  LT: stripesH('#f4c400', '#2a8a4b', R),
  LV: <><rect width="30" height="20" fill="#9b2335" /><rect y="8" width="30" height="4" fill={W} /></>,
  ME: <><rect width="30" height="20" fill="#f0c24a" /><rect x="1.4" y="1.4" width="27.2" height="17.2" fill="#c8102e" /><circle cx="15" cy="10" r="4" fill="#f0c24a" /></>,
  MK: <><rect width="30" height="20" fill="#d8272d" />{Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <polygon key={i} points={`15,10 ${(15 + 24 * Math.cos(a - 0.09)).toFixed(1)},${(10 + 24 * Math.sin(a - 0.09)).toFixed(1)} ${(15 + 24 * Math.cos(a + 0.09)).toFixed(1)},${(10 + 24 * Math.sin(a + 0.09)).toFixed(1)}`} fill="#f4c400" />; })}<circle cx="15" cy="10" r="3.4" fill="#f4c400" stroke="#d8272d" strokeWidth="1" /></>,
  MN: <>{stripesV(R, '#1b74b8', R)}<path d="M5 5h1.6v2.4H5zM3.8 8.4h4v1H3.8zM4.6 10.4h2.4v4H4.6z" fill="#f4c400" /></>,
  NO: nordic(R, '#1b3f94', W),
  PL: stripesH(W, '#dc143c'),
  PT: <><rect width="30" height="20" fill="#c8102e" /><rect width="12" height="20" fill="#1f7a3a" /><circle cx="12" cy="10" r="3.6" fill="#f4c400" /><circle cx="12" cy="10" r="1.8" fill="#c8102e" /></>,
  RO: stripesV('#1b3f94', '#f4c400', R),
  RS: <>{stripesH(R, '#1b3f94', W)}<rect x="5" y="5" width="6" height="8" rx="1.5" fill={R} stroke="#f4c400" strokeWidth="0.8" /></>,
  RU: stripesH(W, '#1b3f94', '#d52b1e'),
  SE: nordic('#1b6fb8', '#f4c400'),
  SK: <>{stripesH(W, '#1b3f94', R)}<path d="M6 4h8v6.5c0 2.2-2 3.4-4 4.2-2-.8-4-2-4-4.2z" fill={R} stroke={W} strokeWidth="0.8" /><path d="M10 5.6v7M7.8 7.6h4.4" stroke={W} strokeWidth="1.2" /></>,
  TR: <><rect width="30" height="20" fill="#e30a17" /><circle cx="11.2" cy="10" r="5" fill={W} /><circle cx="12.6" cy="10" r="4" fill="#e30a17" />{star(17, 10, 2.2, W)}</>,
  UA: stripesH('#1b6fd1', '#f4d000'),
  US: <><rect width="30" height="20" fill={W} />{[0, 2, 4, 6, 8, 10, 12].map((i) => <rect key={i} y={(20 / 13) * i} width="30" height={20 / 13} fill="#c8102e" />)}<rect width="13" height={(20 / 13) * 7} fill="#1b2f7a" />{[[3, 2], [7, 2], [11, 2], [5, 4.6], [9, 4.6], [3, 7.2], [7, 7.2], [11, 7.2]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.7" fill={W} />)}</>,
  XK: <><rect width="30" height="20" fill="#244aa5" /><path d="M9 12.2c1.6-2.6 4-2.2 5.4-3.8 1.2-1.3 4.2-.6 5.4.4 1.4 1.2 1.6 2.6.4 3.6-1.4 1.2-4 .8-5.4 1.6-2.2 1.2-4.4.4-5.8-1.8z" fill="#d0a650" />{[7.4, 10.4, 13.4, 16.6, 19.6, 22.6].map((x, i) => <circle key={i} cx={x} cy={4.6 - Math.abs(i - 2.5) * 0.55} r="0.9" fill={W} />)}</>,
};

/**
 * A country's flag at a given height (3:2). It is decoration beside the country code (`aria-hidden`), or a labelled image when `label` is set.
 * A code we have no flag for gets a neutral box, so a new country never breaks a screen.
 */
export function Flag({ code, height = 14, label = false }: { code: string; height?: number; label?: boolean }) {
  const name = COUNTRY[code] ?? code;
  return (
    <svg className="flag" width={Math.round(height * 1.5)} height={height} viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" role={label ? 'img' : undefined} aria-label={label ? name : undefined} aria-hidden={label ? undefined : true} focusable="false">
      <title>{name}</title>
      {DRAW[code] ?? <rect width="30" height="20" fill="#4a5470" />}
    </svg>
  );
}

/** The country codes there is a drawn flag for (a test checks every country in the data is on it). */
export const FLAG_CODES = Object.keys(DRAW);
