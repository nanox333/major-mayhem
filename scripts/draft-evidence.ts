// The evidence for the draft art pass (#225): every state the acceptance list names, captured from the built game (npm run build first).
// usage: npx tsx scripts/draft-evidence.ts [outdir]      default docs/design/draft-evidence      env: CHROMIUM_PATH=<browser exe>
// Each run is made by the game's own reducer from a fixed seed, so the same three rosters appear on every run and two builds compare like for like.
// It also prints the decision panel's bottom edge in each desktop state (it must stay inside the window) and the size of dist/index.html.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { chromium, Page } from 'playwright';
import { preview } from 'vite';
import type { Player } from '../src/data/rosters';
import * as G from '../src/game/logic';
import { fresh, reducer, Run, roundOf, KEY } from '../src/game/state';
import { TIP_IDS } from '../src/ui/tips';

const out = process.argv[2] ?? 'docs/design/draft-evidence';
fs.mkdirSync(out, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 4175, strictPort: true } });
server.httpServer.unref();
const base = 'http://127.0.0.1:4175';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

/** Plays the first `rounds` draft rounds with the first eligible player of the first roster that has one, then leaves the next case sealed. */
function draftTo(start: Run, rounds: number) {
  let s = start;
  for (let i = 0; i < rounds; i++) {
    s = reducer(s, { type: 'spin' });
    if (roundOf(s) === 'coach') { s = reducer(s, { type: 'coach', rosterId: s.offer[0] }); continue; }
    const bench = roundOf(s) === 'bench';
    const can = (p: Player) => (bench ? !G.draftedIds(s.picks).has(p.id) : G.eligibleSlots(p, s.picks).length > 0 || (!!s.opts?.hard && !G.draftedIds(s.picks).has(p.id)));
    const r = s.offer.map((id) => G.rosterById.get(id)!).find((x) => x.players.some(can))!;
    const p = r.players.find(can)!;
    s = reducer(s, { type: 'team', id: r.id });
    const slot = bench ? null : s.opts?.hard ? G.openSlots(s.picks)[0] : G.eligibleSlots(p, s.picks)[0];
    s = reducer(s, bench ? { type: 'bench', player: p } : { type: 'draft', player: p, slot: slot as never });
  }
  return s;
}
const SEED = 'draft-evidence';
const normal = { ...fresh('free'), seed: SEED };
const hard = { ...fresh('free', undefined, { hard: true }), seed: SEED };

async function open(p: Page, run: Run, prefs: Record<string, unknown> = {}) {
  await p.goto(base);
  await p.evaluate(({ key, run, prefs, tips }) => { localStorage.clear(); localStorage.setItem(key, JSON.stringify(run)); localStorage.setItem('mm-prefs', JSON.stringify(prefs)); localStorage.setItem('mm-tips', JSON.stringify(tips)); }, { key: KEY, run, prefs, tips: TIP_IDS });
  await p.reload();
  const resume = p.getByRole('button', { name: /^(Continue|View your)/ });
  if (run.offerKey > 0 && await resume.count()) await resume.first().click();
}
/** Starts today's daily and opens its first case, so the reel can be captured as it rolls. The clock is pinned so the three rosters never change. */
async function startDaily(p: Page) {
  await p.addInitScript(() => { const R = Date; const off = new R('2026-10-01T10:00:00').getTime() - R.now(); class D extends R { constructor(...a: unknown[]) { if (a.length) super(...(a as [string])); else super(R.now() + off); } static now() { return R.now() + off; } } globalThis.Date = D as DateConstructor; });
  await p.goto(base);
  await p.evaluate((tips) => { localStorage.clear(); localStorage.setItem('mm-tips', JSON.stringify(tips)); }, TIP_IDS);
  await p.reload();
  await p.locator('button.home__daily').click();
  await p.getByRole('button', { name: 'Open case', exact: true }).click();
}
/** Like startDaily, but stops with the sealed case showing, so a measurement can begin just before Open case. */
async function startDailyUntilSealed(p: Page) {
  await p.addInitScript(() => { const R = Date; const off = new R('2026-10-01T10:00:00').getTime() - R.now(); class D extends R { constructor(...a: unknown[]) { if (a.length) super(...(a as [string])); else super(R.now() + off); } static now() { return R.now() + off; } } globalThis.Date = D as DateConstructor; });
  await p.goto(base);
  await p.evaluate((tips) => { localStorage.clear(); localStorage.setItem('mm-tips', JSON.stringify(tips)); }, TIP_IDS);
  await p.reload();
  await p.locator('button.home__daily').click();
  await p.getByRole('button', { name: 'Open case', exact: true }).waitFor();
}
const decisionBottom = (p: Page) => p.evaluate(() => { const e = document.querySelector('.draftbar, .peekbar'); return e ? Math.round(e.getBoundingClientRect().bottom + scrollY) : null; });
async function settle(p: Page) { await p.waitForSelector('.case-card:not(.case-card--preview) .prow, .case-item--coach', { timeout: 15000 }); await p.waitForTimeout(1500); await p.mouse.move(2, 2); }
async function shot(p: Page, name: string, full = false) { await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(150); await p.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 72, fullPage: full }); }
async function pickRow(p: Page, which: 'first' | 'second-role') {
  const card = p.locator('.case-card:not(.case-card--preview)').first();
  const rows = card.locator('button.prow');
  if (which === 'second-role') {
    for (const c of await p.locator('.case-card:not(.case-card--preview)').all()) {
      const r = c.locator('button.prow', { has: p.locator('.prow__role.is-second') });
      if (await r.count()) { await r.first().click(); return true; }
    }
    return false;
  }
  await rows.first().click();
  return true;
}
const report: string[] = [];

try {
  // 1. desktop 1440x900: the reel, the settled draft, a selected player, hover; then the dark-only states
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
    const p = await ctx.newPage();
    await startDaily(p);
    await p.waitForTimeout(1300); await shot(p, '01-reel-rolling');
    await p.waitForTimeout(1500); await shot(p, '02-reel-landing');
    await settle(p); await shot(p, '03-settled');
    await pickRow(p, 'first'); await p.mouse.move(2, 2); await p.waitForTimeout(400);
    report.push(`desktop round 1 selected: decision panel bottom ${await decisionBottom(p)}px of 900`);
    await shot(p, '04-selected');
    await p.locator('.case-card:not(.case-card--preview)').nth(1).locator('button.prow').nth(2).hover(); await p.waitForTimeout(300); await shot(p, '05-hover-beside-selected');
    await ctx.close();
  }
  // 2. the other states, each from a run the reducer made
  const states: [string, Run, 'first' | 'second-role'][] = [
    ['06-secondary-role', draftTo(normal, 3), 'second-role'],
    ['07-coach', draftTo(normal, 5), 'first'],
    ['08-bench', draftTo(normal, 6), 'first'],
    ['09-hard-round1', hard, 'first'],
    ['10-hard-round4', draftTo(hard, 3), 'first'],
  ];
  for (const [name, run, which] of states) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await open(p, reducer(run, { type: 'spin' }));
    await settle(p);
    const coach = await p.locator('.case-item--coach').count();
    if (coach) { await p.locator('.case-item--coach').first().hover(); await p.waitForTimeout(300); }
    else if (!await pickRow(p, which)) report.push(`${name}: no second-role row in this case, captured unselected`);
    await p.mouse.move(2, 2); await p.waitForTimeout(500);
    report.push(`${name}: decision panel bottom ${await decisionBottom(p)}px of 900`);
    await shot(p, name);
    await ctx.close();
  }
  // 3. alternate palettes, effects off (reduced motion, fast reveals), 200% zoom (a 720x450 window at double density), a short laptop window
  const variants: [string, { w: number; h: number; scheme: 'light' | 'dark'; prefs: Record<string, unknown>; dsf?: number; reduce?: boolean }][] = [
    ['11-light', { w: 1440, h: 900, scheme: 'light', prefs: { theme: 'light' } }],
    ['12-high-contrast', { w: 1440, h: 900, scheme: 'dark', prefs: { theme: 'dark', contrast: true } }],
    ['13-effects-off', { w: 1440, h: 900, scheme: 'dark', prefs: { theme: 'dark', fastReveals: true }, reduce: true }],
    ['14-zoom-200', { w: 720, h: 450, scheme: 'dark', prefs: { theme: 'dark' }, dsf: 2, reduce: true }],
    ['15-laptop-1366x768', { w: 1366, h: 768, scheme: 'dark', prefs: { theme: 'dark' }, reduce: true }],
  ];
  for (const [name, v] of variants) {
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, colorScheme: v.scheme, deviceScaleFactor: v.dsf ?? 1, reducedMotion: v.reduce ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage();
    await open(p, reducer(draftTo(normal, 0), { type: 'spin' }), v.prefs);
    await settle(p); await pickRow(p, 'first'); await p.mouse.move(2, 2); await p.waitForTimeout(500);
    report.push(`${name}: decision panel bottom ${await decisionBottom(p)}px of ${v.h}${await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1) ? ' (HORIZONTAL OVERFLOW)' : ''}`);
    await shot(p, name);
    await ctx.close();
  }
  // 4. phone 375x812: the reel, the rail, a selected player, hard mode
  for (const [name, run, which] of [['16-phone-selected', reducer(normal, { type: 'spin' }), 'first'], ['17-phone-hard', reducer(hard, { type: 'spin' }), 'first']] as const) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: 'dark', reducedMotion: 'reduce', hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    await open(p, run);
    await settle(p);
    const roster = p.locator('.roster-selector button').first(); if (await roster.count()) await roster.click();
    const toggle = p.locator('.case-card__toggle').first(); if (await toggle.count() && (await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    await pickRow(p, which); await p.waitForTimeout(500);
    await shot(p, name, true);
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: 'dark', hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    await startDaily(p);
    await p.waitForTimeout(1500); await shot(p, '18-phone-reel');
    await ctx.close();
  }
  // 5. missing art: every portrait and logo fails to load, so the rows and the decision panel show the anonymous silhouette and the team badge fallback
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await open(p, reducer(normal, { type: 'spin' }));
    await settle(p); await pickRow(p, 'first');
    await p.evaluate(() => document.querySelectorAll('.teams-col img:not(.photo--none), .draftbar img:not(.photo--none), .strip img:not(.photo--none)').forEach((i) => { (i as HTMLImageElement).src = 'data:image/png;base64,AAAA'; }));
    await p.mouse.move(2, 2); await p.waitForTimeout(700);
    await shot(p, '19-images-missing');
    await ctx.close();
  }
  // 6. frame pacing while the three reels roll: a proxy only (headless Chromium here, software compositing), with and without a 4x CPU slowdown standing in for a mid-range phone
  for (const [label, w, h, slow] of [['desktop 1440x900', 1440, 900, 1], ['phone 375x812, CPU 4x slower', 375, 812, 4]] as const) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', reducedMotion: 'no-preference', hasTouch: w < 500, isMobile: w < 500 });
    const p = await ctx.newPage();
    if (slow > 1) await (await ctx.newCDPSession(p)).send('Emulation.setCPUThrottlingRate', { rate: slow });
    await startDailyUntilSealed(p);
    await p.evaluate(`(function () { var t = []; window.__t = t; var last = performance.now(); function f(now) { t.push(now - last); last = now; if (t.length < 400) requestAnimationFrame(f); } requestAnimationFrame(f); })()`);
    await p.getByRole('button', { name: 'Open case', exact: true }).click();
    await p.waitForTimeout(4200);
    const t = await p.evaluate(() => (window as unknown as { __t: number[] }).__t.slice(1));
    const rolling = t;
    const sorted = [...rolling].sort((a, b) => a - b);
    const total = rolling.reduce((a, b) => a + b, 0);
    report.push(`reel frames, ${label}: ${(rolling.length / (total / 1000)).toFixed(1)} fps average, p95 frame ${sorted[Math.floor(sorted.length * 0.95)].toFixed(1)} ms, slowest ${sorted[sorted.length - 1].toFixed(1)} ms, ${rolling.filter((x) => x > 33.4).length} of ${rolling.length} frames over 33 ms`);
    await ctx.close();
  }
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.httpServer.close((e) => (e ? reject(e) : resolve())));
}
const html = fs.readFileSync('dist/index.html');
report.push(`dist/index.html: ${(html.length / 1024).toFixed(2)} KB, ${(zlib.gzipSync(html, { level: 9 }).length / 1024).toFixed(2)} KB gzip`);
console.log(report.join('\n'));
console.log(`screenshots in ${out}: ${fs.readdirSync(out).filter((f) => f.endsWith('.jpg')).length}`);
