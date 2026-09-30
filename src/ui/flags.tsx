import React from 'react';
import { COUNTRY } from '../game/synergy';

// Flags for the countries in the data (#106, #125), drawn simply for this game on a 30 x 20 grid: inline SVG, so they work offline, cost no
// request, and draw on Windows (flag emoji don't). They are recognisable, not exact: the emblems are left out or reduced to a mark.
// A flag is never the only carrier of the country: its accessible name is the country, and the code is shown beside it.

const stripesH = (...c: string[]) => c.map((f, i) => <rect key={i} y={(20 / c.length) * i} width="30" height={20 / c.length + 0.05} fill={f} />);
const stripesV = (...c: string[]) => c.map((f, i) => <rect key={i} x={(30 / c.length) * i} width={30 / c.length + 0.05} height="20" fill={f} />);
const cross = (x: number, w: number, fill: string, key?: string) => <path key={key} d={`M${x} 0h${w}v20h-${w}zM0 ${10 - w / 2}h30v${w}H0z`} fill={fill} />;

/** The Union Jack, in its own box so it can be the flag of the UK or a canton. */
const UnionJack = ({ x = 0, y = 0, w = 30, h = 20 }: { x?: number; y?: number; w?: number; h?: number }) => (
  <svg x={x} y={y} width={w} height={h} viewBox="0 0 60 30" preserveAspectRatio="none">
    <rect width="60" height="30" fill="#012169" />
    <path d="M0 0L60 30M60 0L0 30" stroke="#fff" strokeWidth="6" />
    <path d="M0 0L60 30M60 0L0 30" stroke="#c8102e" strokeWidth="2" />
    <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
    <path d="M30 0v30M0 15h60" stroke="#c8102e" strokeWidth="6" />
  </svg>
);

const star = (cx: number, cy: number, r: number, fill: string) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2, rr = i % 2 ? r * 0.4 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
  return <polygon key={`${cx}-${cy}`} points={pts} fill={fill} />;
};

const SHAPES: Record<string, () => React.ReactNode> = {
  AU: () => <><rect width="30" height="20" fill="#00247d" /><UnionJack w={15} h={10} />{star(7.5, 15.5, 2.4, '#fff')}{star(22, 4, 1.3, '#fff')}{star(25.5, 9, 1.3, '#fff')}{star(21.5, 14, 1.3, '#fff')}{star(18, 8.5, 1.3, '#fff')}</>,
  BA: () => <><rect width="30" height="20" fill="#002395" /><path d="M8 0h14v20z" fill="#fecb00" />{[2.6, 6, 9.4, 12.8, 16.2].map((y, i) => <circle key={i} cx={9.6 + i * 2.6} cy={y} r="0.9" fill="#fff" />)}</>,
  BG: () => stripesH('#fff', '#00966e', '#d62612'),
  BR: () => <><rect width="30" height="20" fill="#009c3b" /><path d="M15 2.5L27 10 15 17.5 3 10z" fill="#ffdf00" /><circle cx="15" cy="10" r="4.2" fill="#002776" /><path d="M11 9.4c2.6-.6 5.6 0 8 1.8" stroke="#fff" strokeWidth=".9" fill="none" /></>,
  CA: () => <><rect width="30" height="20" fill="#fff" /><rect width="7.5" height="20" fill="#d52b1e" /><rect x="22.5" width="7.5" height="20" fill="#d52b1e" /><path d="M15 4l1.3 3.2 2.2-1.1-.8 3.8 2.3-.5-1.8 2.3 1.6.9-4.5 1.1v3.1h-.6v-3.1l-4.5-1.1 1.6-.9-1.8-2.3 2.3.5-.8-3.8 2.2 1.1z" fill="#d52b1e" /></>,
  CH: () => <><rect width="30" height="20" fill="#da291c" /><path d="M13 4h4v5h5v4h-5v5h-4v-5H8V9h5z" fill="#fff" /></>,
  DE: () => stripesH('#000', '#dd0000', '#ffce00'),
  DK: () => <><rect width="30" height="20" fill="#c8102e" />{cross(9, 3.2, '#fff')}</>,
  EE: () => stripesH('#0072ce', '#000', '#fff'),
  FI: () => <><rect width="30" height="20" fill="#fff" />{cross(8, 4, '#003580')}</>,
  FR: () => stripesV('#0055a4', '#fff', '#ef4135'),
  GB: () => <UnionJack />,
  GT: () => <>{stripesV('#4997d0', '#fff', '#4997d0')}<circle cx="15" cy="10" r="2.6" fill="none" stroke="#5a8f29" strokeWidth=".9" /></>,
  HU: () => stripesH('#ce2939', '#fff', '#477050'),
  IL: () => <><rect width="30" height="20" fill="#fff" /><rect y="2.4" width="30" height="2.6" fill="#0038b8" /><rect y="15" width="30" height="2.6" fill="#0038b8" /><path d="M15 6l3.2 5.5h-6.4zM15 14l-3.2-5.5h6.4z" fill="none" stroke="#0038b8" strokeWidth=".9" /></>,
  KZ: () => <><rect width="30" height="20" fill="#00afca" /><circle cx="15" cy="9" r="3.2" fill="#fec50c" /><path d="M8 15.5c4-1 10-1 14 0" stroke="#fec50c" strokeWidth="1.2" fill="none" /><path d="M1.5 0v20" stroke="#fec50c" strokeWidth="1.2" strokeDasharray="1.6 1.2" /></>,
  LT: () => stripesH('#fdb913', '#006a44', '#c1272d'),
  LV: () => <><rect width="30" height="20" fill="#9e3039" /><rect y="8" width="30" height="4" fill="#fff" /></>,
  ME: () => <><rect width="30" height="20" fill="#c40308" /><rect x=".9" y=".9" width="28.2" height="18.2" fill="none" stroke="#d4af37" strokeWidth="1.6" /><circle cx="15" cy="10" r="3.4" fill="#d4af37" /></>,
  MK: () => <><rect width="30" height="20" fill="#d20000" /><path d="M15 10L0 0M15 10L30 0M15 10L0 20M15 10L30 20M15 10V0M15 10V20M15 10H0M15 10H30" stroke="#ffe600" strokeWidth="1.7" /><circle cx="15" cy="10" r="3.2" fill="#ffe600" stroke="#d20000" strokeWidth=".8" /></>,
  MN: () => <>{stripesV('#c4272f', '#015197', '#c4272f')}<circle cx="5" cy="5.5" r="1.3" fill="#f9cf02" /><rect x="4.2" y="7.6" width="1.6" height="7" fill="#f9cf02" /></>,
  NO: () => <><rect width="30" height="20" fill="#ba0c2f" />{cross(7.5, 5, '#fff', 'w')}{cross(9, 2, '#00205b', 'b')}</>,
  PL: () => stripesH('#fff', '#dc143c'),
  PT: () => <><rect width="30" height="20" fill="#f00" /><rect width="12" height="20" fill="#060" /><circle cx="12" cy="10" r="3" fill="#ffe000" stroke="#fff" strokeWidth=".6" /></>,
  RO: () => stripesV('#002b7f', '#fcd116', '#ce1126'),
  RS: () => <>{stripesH('#c6363c', '#0c4076', '#fff')}<path d="M6 5h5v4.2c0 1.6-2.5 2.8-2.5 2.8S6 10.800 6 9.200z" fill="#c6363c" stroke="#edb92e" strokeWidth=".7" /></>,
  RU: () => stripesH('#fff', '#0039a6', '#d52b1e'),
  SE: () => <><rect width="30" height="20" fill="#006aa7" />{cross(9, 4, '#fecc00')}</>,
  SK: () => <>{stripesH('#fff', '#0b4ea2', '#ee1c25')}<path d="M6 4h6.400v6c0 2.200-3.200 3.800-3.200 3.800S6 12.200 6 10z" fill="#ee1c25" stroke="#fff" strokeWidth=".7" /><path d="M9.200 5.400v5M7.600 7h3.200M7.900 8.600h2.600" stroke="#fff" strokeWidth=".8" /></>,
  TR: () => <><rect width="30" height="20" fill="#e30a17" /><circle cx="11" cy="10" r="5" fill="#fff" /><circle cx="12.4" cy="10" r="4" fill="#e30a17" />{star(17.2, 10, 2, '#fff')}</>,
  UA: () => stripesH('#0057b7', '#ffd700'),
  US: () => (
    <>
      <rect width="30" height="20" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => <rect key={i} y={(20 / 13) * i} width="30" height={20 / 13} fill="#b22234" />)}
      <rect width="13" height={(20 / 13) * 7} fill="#3c3b6e" />
      {[2.4, 6.5, 10.6].flatMap((x) => [2.2, 5.2, 8.2].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r=".75" fill="#fff" />))}
    </>
  ),
  XK: () => <><rect width="30" height="20" fill="#244aa5" /><path d="M8 13l3-4.500 4 1 3.500-2.500 3.500 3.500-3.500 3-5.500-1z" fill="#d0a650" />{[9, 12, 15, 18, 21, 24].map((x, i) => <circle key={x} cx={x} cy={4.600 - Math.sin((i / 5) * Math.PI) * 1.500} r=".8" fill="#fff" />)}</>,
};

/** A flag at `size` px tall. Its name is the country; `label` overrides it when the country is written out beside it. */
export function Flag({ code, size = 18, decorative = false }: { code: string; size?: number; /** True when the country is written next to it, so a screen reader doesn't hear it twice. */ decorative?: boolean }) {
  const shape = SHAPES[code];
  const name = COUNTRY[code] ?? code;
  return (
    <svg className="flag" width={Math.round(size * 1.5)} height={size} viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : name} aria-hidden={decorative || undefined} focusable="false">
      {shape ? shape() : <><rect width="30" height="20" fill="#3a4866" /><text x="15" y="14" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">{code}</text></>}
    </svg>
  );
}

export const FLAG_CODES = Object.keys(SHAPES);
