import { describe, expect, it } from 'vitest';
import fs from 'fs';

// The palette lives in :root in styles.css (#100). This reads it from there and checks the pairs the game relies on against WCAG 2.1:
// 4.5:1 for text, 3:1 for outlines, focus rings and other things you have to see to use. A palette change that fails here fails the build.

const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const root = css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')));
const tokens: Record<string, string> = {};
for (const m of root.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) tokens[m[1]] = m[2];

const channel = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const tok = (name: string) => {
  const v = tokens[name];
  if (!v) throw new Error(`token --${name} is not a plain hex colour in :root`);
  return v;
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

describe('palette contrast (WCAG 2.1)', () => {
  it('reads the tokens from :root', () => {
    for (const n of ['bg', 'panel', 'panel-2', 'inset', 'text', 'accent', 'on-accent']) expect(tokens[n], n).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it.each(cases)('%s on %s is at least %s:1 (%s)', (fg, bg, min) => {
    expect(ratio(tok(fg), tok(bg))).toBeGreaterThanOrEqual(min);
  });
  it('a focus ring in the accent is visible on every surface (3:1)', () => {
    for (const s of SURFACES) expect(ratio(tok('accent'), tok(s)), s).toBeGreaterThanOrEqual(3);
  });
});
