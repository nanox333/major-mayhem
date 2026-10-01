// Captures the draft (PR #226) in the same states as the art-direction mockup, from a built dist/index.html (npm run build first).
// usage: node scripts/draft-capture.mjs <width> <height> <tag> <outdir>        e.g. node scripts/draft-capture.mjs 1440 900 d shots/draft-pass
// env:   CHROMIUM_PATH=<browser exe>  SCHEME=light  SKIP_ROUNDS=1 (stop after round 1; skips the coach and bench rounds)
// The clock is pinned to 2026-10-01 and today's daily is started, so every run shows the same three rosters and the same picks: captures from two builds compare like for like.
// It prints the decision panel's bottom edge, which must stay under 900 at 1440x900 (it is 861 for round 1 and 878 for the bench worst case).
import { chromium } from 'playwright';
import fs from 'fs';
const [W, H, TAG, OUT] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4], process.argv[5]];
fs.mkdirSync(OUT, { recursive: true });
const html = fs.readFileSync('dist/index.html', 'utf8');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: W, height: H }, colorScheme: process.env.SCHEME || 'dark', reducedMotion: 'no-preference', deviceScaleFactor: 1 });
await ctx.addInitScript(() => { const R = Date; const off = new R('2026-10-01T10:00:00').getTime() - R.now(); class D extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } } globalThis.Date = D; });
const p = await ctx.newPage();
p.setDefaultTimeout(9000);
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.route('https://fonts.**', (r) => r.fulfill({ body: '' }));
await p.route('http://game.local/**', (r) => r.fulfill({ contentType: 'text/html', body: html }));
const bottom = () => p.evaluate(() => { const e = document.querySelector('.draftbar, .peekbar'); return e ? Math.round(e.getBoundingClientRect().bottom + scrollY) : null; });
const shot = async (n, full = false) => { await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(80); await p.screenshot({ path: `${OUT}/${TAG}-${n}.png`, fullPage: full }); };

await p.goto('http://game.local/');
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('mm-tips', JSON.stringify(['intro', 'fit', 'chem', 'form', 'knife', 'calls', 'rating', 'guess'])); });
await p.reload();
await p.waitForSelector('button.mbtn');
await p.locator('button.home__daily').click();
await p.mouse.move(W - 4, H / 2); // keep hover out of the way
const t0 = Date.now(); // starting today's run opens the case straight away
const at = async (ms, name) => { const wait = ms - (Date.now() - t0); if (wait > 0) await p.waitForTimeout(wait); await shot(name); };
await at(1300, '01-reel-rolling');
await at(2550, '02-reel-first-locked');
await at(3150, '03-reel-two-locked');
await at(3800, '04-reel-all-locked');
await p.waitForSelector('.case-card:not(.case-card--preview) .prow', { timeout: 12000 });
await p.waitForTimeout(1200);
await p.mouse.move(W - 4, H / 2);
await shot('05-settled');
// the mockup's state: the second player of the first roster
const card = p.locator('.case-card:not(.case-card--preview)').first();
await card.locator('button.prow').nth(1).click();
await p.mouse.move(W - 4, H / 2);
await p.waitForTimeout(500);
console.log('decision panel bottom (round 1):', await bottom());
await shot('06-selected');
await shot('06-selected-full', true);
// hover on another row, to see the hover state beside the selected one
await p.locator('.case-card:not(.case-card--preview)').nth(1).locator('button.prow').nth(2).hover();
await p.waitForTimeout(300);
await shot('07-hover');

if (!process.env.SKIP_ROUNDS) {
  // draft through to the coach and bench rounds
  const pick = async () => {
    await p.locator('button.cta', { hasText: 'Draft' }).first().click().catch(() => {});
  };
  await pick();
  for (let r = 1; r < 7; r++) {
    await p.locator('button.cta', { hasText: 'Open case' }).click({ force: true });
    await p.waitForSelector('.case-card:not(.case-card--preview) .prow, .case-item--coach', { timeout: 14000 });
    await p.waitForTimeout(700);
    if (r === 5) { await p.mouse.move(W - 4, H / 2); await shot('08-coach'); const c = p.locator('.case-item--coach').first(); await c.hover(); await p.waitForTimeout(300); await shot('08b-coach-hover'); await c.click(); continue; }
    if (r === 6) { await p.mouse.move(W - 4, H / 2); await shot('09-bench'); }
    const cards = p.locator('.case-card:not(.case-card--preview)');
    const roster = p.locator('.roster-selector button').nth(0);
    if (await roster.count() && W < 861) await roster.click();
    const tog = cards.first().locator('.case-card__toggle');
    if (await tog.count() && (await tog.getAttribute('aria-expanded')) !== 'true') await tog.click();
    await cards.first().locator('button.prow').first().click();
    if (r === 6) { await p.mouse.move(W - 4, H / 2); await p.waitForTimeout(400); await shot('10-bench-selected'); console.log('decision panel bottom (bench):', await bottom()); }
    await pick();
    await p.waitForTimeout(300);
  }
}
console.log(TAG, 'done; errors:', errs);
await b.close();
