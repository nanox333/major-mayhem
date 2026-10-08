#!/usr/bin/env node
// Finds player-facing English that is still written straight into the source (#275). It is a heuristic: it looks for text
// between JSX tags and for quoted phrases that start with a capital and contain a space, then reports where they are.
//
// Files in MIGRATED must have none, so text cannot creep back in once a screen is done. Every other file is listed as
// work left to do. Run with `npm run i18n:check`. It exits 1 only if a migrated file has hard-coded text.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'src');
// Screens and components whose text has moved into the catalogue. Add a file here once its last English string is gone.
const MIGRATED = new Set([
  'ui/TopBar.tsx',
  'ui/Settings.tsx',
  'ui/adSlot.tsx',
  'screens/Contact.tsx',
  'screens/PrivacyNotes.tsx',
  'screens/Challenge.tsx',
]);
// Not part of the player-facing text: the catalogue itself, tests, and the debug menu (excluded in #275).
const SKIP = (rel) => /\.test\.tsx?$/.test(rel) || rel.startsWith('i18n/') || rel.startsWith('ui/debug/') || rel === 'ui/DebugMenu.tsx' || rel.startsWith('assets/');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

// Text between tags: >Some words<  (no braces, so {t('…')} expressions are not counted).
const JSX_TEXT = />([^<>{}\n]*[A-Za-z]{3,}[^<>{}\n]*)</g;
// A quoted phrase with a capital and a space: "Guess the pro", 'Sound on'. Code strings (class names, paths) are lowercase or have no space.
const PHRASE = /(['"])([A-Z][^'"\n]*\s[^'"\n]*)\1/g;
const CODE_HINT = /[=(){};\\]|^https?:|\.(svg|png|mp3|glb|json)$/;
// SVG path data ("M20 2 L36 9 …") is geometry, not words.
const PATH_DATA = /^[MLHVCSQTAZmlhvcsqtaz0-9 .,+-]+$/;
// Brand and product names are the same in every language, so they stay as they are.
const BRANDS = new Set(['Major', 'Mayhem', 'Major Mayhem', 'Cloudflare Web Analytics', 'Plausible', 'Umami', 'Sentry', 'Valve', 'Twitch', 'Counter-Strike', 'Wikipedia', 'Liquipedia', 'Kenney', 'bo3.gg', 'Wikimedia Commons']);

const findings = [];
for (const file of walk(ROOT).filter((f) => /\.tsx?$/.test(f))) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (SKIP(rel)) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comments are not player-facing
    for (const m of line.matchAll(JSX_TEXT)) {
      const text = m[1].trim();
      if (text && !CODE_HINT.test(text) && !BRANDS.has(text)) findings.push({ rel, line: i + 1, text });
    }
    for (const m of line.matchAll(PHRASE)) {
      const text = m[2].trim();
      if (!CODE_HINT.test(text) && !PATH_DATA.test(text) && !BRANDS.has(text) && !/^\s*import\b/.test(line)) findings.push({ rel, line: i + 1, text });
    }
  });
}

const byFile = new Map();
for (const f of findings) byFile.set(f.rel, [...(byFile.get(f.rel) ?? []), f]);

const strict = [...byFile.entries()].filter(([rel]) => MIGRATED.has(rel));
const left = [...byFile.entries()].filter(([rel]) => !MIGRATED.has(rel)).sort((a, b) => b[1].length - a[1].length);

console.log(`Migrated screens (must be clean): ${MIGRATED.size}`);
if (strict.length === 0) console.log('  all clean');
for (const [rel, hits] of strict) {
  console.log(`  ${rel}: ${hits.length} hard-coded`);
  for (const h of hits.slice(0, 5)) console.log(`    ${rel}:${h.line}  ${h.text}`);
}
console.log(`\nStill to move (${left.reduce((n, [, h]) => n + h.length, 0)} possible strings in ${left.length} files):`);
for (const [rel, hits] of left) console.log(`  ${String(hits.length).padStart(4)}  ${rel}`);

if (strict.length) {
  console.error('\nA migrated file has hard-coded text. Move it into src/i18n/en.ts and use t().');
  process.exit(1);
}
