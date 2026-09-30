import { describe, expect, it } from 'vitest';
import fs from 'fs';

// The palette lives in :root in styles.css (#100). This reads it from there and checks the pairs the game relies on against WCAG 2.1:
// 4.5:1 for text, 3:1 for outlines, focus rings and other things you have to see to use. A palette change that fails here fails the build.

const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
/** The hex colours a rule block defines, by token name. `selector` is matched up to its opening brace. */
const block = (selector: string): Record<string, string> => {
  const i = css.indexOf(`${selector} {`);
  if (i < 0) throw new Error(`no ${selector} block in styles.css`);
  const body = css.slice(i, css.indexOf('\n}', i));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
};
const dark = block(':root');
const highDark = block(':root[data-contrast="high"]');
const light = block(':root[data-theme="light"]');
const highLight = block(':root[data-theme="light"][data-contrast="high"]');
// Each palette the game can draw, as the cascade builds it: the base, then the contrast mode over it.
const PALETTES: Record<string, Record<string, string>> = {
  'dark': dark,
  'dark, high contrast': { ...dark, ...highDark },
  'light': { ...dark, ...light },
  'light, high contrast': { ...dark, ...light, ...highDark, ...highLight },
};

const channel = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const SURFACES = ['bg', 'panel', 'panel-2', 'inset'];
const cases: [fg: string, bg: string, min: number, what: string][] = [
  ...SURFACES.flatMap((s): [string, string, number, string][] => [
    ['text', s, 4.5, 'body text'], ['strong', s, 4.5, 'bright text'], ['text-2', s, 4.5, 'secondary text'], ['muted', s, 4.5, 'muted text'],
    ['accent', s, 4.5, 'accent used as text'], ['accent-hi', s, 4.5, 'accent hover as text'],
    ['ct', s, 4.5, 'CT blue as text'], ['go-text', s, 4.5, 'win text'], ['loss-text', s, 4.5, 'loss text'], ['twitch', s, 4.5, 'Twitch text'],
    ['control', s, 3, 'input outline'],
  ]),
  ['on-accent', 'accent', 4.5, 'text on the accent button'], ['on-accent', 'accent-hi', 4.5, 'text on the hovered accent button'],
  ['on-go', 'go', 4.5, 'text on the green button'],
];

describe.each(Object.entries(PALETTES))('palette contrast (WCAG 2.1), %s', (name, tokens) => {
  const tok = (n: string) => {
    const v = tokens[n];
    if (!v) throw new Error(`token --${n} is not a plain hex colour in the ${name} palette`);
    return v;
  };
  it('defines the tokens', () => {
    for (const n of ['bg', 'panel', 'panel-2', 'inset', 'text', 'accent', 'on-accent']) expect(tokens[n], n).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it.each(cases)('%s on %s is at least %s:1 (%s)', (fg, bg, min) => {
    expect(ratio(tok(fg), tok(bg))).toBeGreaterThanOrEqual(min);
  });
  it('a focus ring in the accent is visible on every surface (3:1)', () => {
    for (const s of SURFACES) expect(ratio(tok('accent'), tok(s)), s).toBeGreaterThanOrEqual(3);
  });
});

// The home hero (#119) is a night scene in every palette (its own dark tokens), so this always uses the dark one. Text sits over art: the worst case
// is the brightest part of the art (a light shaft in the hover accent at its strongest, over the glow) under the lightest part of the scrim
// (62% of the page colour on desktop, 58% on a phone).
describe('the hero', () => {
  const tok = (n: string) => dark[n];
  it('text stays readable over the brightest art (4.5:1)', () => {
    const mix = (a: string, b: string, t: number) => {
      const [x, y] = [parseInt(a.slice(1), 16), parseInt(b.slice(1), 16)];
      const ch = (s: number) => Math.round(((x >> s) & 255) * t + ((y >> s) & 255) * (1 - t));
      return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('');
    };
    const art = mix(tok('accent-hi'), tok('inset'), 0.5);
    for (const scrim of [0.58, 0.62]) {
      const under = mix(tok('bg'), art, scrim);
      for (const fg of ['text', 'strong', 'accent']) expect(ratio(tok(fg), under), `${fg} under a ${scrim} scrim`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
