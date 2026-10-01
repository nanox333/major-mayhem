import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// A class name used in a component but defined in no stylesheet renders as browser defaults: the "written out" look. This finds them.
// The few below are hooks on purpose (a wrapper other rules reach into, or a marker for tests); anything new has to be styled or named here.
const HOOKS = new Set(['chem', 'logo', 'roster-detail', 'review__pick', 'switch__word', 'home__daily', 'how__art--case', 'versus__side--t']);

const root = path.resolve(__dirname, '..');
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(root);

describe('every class a component uses is styled', () => {
  const css = files.filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const defined = new Set([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]));
  const used = new Map<string, string>();
  for (const f of files.filter((x) => /\.tsx$/.test(x))) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
      const s = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' ');
      // A trailing dash or an interpolation leaves half a name (is-, rar-): those are built at run time and checked by looking at the screens.
      for (const c of s.split(/\s+/)) if (/^[a-zA-Z_][\w]*(?:[-_]{1,2}[a-zA-Z0-9]+)*$/.test(c) && !used.has(c)) used.set(c, path.basename(f));
    }
  }
  it('has no component class without a rule', () => {
    const missing = [...used].filter(([c]) => !defined.has(c) && !HOOKS.has(c)).map(([c, f]) => `${c} (${f})`);
    expect(missing).toEqual([]);
  });
  it('finds the classes it is meant to check', () => {
    expect(used.size).toBeGreaterThan(300);
    expect(defined.has('draftbar')).toBe(true);
  });
});
