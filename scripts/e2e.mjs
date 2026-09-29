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
let challengeLink = null;

/** Drafts all seven rounds (players, coach, bench), always taking the first team and the first chip. */
async function draftAll(p) {
  for (let r = 0; r < 7; r++) {
    await p.locator('button.cta', { hasText: 'Open case' }).click({ force: true });
    await p.waitForSelector('.case-item', { timeout: 6000 });
    await p.waitForTimeout(300);
    await p.locator('.case-item').first().click();
    await p.waitForTimeout(300);
    const chip = p.locator('.slot-chip').first();
    if (await chip.count()) { await chip.click(); await p.waitForTimeout(200); }
  }
}
async function page(viewport = { width: 1280, height: 900 }) {
  const p = await b.newPage({ viewport });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/fonts|ERR_/.test(m.text()) && errs.push(m.text()));
  await p.route('https://fonts.**', r => r.fulfill({ body: '' }));
  await p.route('http://game.local/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  return { p, errs };
}

async function run(viewport, tag) {
  const p = await b.newPage({ viewport, acceptDownloads: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/fonts|ERR_/.test(m.text()) && errs.push(m.text()));
  await p.route('https://fonts.**', r => r.fulfill({ body: '' }));
  await p.route('http://game.local/', r => r.fulfill({ contentType: 'text/html', body: html }));
  await p.goto('http://game.local/');
  await p.evaluate(() => localStorage.clear()); await p.reload();
  const cta = (t) => p.locator('button.cta', { hasText: t }).click({ force: true });
  await p.waitForSelector('.home__daily');
  await p.locator('.home__daily').click();
  if (!(await p.textContent('.kicker')).includes('Daily #')) throw new Error('daily mode did not start');
  await p.screenshot({ path: `shots/${tag}-0-spin.png`, fullPage: true });
  // Five players, then the coach (round 6) and the bench player (round 7).
  for (let r = 0; r < 7; r++) {
    if (r > 0) await cta('Open case'); // the Play Daily button already opened the first case
    if (r === 0) { await p.waitForTimeout(1200); await p.screenshot({ path: `shots/${tag}-1a-reel.png` }); }
    await p.waitForSelector('.case-item', { timeout: 6000 });
    await p.waitForTimeout(500);
    if (r === 0) await p.screenshot({ path: `shots/${tag}-1-teams.png`, fullPage: true });
    if (r === 1) { await p.click('.reroll-row .ghost-btn'); await p.waitForTimeout(600); }
    const cards = await p.$$('.case-item');
    if (cards.length !== 3) throw new Error('expected 3 teams, got ' + cards.length);
    if (r === 5) {
      if (!(await p.$('.case-item--coach'))) throw new Error('round 6 is not the coach round');
      await p.screenshot({ path: `shots/${tag}-2b-coach.png`, fullPage: true });
    }
    await cards[r % 3].click();
    await p.waitForTimeout(500);
    if (r === 0) await p.screenshot({ path: `shots/${tag}-2-players.png`, fullPage: true });
    if (r === 5) continue; // picking a coach is one click
    const chips = await p.$$('.slot-chip');
    if (!chips.length) throw new Error('no eligible player in round ' + r);
    if (r === 6 && !(await chips[0].textContent()).includes('Bench')) throw new Error('round 7 is not the bench round');
    await chips[0].click();
    await p.waitForTimeout(300);
  }
  await p.waitForSelector('button.cta'); await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/${tag}-3-ready.png`, fullPage: true });
  if (await p.$('.lobby__stat')) throw new Error('ratings visible in lobby');
  await cta('Find match');
  let n = 0, shotSb = false, shotKnife = false, shotHalf = false;
  while (!(await p.$('.final')) && n++ < 12) {
    await p.waitForSelector('button.cta', { timeout: 6000 });
    if (n === 1) {
      // Match-day form: sub the bench player in for the first starter, then check it shows.
      await p.waitForSelector('.subs');
      await p.locator('.subs__btns .ghost-btn', { hasText: 'Sub out' }).first().click();
      await p.waitForSelector('.subs__btns .is-on:has-text("Sub out")');
      await p.screenshot({ path: `shots/${tag}-4-preview.png`, fullPage: true });
    }
    await cta('Accept');
    // Map veto: take the first open map on each of our turns until the first map is set up.
    await p.waitForSelector('.veto');
    if (n === 1) await p.screenshot({ path: `shots/${tag}-4b-veto.png`, fullPage: true });
    while (await p.$('.veto')) {
      await p.locator('.veto__map button:not([disabled])').first().click();
      await p.waitForTimeout(100);
    }
    if (n === 1) await p.screenshot({ path: `shots/${tag}-4c-veto-done.png`, fullPage: true });
    const maps = [];
    for (let g = 0; g < 3; g++) {
      // Knife round: pick a side when we win it (alternating T/CT), or go live on the side we're left with.
      await p.waitForSelector('.knife');
      if (!shotKnife) { await p.screenshot({ path: `shots/${tag}-5a-knife.png`, fullPage: true }); shotKnife = true; }
      const sides = p.locator('.side-btn');
      if (await sides.count()) await sides.nth(g % 2).click(); else await cta('Go live');
      // After a lost pistol, playback waits for a buy: save.
      const answerBuy = async () => { const save = p.locator('.buy .ghost-btn', { hasText: 'Save' }); if (await save.count()) await save.click(); };
      if (g === 0 && n === 1) {
        await p.waitForTimeout(3200); await answerBuy();
        await p.screenshot({ path: `shots/${tag}-5-live.png`, fullPage: true });
        // A tactical timeout shows up in the killfeed and can't be called twice in a half.
        await p.waitForSelector('.calls__timeout:not([disabled])', { timeout: 6000 });
        await p.click('.calls__timeout');
        await p.waitForSelector('.kf:has-text("Tactical timeout")', { timeout: 4000 });
        if (!(await p.$('.calls__timeout[disabled]'))) throw new Error('second timeout allowed in the same half');
      }
      if (g === 0 && n === 1 && !shotHalf) {
        await p.locator('.speed button', { hasText: '4×' }).click();
        // At 4× a round takes ~60 ms and the feed only keeps the last few lines, so poll quickly (and answer the buy question if it comes up).
        let sawHalf = false;
        for (let i = 0; i < 400 && !sawHalf; i++) {
          sawHalf = !!(await p.$('.kf--half:has-text("Halftime")'));
          if (!sawHalf) { await answerBuy(); await p.waitForTimeout(25); }
        }
        if (!sawHalf) throw new Error('no halftime line in the killfeed');
        await p.screenshot({ path: `shots/${tag}-5b-halftime.png`, fullPage: true }); shotHalf = true;
      }
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
  await p.locator('.share-bar .ghost-btn', { hasText: 'Copy result' }).click();
  await p.waitForSelector('.share-bar .ghost-btn:has-text("Copied")');
  // The result card: drawn in the browser and downloaded (no touch screen here, so no share sheet).
  const [card] = await Promise.all([p.waitForEvent('download'), p.locator('.share-bar .ghost-btn', { hasText: 'Save image' }).click()]);
  const cardPath = `shots/${tag}-8b-card.png`;
  await card.saveAs(cardPath);
  if (!/^major-mayhem-daily-\d+\.png$/.test(card.suggestedFilename()) || fs.statSync(cardPath).size < 50000) throw new Error('result card missing or empty: ' + card.suggestedFilename());
  const shared = await p.evaluate(() => window.__copied ?? '');
  if (!shared.includes('Major Mayhem Daily #')) throw new Error('share text not copied: ' + JSON.stringify(shared));
  console.log(tag, 'draft grade', grade, '| share:', shared.split('\n')[0]);
  if (tag === 'desk') {
    // Challenge a friend: the link carries this team.
    await p.fill('.challenge input', 'Tester');
    await p.locator('.challenge .ghost-btn').click();
    await p.waitForSelector('.challenge .ghost-btn:has-text("Link copied")');
    challengeLink = (await p.evaluate(() => window.__copied)).split('\n')[1];
    if (!/#duel=[A-Za-z0-9_-]+$/.test(challengeLink ?? '')) throw new Error('no challenge link: ' + challengeLink);
  }
  await p.screenshot({ path: `shots/${tag}-8-review.png`, fullPage: true });
  await p.reload(); await p.waitForSelector('.final'); console.log(tag, 'save restored OK');
  const finalSave = await p.evaluate(() => localStorage.getItem('major-mayhem-run-v2'));
  await p.click('[aria-label="Your stats"]');
  const runs = (await p.textContent('.stat-tiles div b')).trim();
  if (runs !== '1') throw new Error(`stats should count the run once across reloads, got ${runs}`);
  await p.waitForTimeout(500); await p.screenshot({ path: `shots/${tag}-9-stats.png` });
  await p.keyboard.press('Escape');
  // After today's daily, the start screen shows the result instead of offering a replay.
  await p.locator('button.cta', { hasText: 'Play again' }).click();
  await p.waitForSelector('.daily-done');
  if (await p.locator('.home__daily', { hasText: 'Replay' }).count() === 0) throw new Error('a finished daily should show as played on the start screen');
  console.log(tag, 'daily done card:', (await p.textContent('.daily-done strong')).trim(), '|', (await p.textContent('.daily-done .next-daily')).trim());
  await p.screenshot({ path: `shots/${tag}-10-daily-done.png`, fullPage: true });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(tag, 'horizontal overflow px:', sw, 'errors:', errs);
  if (sw > 0) problems.push(`${tag}: page scrolls sideways by ${sw}px`);
  if (errs.length) problems.push(`${tag}: page errors: ${errs.join(' | ')}`);
  if (sw > 0) console.log(await p.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.className + ' ' + Math.round(e.getBoundingClientRect().right)).slice(0, 12)));
  // Broken saves (checked after the error tally above, since a crash logs errors on purpose).
  const setSave = async (edit) => {
    const s = JSON.parse(finalSave); edit(s);
    await p.evaluate((v) => localStorage.setItem('major-mayhem-run-v2', v), JSON.stringify(s));
    await p.reload();
  };
  // A save pointing at a player who no longer exists starts a new run instead of crashing.
  await setSave((s) => { s.picks[0].playerId = 'retired-player'; });
  await p.waitForSelector('.spin-stage');
  if (await p.$('.crash')) throw new Error('a save with a missing player crashed the page');
  // A save that passes the checks but still crashes shows the error screen; "Reset run" recovers and keeps stats.
  await setSave((s) => { s.t.matches[0].maps = null; });
  await p.waitForSelector('.crash');
  await p.screenshot({ path: `shots/${tag}-11-crash.png`, fullPage: true });
  await p.locator('.crash button', { hasText: 'Reset run' }).click();
  await p.waitForSelector('.spin-stage');
  if (!(await p.evaluate(() => localStorage.getItem('major-mayhem-stats-v1')))) throw new Error('reset run cleared lifetime stats');
  console.log(tag, 'broken saves recover OK');
  await p.close();
}
/** Opens a challenge link, accepts, drafts and plays the Bo3 showmatch against the challenger's team. */
async function duel() {
  const { p, errs } = await page();
  await p.goto('http://game.local/'); await p.evaluate(() => localStorage.clear());
  await p.goto(challengeLink); await p.reload();
  await p.waitForSelector('.modal h3:has-text("Tester challenges you")');
  await p.screenshot({ path: 'shots/duel-1-invite.png' });
  await p.locator('.modal button.cta', { hasText: 'Accept' }).click();
  if (!(await p.textContent('.kicker')).includes('Draft duel vs Tester')) throw new Error('duel did not start');
  await draftAll(p);
  await p.waitForSelector('.challenger');
  await p.screenshot({ path: 'shots/duel-2-lobby.png', fullPage: true });
  await p.locator('button.cta', { hasText: 'Play the showmatch' }).click();
  await p.locator('button.cta', { hasText: 'Accept' }).click({ force: true, timeout: 6000 });
  await p.waitForSelector('.veto');
  while (await p.$('.veto')) { await p.locator('.veto__map button:not([disabled])').first().click(); await p.waitForTimeout(100); }
  for (let g = 0; g < 3; g++) {
    await p.waitForSelector('.knife');
    const sides = p.locator('.side-btn');
    if (await sides.count()) await sides.first().click(); else await p.locator('button.cta', { hasText: 'Go live' }).click();
    await p.locator('.ghost-btn', { hasText: 'Skip' }).click();
    await p.waitForSelector('.sb');
    const next = p.locator('button.cta', { hasText: 'Next map' });
    if (await next.count()) await next.click(); else break;
  }
  await p.locator('button.cta', { hasText: 'See results' }).click();
  await p.waitForSelector('.final');
  const result = (await p.textContent('.final__banner h3')).trim();
  if (!/^(You|They) won \d–\d$/.test(result)) throw new Error('unexpected duel result: ' + result);
  await p.screenshot({ path: 'shots/duel-3-result.png', fullPage: true });
  console.log('duel result:', result, 'errors:', errs);
  if (errs.length) problems.push(`duel: page errors: ${errs.join(' | ')}`);
  await p.close();
}

/** Guess the pro: type names, pick from the suggestions, and finish the day (win or after eight guesses). */
async function guess() {
  const { p, errs } = await page({ width: 390, height: 844 });
  await p.goto('http://game.local/'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.locator('.tabs button', { hasText: 'Guess the pro' }).click();
  await p.waitForSelector('.guess__box input');
  for (const name of ['s1', 'niko', 'zyw', 'dev', 'donk', 'ropz', 'fallen', 'olof', 'karr', 'gla1']) {
    if (await p.$('.guess__answer')) break;
    await p.fill('.guess__box input', name);
    await p.waitForSelector('.guess__suggest button');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(150);
  }
  await p.waitForSelector('.guess__answer');
  const rows = await p.$$eval('.guess__row:not(.guess__row--head)', (r) => r.length);
  if (rows < 1 || rows > 8) throw new Error('unexpected number of guesses: ' + rows);
  await p.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__copied = t; } } }));
  await p.locator('.share-bar .ghost-btn', { hasText: 'Copy result' }).click();
  const shared = await p.evaluate(() => window.__copied ?? '');
  if (!/^Major Mayhem · Guess the Pro #\d+ [\dX]\/8/.test(shared)) throw new Error('guess share text: ' + shared);
  await p.screenshot({ path: 'shots/guess-1-done.png', fullPage: true });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log('guess:', (await p.textContent('.guess__answer strong')).trim(), '|', shared.split('\n')[0], '| overflow', sw, 'errors:', errs);
  if (sw > 0) problems.push(`guess: page scrolls sideways by ${sw}px`);
  if (errs.length) problems.push(`guess: page errors: ${errs.join(' | ')}`);
  await p.close();
}

/** Twitch chat votes, with a fake chat socket: viewers pick the second team in the first case. */
async function twitch() {
  const { p, errs } = await page();
  await p.addInitScript(() => {
    window.WebSocket = class {
      constructor() { window.__ws = this; setTimeout(() => this.onopen?.(), 10); }
      send(line) { if (line.startsWith('JOIN')) setTimeout(() => this.onmessage?.({ data: `:justinfan1!justinfan1@justinfan1.tmi.twitch.tv ${line}\r\n` }), 10); }
      close() { this.onclose?.({}); }
    };
    window.__chat = (user, text) => window.__ws.onmessage({ data: `@display-name=${user} :${user}!${user}@${user}.tmi.twitch.tv PRIVMSG #testchan :${text}\r\n` });
  });
  await p.goto('http://game.local/'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.click('[aria-label="Twitch chat votes"]');
  await p.fill('.twitch-form input', 'testchan');
  await p.selectOption('.twitch-form select', '10');
  await p.locator('.twitch-form button.cta').click();
  await p.waitForSelector('.twitch-status.is-live');
  await p.keyboard.press('Escape');
  await p.locator('.home__card', { hasText: 'Free play' }).click();
  await p.locator('button.cta', { hasText: 'Open case' }).click();
  await p.waitForSelector('.chatvote', { timeout: 8000 });
  const second = (await p.locator('.case-item__name').nth(1).textContent()).trim();
  await p.evaluate(() => { window.__chat('ana', '2'); window.__chat('bo', '!2'); window.__chat('cy', '1'); window.__chat('di', 'nice case lol'); });
  await p.waitForSelector('.chatvote__opts li:nth-child(2) em:has-text("2")');
  await p.screenshot({ path: 'shots/twitch-1-vote.png', fullPage: true });
  await p.waitForSelector('.team-heading', { timeout: 14000 });
  const picked = (await p.textContent('.team-heading__name')).trim();
  if (!picked.startsWith(second)) throw new Error(`chat voted for ${second} but ${picked} was opened`);
  console.log('twitch vote picked:', picked, 'errors:', errs);
  if (errs.length) problems.push(`twitch: page errors: ${errs.join(' | ')}`);
  await p.close();
}

/** Sound: silent until the first click, ticks and a chime when a case opens, one sample per Guess clue, and mute that survives a reload. (Counts the recorded samples being started.) */
async function sound() {
  const { p, errs } = await page();
  await p.addInitScript(() => {
    window.__osc = 0; window.__ctxs = [];
    const AC = window.AudioContext;
    window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__ctxs.push(navigator.userActivation.hasBeenActive); } };
    const make = AC.prototype.createBufferSource; AC.prototype.createBufferSource = function () { window.__osc++; return make.call(this); };
  });
  const heard = async (act, wait = 300) => { const before = await p.evaluate(() => window.__osc); await act(); await p.waitForTimeout(wait); return (await p.evaluate(() => window.__osc)) - before; };
  await p.goto('http://game.local/'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForSelector('.home__daily'); await p.waitForTimeout(400);
  if ((await p.evaluate(() => window.__ctxs.length)) !== 0) throw new Error('an audio context was created before any click');
  if (!(await heard(() => p.locator('.home__card', { hasText: 'Free play' }).click()))) throw new Error('a button click made no sound');
  if (!(await p.evaluate(() => window.__ctxs[0]))) throw new Error('the audio context was created before user activation');
  const reel = await heard(() => p.locator('button.cta', { hasText: 'Open case' }).click({ force: true }), 3300);
  if (reel < 25) throw new Error(`the case reel should tick and chime, heard ${reel} notes`);
  await p.locator('[aria-label="Turn sound off"]').click();
  await p.waitForSelector('.reroll-row .ghost-btn');
  if (await heard(() => p.locator('.reroll-row .ghost-btn').click(), 600)) throw new Error('muted, but a reroll still made sound');
  await p.reload(); await p.waitForSelector('[aria-label="Turn sound on"]');
  if (await heard(() => p.locator('[aria-label="Your stats"]').click())) throw new Error('mute did not survive a reload');
  await p.keyboard.press('Escape');
  await p.locator('[aria-label="Turn sound on"]').click();
  await p.locator('.tabs button', { hasText: 'Guess the pro' }).click();
  await p.fill('.guess__box input', 'zyw');
  await p.waitForSelector('.guess__suggest button');
  const notes = await heard(() => p.locator('.guess__suggest button').first().click(), 900);
  if (notes !== 6) throw new Error(`a guess should play one note per clue (6), heard ${notes}`);
  console.log('sound: reel', reel, 'notes | guess', notes, 'notes | mute persists | errors:', errs);
  if (errs.length) problems.push(`sound: page errors: ${errs.join(' | ')}`);
  await p.close();
}

await run({ width: 1280, height: 900 }, 'desk');
await run({ width: 390, height: 844 }, 'mob');
await duel();
await twitch();
await sound();
await guess();
await b.close();
if (problems.length) { console.error('FAIL\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('OK');
