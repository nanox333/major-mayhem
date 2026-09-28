// Plays one full run in headless Chromium: 5 draft rounds (with case reel + reroll) and the whole Major.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const html = fs.readFileSync('dist/index.html', 'utf8');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
async function run(viewport, tag) {
  const p = await b.newPage({ viewport });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/fonts|ERR_/.test(m.text()) && errs.push(m.text()));
  await p.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(r.request().url().includes('react-dom') ? 'node_modules/react-dom/umd/react-dom.production.min.js' : 'node_modules/react/umd/react.production.min.js') }));
  await p.route('https://fonts.**', r => r.fulfill({ body: '' }));
  await p.route('http://game.local/', r => r.fulfill({ contentType: 'text/html', body: html }));
  await p.goto('http://game.local/');
  await p.evaluate(() => localStorage.clear()); await p.reload();
  const cta = (t) => p.locator('button.cta', { hasText: t }).click({ force: true });
  await p.waitForSelector('button.cta');
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
  await p.reload(); await p.waitForSelector('.final'); console.log(tag, 'save restored OK');
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(tag, 'horizontal overflow px:', sw, 'errors:', errs);
  if (sw > 0) console.log(await p.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.className + ' ' + Math.round(e.getBoundingClientRect().right)).slice(0, 12)));
  await p.close();
}
await run({ width: 1280, height: 900 }, 'desk');
await run({ width: 390, height: 844 }, 'mob');
await b.close();
