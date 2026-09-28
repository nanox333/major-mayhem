// Plays one full daily run in headless Chromium (desktop + phone width): 5 draft rounds with the case reel
// and a reroll, the whole Major, then the results screen, sharing and stats. Needs `npm run build` first.
// Uses Playwright's own Chromium (`npx playwright install chromium`), or CHROMIUM_PATH if set.
// Exits 1 on page errors, horizontal overflow or a missing screen.
import { chromium } from 'playwright';
import fs from 'fs';
const html = fs.readFileSync('dist/index.html', 'utf8');
fs.mkdirSync('shots', { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const problems = [];
async function run(viewport, tag) {
  const p = await b.newPage({ viewport });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/fonts|ERR_/.test(m.text()) && errs.push(m.text()));
  await p.route('https://fonts.**', r => r.fulfill({ body: '' }));
  await p.route('http://game.local/', r => r.fulfill({ contentType: 'text/html', body: html }));
  await p.goto('http://game.local/');
  await p.evaluate(() => localStorage.clear()); await p.reload();
  const cta = (t) => p.locator('button.cta', { hasText: t }).click({ force: true });
  await p.waitForSelector('button.cta');
  await p.locator('.ghost-btn', { hasText: 'Play Daily' }).click();
  if (!(await p.textContent('.kicker')).includes('Daily #')) throw new Error('daily mode did not start');
  await p.screenshot({ path: `shots/${tag}-0-spin.png`, fullPage: true });
  for (let r = 0; r < 5; r++) {
    await cta('Open case');
    if (r === 0) { await p.waitForTimeout(1200); await p.screenshot({ path: `shots/${tag}-1a-reel.png` }); }
    await p.waitForSelector('.case-item', { timeout: 6000 });
    await p.waitForTimeout(500);
    if (r === 0) await p.screenshot({ path: `shots/${tag}-1-teams.png`, fullPage: true });
    if (r === 1) { await p.click('.reroll-row .ghost-btn'); await p.waitForTimeout(600); }
    const cards = await p.$$('.case-item');
    if (cards.length !== 3) throw new Error('expected 3 teams, got ' + cards.length);
    await cards[r % 3].click();
    await p.waitForTimeout(500);
    if (r === 0) await p.screenshot({ path: `shots/${tag}-2-players.png`, fullPage: true });
    const chips = await p.$$('.slot-chip');
    if (!chips.length) throw new Error('no eligible player in round ' + r);
    await chips[0].click();
    await p.waitForTimeout(300);
  }
  await p.waitForSelector('button.cta'); await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/${tag}-3-ready.png`, fullPage: true });
  if (await p.$('.lobby__stat')) throw new Error('ratings visible in lobby');
  await cta('Find match');
  let n = 0, shotLive = false, shotSb = false;
  while (!(await p.$('.final')) && n++ < 12) {
    await p.waitForSelector('button.cta', { timeout: 6000 });
    if (n === 1) await p.screenshot({ path: `shots/${tag}-4-preview.png`, fullPage: true });
    await cta('Accept');
    if (!shotLive) { await p.waitForTimeout(3200); await p.screenshot({ path: `shots/${tag}-5-live.png`, fullPage: true }); shotLive = true; }
    const maps = [];
    for (let g = 0; g < 3; g++) {
      const skip = p.locator('.ghost-btn', { hasText: 'Skip' }); if (await skip.count()) await skip.click();
      await p.waitForSelector('.sb');
      maps.push((await p.textContent('.sb__head')).trim());
      if (!shotSb && (await p.$('.result-stamp'))) { await p.screenshot({ path: `shots/${tag}-6-scoreboard.png`, fullPage: true }); shotSb = true; }
      const next = p.locator('button.cta', { hasText: 'Next map' });
      if (await next.count()) { await next.click({ force: true }); await p.waitForTimeout(200); } else break;
    }
    const res = (await p.textContent('.result-stamp')).trim();
    console.log(tag, 'match', n, res, '|', maps.join(' / '));
    await p.locator('button.cta').click({ force: true });
    await p.waitForTimeout(300);
  }
  await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/${tag}-7-final.png`, fullPage: true });
  console.log(tag, 'final:', (await p.textContent('.final__banner h3')).trim(), '| MVP', (await p.textContent('.mvp-card strong')).trim(), (await p.textContent('.mvp-card__rating b')).trim());
  if (!(await p.$('.review__list li'))) throw new Error('no draft review');
  const grade = (await p.textContent('.review__head b')).trim();
  // The test page isn't a secure context, so capture what the game writes instead of reading the clipboard.
  await p.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__copied = t; } } }));
  await p.locator('.share-bar .ghost-btn').click();
  await p.waitForSelector('.share-bar .ghost-btn:has-text("Copied")');
  const shared = await p.evaluate(() => window.__copied ?? '');
  if (!shared.includes('Major Mayhem Daily #')) throw new Error('share text not copied: ' + JSON.stringify(shared));
  console.log(tag, 'draft grade', grade, '| share:', shared.split('\n')[0]);
  await p.screenshot({ path: `shots/${tag}-8-review.png`, fullPage: true });
  await p.reload(); await p.waitForSelector('.final'); console.log(tag, 'save restored OK');
  await p.click('[aria-label="Your stats"]');
  const runs = (await p.textContent('.stat-tiles div b')).trim();
  if (runs !== '1') throw new Error(`stats should count the run once across reloads, got ${runs}`);
  await p.waitForTimeout(500); await p.screenshot({ path: `shots/${tag}-9-stats.png` });
  await p.keyboard.press('Escape');
  // After today's daily, the start screen shows the result instead of offering a replay.
  await p.locator('button.cta', { hasText: 'Play again' }).click();
  await p.waitForSelector('.daily-done');
  if (await p.locator('.ghost-btn', { hasText: 'Play Daily' }).count()) throw new Error('daily replay still offered after finishing it');
  console.log(tag, 'daily done card:', (await p.textContent('.daily-done strong')).trim(), '|', (await p.textContent('.daily-done .next-daily')).trim());
  await p.screenshot({ path: `shots/${tag}-10-daily-done.png`, fullPage: true });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(tag, 'horizontal overflow px:', sw, 'errors:', errs);
  if (sw > 0) problems.push(`${tag}: page scrolls sideways by ${sw}px`);
  if (errs.length) problems.push(`${tag}: page errors: ${errs.join(' | ')}`);
  if (sw > 0) console.log(await p.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.className + ' ' + Math.round(e.getBoundingClientRect().right)).slice(0, 12)));
  await p.close();
}
await run({ width: 1280, height: 900 }, 'desk');
await run({ width: 390, height: 844 }, 'mob');
await b.close();
if (problems.length) { console.error('FAIL\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('OK');
