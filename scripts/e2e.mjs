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
    await p.waitForSelector('.case-card:not(.case-card--preview), .case-item--coach', { timeout: 6000 });
    await p.waitForTimeout(300);
    await pickFrom(p, 0);
    await p.waitForTimeout(300);
  }
}
/**
 * Picks from card `i` of the open case: the first player who can be drafted (opening the card first on a phone), then the draft button
 * (the slot is their main role). In the coach round a card is one click. Returns the button's label, or 'coach'.
 */
async function pickFrom(p, i = 0, shot) {
  const coach = p.locator('.case-item--coach');
  if (await coach.count()) { await coach.nth(i).click(); return 'coach'; }
  const card = p.locator('.case-card:not(.case-card--preview)').nth(i);
  const roster = p.locator('.roster-selector button').nth(i);
  if (await roster.count()) await roster.click();
  const toggle = card.locator('.case-card__toggle');
  if (await toggle.count() && (await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  const rows = card.locator('button.prow');
  if (!(await rows.count())) throw new Error('no player can be drafted from card ' + i);
  await rows.first().click();
  const go = p.locator('.draftbar .cta:not([disabled])');
  await go.waitFor();
  if (shot) await p.screenshot({ path: shot, fullPage: true });
  const label = (await go.textContent()).trim();
  await go.click();
  return label;
}
/** The top bar keeps stats, Twitch chat votes and a new run in a menu (#101). */
const openMenu = (p) => p.click('[aria-label="More"]');
/** Guess the pro is a link in the top bar, and an item in the menu on a phone (#140). */
async function openGuess(p) {
  const link = p.locator('.topbar .gamelink');
  if (await link.isVisible()) await link.click();
  else { await openMenu(p); await p.locator('.menu__item--game').click(); }
}
async function page(viewport = { width: 1280, height: 900 }, reducedMotion) {
  const p = await b.newPage({ viewport, colorScheme: 'dark', ...(reducedMotion ? { reducedMotion } : {}) });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/fonts|ERR_/.test(m.text()) && errs.push(m.text()));
  await p.route('https://fonts.**', r => r.fulfill({ body: '' }));
  await p.route('http://game.local/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  return { p, errs };
}

async function run(viewport, tag) {
  const p = await b.newPage({ viewport, acceptDownloads: true, colorScheme: 'dark' });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/fonts|ERR_/.test(m.text()) && errs.push(m.text()));
  await p.route('https://fonts.**', r => r.fulfill({ body: '' }));
  await p.route('http://game.local/', r => r.fulfill({ contentType: 'text/html', body: html }));
  await p.goto('http://game.local/');
  // Every screen sits in the same column, so moving through a run never resizes the content; and the scrollbar keeps its space, so opening a dialog doesn't either.
  let edges = null;
  const same = async (where) => {
    const e = await p.evaluate(() => { const r = document.querySelector('.console__body, .editorial-home').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; });
    if (!edges) edges = e;
    else if (e[0] !== edges[0] || e[1] !== edges[1]) throw new Error(tag + ': the content moved from ' + edges + ' to ' + e + ' on ' + where);
  };
  if ((await p.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter)) !== 'stable') throw new Error(tag + ': the scrollbar gutter should stay reserved so dialogs do not resize the page');
  await p.evaluate((prefs) => { localStorage.clear(); if (prefs) localStorage.setItem('mm-prefs', prefs); }, process.env.MM_PREFS ?? null); await p.reload();
  const cta = (t) => p.locator('button.cta', { hasText: t }).click({ force: true });
  await p.waitForSelector('button.cta');
  await p.locator('.home__daily').click();
  if (!(await p.textContent('.kicker')).includes('Daily #')) throw new Error('daily mode did not start');
  const step = async () => (await p.textContent('.progress [aria-current="step"]')).trim();
  if (await p.locator('.topbar .progress, .topbar [aria-current="step"]').count()) throw new Error('the run steps must not be in the top bar (#140)');
  if (!(await step()).startsWith('Draft')) throw new Error(`the progress list should be on the Draft step, got "${await step()}"`);
  await p.screenshot({ path: `shots/${tag}-0-spin.png`, fullPage: true });
  // Five players, then the coach (round 6) and the bench player (round 7).
  for (let r = 0; r < 7; r++) {
    if (r > 0) await cta('Open case'); // the Play Daily button already opened the first case
    if (r === 0) { await p.waitForTimeout(1200); await p.screenshot({ path: `shots/${tag}-1a-reel.png` }); }
    await p.waitForSelector('.case-card:not(.case-card--preview), .case-item--coach', { timeout: 6000 });
    await p.waitForTimeout(500);
    if (r === 0) await p.screenshot({ path: `shots/${tag}-1-teams.png`, fullPage: true });
    if (r === 1) { await p.click('.reroll-row .ghost-btn'); await p.waitForTimeout(600); }
    const cards = await p.$$('.case-card:not(.case-card--preview), .case-item--coach');
    if (cards.length !== 3) throw new Error('expected 3 teams, got ' + cards.length);
    if (r === 5) {
      if (!(await p.$('.case-item--coach'))) throw new Error('round 6 is not the coach round');
      await p.screenshot({ path: `shots/${tag}-2b-coach.png`, fullPage: true });
    }
    // The draft screen has the lineup and the sidebar's hint from the first case on (#102, #109).
    if (r === 0 && !(await p.locator('.side-card .chem__total').count())) throw new Error('the sidebar has no chemistry panel');
    const picked = await pickFrom(p, r % 3, r === 0 ? `shots/${tag}-2-players.png` : undefined);
    if (r === 6 && !/Bench/.test(picked)) throw new Error('round 7 is not the bench round, got "' + picked + '"');
    await p.waitForTimeout(300);
  }
  await p.waitForSelector('button.cta'); await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/${tag}-3-ready.png`, fullPage: true });
  await same('the lobby');
  if ((await p.locator('.comfort li').count()) !== 7) throw new Error('the lobby should list all seven maps with how at home your team is (#49)');
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
      await same('the match-ready screen');
    }
    await cta('Accept');
    // Map veto: take the first open map on each of our turns until the first map is set up.
    await p.waitForSelector('.veto');
    if (n === 1) await p.screenshot({ path: `shots/${tag}-4b-veto.png`, fullPage: true });
    await same('the map veto');
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
        await same('the live match');
        if (tag === 'desk') {
          // A dialog over the controls holds playback where it is, and it carries on after (#181).
          await p.locator('.speed button', { hasText: 'Tactical' }).click();
          const score = () => p.locator('.hud__nums').innerText();
          await p.locator('.hud-btn--gear').click();
          await p.waitForSelector('[role="dialog"]');
          await p.waitForTimeout(400);
          const before = await score();
          await p.waitForTimeout(2200);
          if ((await score()) !== before) throw new Error('playback should wait while a dialog covers the controls');
          await p.keyboard.press('Escape');
          await p.locator('.speed button', { hasText: '1×' }).click();
        }
        if (!(await p.locator('.hud__extra .momentum__bar').count()) || !(await p.locator('.hud__extra .economy__side').count())) throw new Error('the live match should show momentum and the economy of each side (#71)');
        // A tactical timeout shows up in the killfeed and can't be called twice in a half. A lost pistol round puts a buy question up and playback waits for it,
        // and the timeout button is not drawn while it is, so these steps answer it and look again: they wait on the match's state, not on a clock.
        let callable = false;
        for (let i = 0; i < 200 && !callable; i++) {
          callable = !!(await p.$('.calls__timeout:not([disabled])'));
          if (!callable) { await answerBuy(); await p.waitForTimeout(60); }
        }
        if (!callable) throw new Error('the timeout button never became available');
        // The button pulses while the opponent is on a run and is redrawn as playback goes on, so Playwright's "stable" check can fail on it: press it in the page, and look
        // for the killfeed line to know it took.
        let called = false;
        for (let i = 0; i < 6 && !called; i++) {
          await p.evaluate(() => document.querySelector('.calls__timeout:not([disabled])')?.click());
          called = await p.waitForSelector('.kf:has-text("Tactical timeout")', { timeout: 1500 }).then(() => true, () => false);
          if (!called) await answerBuy();
        }
        if (!called) throw new Error('calling a timeout did not show in the killfeed');
        let used = null;
        for (let i = 0; i < 100 && used === null; i++) {
          const btn = await p.$('.calls__timeout');
          if (btn) used = await btn.isDisabled(); else { await answerBuy(); await p.waitForTimeout(60); }
        }
        if (used !== true) throw new Error('second timeout allowed in the same half');
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
  await same('the results');
  if (!(await p.locator('.path .history__row').count()) || !(await p.locator('.result-path li').count())) throw new Error('the results should show the played matches and path through the Major');
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
  // The site always opens on the home, where a finished daily offers its result.
  await p.reload(); await p.getByRole('button', { name: /^View your/ }).first().click(); await p.waitForSelector('.final'); console.log(tag, 'save restored OK');
  if (!(await step()).startsWith('Results') || (await p.locator('.progress .pstep.is-done').count()) !== 3) throw new Error(`the progress list should be on Results with three steps done, got "${await step()}"`);
  const finalSave = await p.evaluate(() => localStorage.getItem('major-mayhem-run-v2'));
  await openMenu(p); await p.click('[aria-label="Your stats"]');
  const runs = (await p.textContent('.stat-tiles div b')).trim();
  if (runs !== '1') throw new Error(`stats should count the run once across reloads, got ${runs}`);
  await p.waitForTimeout(500); await p.screenshot({ path: `shots/${tag}-9-stats.png` });
  if ((await p.locator('.dchart li').count()) !== 14 || !(await p.locator('.dchart li.is-played').count())) throw new Error('the stats should chart the last 14 dailies, including the result of today (#76)');
  await p.keyboard.press('Escape');
  // After today's daily, the start screen shows the result instead of offering a replay.
  await p.getByRole('button', { name: 'Play again', exact: true }).click();
  await p.waitForSelector('.daily-done');
  if (await p.locator('.home__daily', { hasText: 'Replay' }).count() === 0) throw new Error('a finished daily should show as played on the start screen');
  const clock = (await p.textContent('.home-daily-clock .clock')).trim();
  if (!/^\d\d:\d\d:\d\d$/.test(clock)) throw new Error('the daily card should carry the countdown clock, got "' + clock + '"');
  console.log(tag, 'daily done card:', (await p.textContent('.daily-done strong')).trim(), '|', clock);
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
  await p.waitForSelector('.home3');
  if (await p.$('.crash')) throw new Error('a save with a missing player crashed the page');
  // A save whose matches or state machine are malformed is refused up front, not half-way through a match (#165).
  await setSave((s) => { s.t.matches[0].maps = null; });
  await p.waitForSelector('.home3');
  if (await p.$('.crash')) throw new Error('a save with malformed matches should start a new run, not crash');
  await setSave((s) => { s.phase = 'invalid'; s.seed = null; });
  await p.waitForSelector('.home3');
  if (await p.$('.crash')) throw new Error('a save with invalid enums should start a new run, not crash');
  // A damaged record and a damaged Guess history are recovered, keeping what is valid (#164).
  await p.evaluate(() => { localStorage.setItem('major-mayhem-stats-v1', '{"v":1,"runs":4,"daily":null}'); const d = new Date(); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; localStorage.setItem('major-mayhem-guess-v1', JSON.stringify({ [k]: { guesses: ['not-a-player'], done: false, won: false } })); });
  await p.reload();
  await p.waitForSelector('.home3');
  if (await p.$('.crash')) throw new Error('a damaged record should not crash the home');
  await openGuess(p);
  await p.waitForSelector('.guess__box input');
  if (await p.$('.crash')) throw new Error('an unknown player in the Guess history should not crash Guess');
  if (!(await p.evaluate(() => localStorage.getItem('major-mayhem-stats-v1')?.includes('"runs":4') ?? true))) throw new Error('the valid part of a damaged record should be kept');
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
  if (!/^(You win|Your opponent wins) the draft duel\.$/.test(result) || !/Series \d–\d/.test(await p.textContent('.final__banner p'))) throw new Error('unexpected duel result: ' + result);
  await p.screenshot({ path: 'shots/duel-3-result.png', fullPage: true });
  console.log('duel result:', result, 'errors:', errs);
  if (errs.length) problems.push(`duel: page errors: ${errs.join(' | ')}`);
  await p.close();
}

/** Guess the pro: type names, pick from the suggestions, and finish the day (win or after eight guesses). */
async function guess() {
  const { p, errs } = await page({ width: 390, height: 844 }, 'reduce');
  await p.goto('http://game.local/'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await openGuess(p);
  await p.waitForSelector('.guess__box input');
  for (const name of ['s1', 'niko', 'zyw', 'dev', 'donk', 'ropz', 'fallen', 'olof', 'karr', 'gla1']) {
    if (await p.$('.guess__answer')) break;
    await p.fill('.guess__box input', name);
    await p.waitForSelector('.guess__suggest button');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(150);
  }
  await p.waitForSelector('.guess__answer');
  const rows = await p.$$eval('.guess__row:not(.guess__row--head):not(.guess__row--empty)', (r) => r.length);
  if (rows < 1 || rows > 8) throw new Error('unexpected number of guesses: ' + rows);
  if ((await p.locator('.guess__row:not(.guess__row--head) .flag').count()) < rows) throw new Error('every guess should show a flag');
  if (!(await p.locator('.guess__next').count())) throw new Error('the end of the day should offer one next step');
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
  await openMenu(p); await p.click('[aria-label="Twitch chat votes"]');
  await p.fill('.twitch-form input', 'testchan');
  await p.selectOption('.twitch-form select', '10');
  await p.locator('.twitch-form button.cta').click();
  await p.waitForSelector('.twitch-status.is-live');
  await p.keyboard.press('Escape');
  await p.locator('button.mbtn', { hasText: 'Start free play' }).click();
  await p.locator('button.cta', { hasText: 'Open case' }).click();
  await p.waitForSelector('.chatvote', { timeout: 8000 });
  // Chat votes once, on a player: option 2 is the second player who can be drafted, in the order the case lists them.
  await p.waitForSelector('button.prow');
  const second = (await p.locator('button.prow .prow__name b').nth(1).textContent()).trim();
  await p.evaluate(() => { window.__chat('ana', '2'); window.__chat('bo', '!2'); window.__chat('cy', '1'); window.__chat('di', 'nice case lol'); });
  await p.waitForSelector('.chatvote__opts li:nth-child(2) em:has-text("2")');
  await p.screenshot({ path: 'shots/twitch-1-vote.png', fullPage: true });
  await p.waitForSelector('.lrow.is-full', { state: 'attached', timeout: 14000 });
  const picked = (await p.locator('.lrow.is-full .lrow__line b').first().textContent()).trim();
  if (picked !== second) throw new Error(`chat voted for ${second} but ${picked} was drafted`);
  console.log('twitch vote picked:', picked, 'errors:', errs);
  // Hard mode (#176): the chat winner is staged, not drafted, and no role is chosen for the host.
  // Keep the chat connection (it lives in the page): go home and start a new free run there.
  await p.locator('.brand__btn').first().click();
  await p.locator('button.mbtn', { hasText: 'New free play' }).click();
  // A new run over one that is under way asks first (#182).
  await p.locator('button', { hasText: 'Replace it' }).click();
  await p.locator('.seg button', { hasText: 'No role labels' }).first().click();
  await p.locator('button.cta', { hasText: 'Open case' }).click();
  await p.waitForSelector('.chatvote', { timeout: 8000 });
  await p.waitForSelector('button.prow');
  await p.evaluate(() => { window.__chat('ana', '1'); window.__chat('bo', '1'); });
  await p.waitForSelector('.draftbar', { timeout: 14000 });
  if (await p.locator('.lrow.is-full').count()) throw new Error('in hard mode a chat vote should not draft anyone until the host chooses the role');
  if (!(await p.locator('.draftbar .cta[disabled]').count())) throw new Error('in hard mode the Draft button should wait for a role to be chosen');
  if (errs.length) problems.push(`twitch: page errors: ${errs.join(' | ')}`);
  await p.close();
}

/**
 * The case (#143 to #145): the three cards are one size, pointing at a player previews them in the lineup (hover and keyboard focus preview,
 * leaving removes a hover preview, pressing keeps it), and a player whose main role is taken says so and can still be drafted into the role the card names.
 */
async function draftui() {
  const { p, errs } = await page({ width: 1440, height: 900 });
  await p.goto('http://game.local/'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.locator('button.mbtn', { hasText: 'Start free play' }).click();
  await p.locator('button.cta', { hasText: 'Open case' }).click();
  await p.waitForSelector('.case-card:not(.case-card--preview)', { timeout: 8000 });
  await p.waitForTimeout(700);
  const rects = await p.$$eval('.case-card:not(.case-card--preview)', (cs) => cs.map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height), Math.round(r.width)].join(','); }));
  if (new Set(rects).size !== 1) throw new Error('the three team cards are not the same size: ' + rects.join(' | '));
  const w = Number(rects[0].split(',')[2]);
  if (w < 290) throw new Error(`the team cards should be at least about 300px wide at 1440, got ${w}`);

  // A quick double click on Spin again spends one reroll, not both (#174).
  await p.evaluate(() => { const b = document.querySelector('.reroll-row button'); b.click(); b.click(); });
  await p.waitForTimeout(700);
  if (!/1 spin left/.test(await p.locator('.reroll-row').innerText())) throw new Error('a double click on Spin again should use one reroll: ' + (await p.locator('.reroll-row').innerText()));
  await p.waitForSelector('.case-card:not(.case-card--preview)');
  const row = p.locator('button.prow').first();
  await row.hover();
  if ((await p.locator('.lrow.is-preview').count()) !== 1) throw new Error('hovering a player should preview them in the lineup');
  if (!(await p.locator('.chem__if h4').count())) throw new Error('hovering a player should show what they add to chemistry');
  if (!(await p.locator('.chem__majors').count())) throw new Error('hovering a player should show the Majors they attended (#48)');
  await p.mouse.move(2, 2); await p.waitForTimeout(150);
  if (await p.locator('.lrow.is-preview').count()) throw new Error('leaving a player should remove a hover preview');
  await row.click(); await p.mouse.move(2, 2); await p.waitForTimeout(150);
  if ((await p.locator('.lrow.is-preview').count()) !== 1) throw new Error('a pressed player should stay previewed');
  await p.locator('button.prow').nth(2).focus();
  if ((await p.locator('.lrow.is-preview b').textContent()).trim() !== (await p.locator('button.prow').nth(2).locator('.prow__name b').textContent()).trim()) throw new Error('keyboard focus should preview like hover');

  // Draft round by round until a player shows as a second role, then check the card and the confirm panel agree.
  let checked = false;
  await p.locator('button.prow').first().click();
  await p.locator('.draftbar .cta').click();
  for (let r = 1; r < 5 && !checked; r++) {
    await p.locator('button.cta', { hasText: 'Open case' }).click({ force: true });
    await p.waitForSelector('.case-card:not(.case-card--preview)', { timeout: 8000 }); await p.waitForTimeout(500);
    const second = p.locator('button.prow.is-second').first();
    if (await second.count()) {
      const named = (await second.locator('.prow__role.is-second').textContent()).replace(/2nd role/, '').replace(/^[^A-Za-z]*/, '').trim().split(/\s+/)[0];
      if (!/taken/.test(await second.locator('.prow__role.is-taken').textContent())) throw new Error('a second-role player should show their main role as taken');
      await second.click(); await p.waitForTimeout(200);
      const taken = p.locator('.slot-chip.is-taken');
      if (!(await taken.count()) || !(await taken.first().isDisabled())) throw new Error('the confirm panel should list the taken main role, disabled');
      const enabled = await p.locator('.draftbar .slot-chip:not(.is-taken)').allTextContents();
      if (!enabled.some((x) => x.toUpperCase().includes(named.toUpperCase()))) throw new Error(`the card says ${named} but the confirm panel offers: ${enabled.join(' | ')}`);
      await p.screenshot({ path: 'shots/draftui-second-role.png' });
      await p.locator('.draftbar .cta').click();
      checked = true;
    } else {
      await p.locator('button.prow:not(.is-off)').first().click();
      await p.locator('.draftbar .cta').click();
    }
    await p.waitForTimeout(300);
  }
  console.log('draft ui: equal cards', rects[0], '| preview ok | second role', checked ? 'checked' : 'not offered in these cases', 'errors:', errs);
  if (errs.length) problems.push(`draft ui: page errors: ${errs.join(' | ')}`);
  await p.close();
}

/**
 * Guess the pro with motion on (#127): the tiles turn over one at a time and the row is complete after about two seconds, Enter while a row is turning
 * finishes it at once, a bad guess shakes the box, and after a reload the rows are static.
 */
async function guessMotion() {
  const { p, errs } = await page({ width: 1280, height: 900 }, 'no-preference');
  await p.goto('http://game.local/'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('mm-tips', JSON.stringify(['guess'])); }); await p.reload();
  await openGuess(p);
  await p.waitForSelector('.guess__box input');
  if ((await p.locator('.guess__row:not(.guess__row--head)').count()) !== 8) throw new Error('the grid should always have eight rows');
  await p.fill('.guess__box input', 'zyw'); await p.waitForSelector('.guess__suggest button'); await p.keyboard.press('Enter');
  await p.waitForTimeout(700);
  if ((await p.locator('.guess__row.is-reveal').count()) !== 1) throw new Error('a new guess should be revealing');
  await p.waitForTimeout(2300);
  if (await p.locator('.guess__row.is-reveal').count()) throw new Error('the reveal should be over after about two seconds');
  const cells = await p.locator('.guess__row:not(.guess__row--head):not(.guess__row--empty) .clue').count();
  if (cells !== 6) throw new Error(`a finished row has six clues, found ${cells}`);
  await p.fill('.guess__box input', 'niko'); await p.waitForSelector('.guess__suggest button'); await p.keyboard.press('Enter');
  await p.waitForTimeout(400);
  await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  if (await p.locator('.guess__row.is-reveal').count()) throw new Error('Enter during a reveal should finish it at once');
  await p.fill('.guess__box input', 'zzzzqq'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  if (!(await p.locator('.guess__bar.is-shake').count())) throw new Error('a bad guess should shake the box');
  if (!(await p.locator('.sr[role="status"]', { hasText: /^Guess 2, /i }).count())) throw new Error('each guess should be announced once as a sentence');
  await p.reload(); await openGuess(p); await p.waitForSelector('.guess__row:not(.guess__row--head):not(.guess__row--empty)');
  if (await p.locator('.guess__row.is-reveal').count()) throw new Error('after a reload the rows should be static');
  console.log('guess motion: flip, skip, shake and static reload ok errors:', errs);
  if (errs.length) problems.push(`guess motion: page errors: ${errs.join(' | ')}`);
  await p.close();
}

/**
 * Settings and the keyboard (#110, #75, #77): the gear opens a dialog that takes focus and gives it back; theme and high contrast apply at once and
 * survive a reload; M mutes, ? opens the shortcuts, 1 then Enter then Enter drafts a player; and with single-key shortcuts off none of them fire.
 */
async function settingsAndKeys() {
  const { p, errs } = await page({ width: 1440, height: 900 });
  await p.goto('http://game.local/'); await p.evaluate(() => localStorage.clear()); await p.reload();
  const attr = (n) => p.evaluate((k) => document.documentElement.dataset[k], n);
  if ((await attr('theme')) !== 'dark' || (await attr('contrast')) !== 'normal') throw new Error('the default should be the dark theme with normal contrast');

  // With nothing saved the theme follows the device: a light system gets the light palette.
  const lightCtx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const lp = await lightCtx.newPage();
  await lp.route('https://fonts.**', (r) => r.fulfill({ body: '' }));
  await lp.route('http://game.local/**', (r) => r.fulfill({ contentType: 'text/html', body: html }));
  await lp.goto('http://game.local/');
  if ((await lp.evaluate(() => document.documentElement.dataset.theme)) !== 'light') throw new Error('a light system should get the light theme by default');
  await lightCtx.close();

  const gear = p.locator('.hud-btn--gear');
  await gear.click();
  await p.waitForSelector('[role="dialog"][aria-label="Settings"]');
  await p.locator('.seg button', { hasText: 'Light' }).click();
  if ((await attr('theme')) !== 'light') throw new Error('choosing Light should switch the palette at once');
  await p.locator('[role="switch"][aria-label="High contrast"]').click();
  if ((await attr('contrast')) !== 'high') throw new Error('High contrast should apply at once');
  await p.screenshot({ path: 'shots/settings-light-hc.png' });
  await p.keyboard.press('Escape');
  if (!(await gear.evaluate((el) => el === document.activeElement))) throw new Error('closing the settings should give focus back to the gear');
  await p.reload();
  if ((await attr('theme')) !== 'light' || (await attr('contrast')) !== 'high') throw new Error('the theme and contrast should survive a reload');
  await gear.click();
  await p.locator('.seg button', { hasText: 'Dark' }).click();
  await p.locator('[role="switch"][aria-label="High contrast"]').click();
  await p.keyboard.press('Escape');
  if ((await attr('theme')) !== 'dark' || (await attr('contrast')) !== 'normal') throw new Error('switching back should restore the dark palette');

  // M mutes and unmutes; ? opens the shortcuts.
  await p.locator('body').click({ position: { x: 5, y: 300 } });
  await p.keyboard.press('m');
  await p.waitForSelector('[aria-label="Turn sound on"]');
  await p.keyboard.press('m');
  await p.waitForSelector('[aria-label="Turn sound off"]');
  await p.keyboard.press('?');
  await p.waitForSelector('[role="dialog"][aria-label="Settings"]');
  if (!(await p.locator('.settings__keys kbd').count())) throw new Error('the shortcuts should be listed');
  await p.keyboard.press('m');
  if (await p.locator('[aria-label="Turn sound on"]').count()) throw new Error('shortcuts should be quiet while a dialog is open');

  // Turn them off: M does nothing.
  await p.locator('[role="switch"][aria-label="Single-key shortcuts"]').click();
  await p.keyboard.press('Escape');
  await p.locator('body').click({ position: { x: 5, y: 300 } });
  await p.keyboard.press('m');
  if (await p.locator('[aria-label="Turn sound on"]').count()) throw new Error('with shortcuts off, M should do nothing');
  await p.reload();
  await p.locator('body').click({ position: { x: 5, y: 300 } });
  await p.keyboard.press('m');
  if (await p.locator('[aria-label="Turn sound on"]').count()) throw new Error('the shortcuts switch should survive a reload');
  await gear.click();
  await p.locator('[role="switch"][aria-label="Single-key shortcuts"]').click();
  await p.keyboard.press('Escape');

  // Drafting from the keyboard: 1 goes to the first player of the first team, Enter chooses, Enter drafts.
  await p.locator('button.mbtn', { hasText: 'Start free play' }).click();
  await p.locator('button.cta', { hasText: 'Open case' }).click();
  await p.waitForSelector('.case-card:not(.case-card--preview)', { timeout: 8000 });
  await p.waitForTimeout(600);
  await p.locator('body').click({ position: { x: 5, y: 300 } });
  await p.keyboard.press('1');
  await p.waitForFunction(() => document.activeElement?.closest('.case-card:not(.case-card--preview)') === document.querySelector('.case-card:not(.case-card--preview)') && document.activeElement?.classList.contains('prow'), null, { timeout: 3000 }).catch(() => { throw new Error('1 should focus the first player in the first team'); });
  await p.keyboard.press('Enter');
  await p.waitForSelector('.draftbar .cta');
  await p.waitForFunction(() => document.activeElement?.classList.contains('cta'), null, { timeout: 3000 }).catch(() => { throw new Error('choosing a player by keyboard should move focus to the Draft button'); });
  await p.keyboard.press('Enter');
  await p.waitForSelector('.lrow.is-full', { state: 'attached', timeout: 5000 });
  console.log('settings and keys: theme, contrast, M, ?, 1 + Enter + Enter ok errors:', errs);
  if (errs.length) problems.push(`settings: page errors: ${errs.join(' | ')}`);
  await p.close();
}

/**
 * First-time tips (#130, #21): a first-time visitor sees the intro on the home and one tip at a time while drafting, "Skip tips" turns them all off, a
 * hard-mode tip names no roles, and a player with a record sees none of it.
 */
async function tips() {
  const { p, errs } = await page({ width: 1440, height: 900 });
  await p.goto('http://game.local/'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForSelector('.how__steps');
  await p.locator('button.mbtn', { hasText: 'Start free play' }).click();
  await p.locator('button.cta', { hasText: 'Open case' }).click();
  await p.waitForSelector('.case-card:not(.case-card--preview)', { timeout: 8000 }); await p.waitForTimeout(600);
  if ((await p.locator('.tip').count()) !== 1) throw new Error(`a first-time player should see exactly one tip at a time, saw ${await p.locator('.tip').count()}`);
  if (!(await p.locator('.tip', { hasText: 'Roles and fit' }).count())) throw new Error('the first tip while drafting should be Roles and fit');
  await p.screenshot({ path: 'shots/tip-fit.png' });
  await p.locator('.tip .tip__ok').click();
  if ((await p.locator('.tip').count()) !== 1 || !(await p.locator('.tip', { hasText: 'Team chemistry' }).count())) throw new Error('after dismissing one tip the next should take its place');
  await p.locator('.tip .tip__skip').click();
  if (await p.locator('.tip').count()) throw new Error('"Skip tips" should remove every tip');
  await p.reload();
  if (await p.locator('.tip').count()) throw new Error('skipped tips should stay skipped after a reload');
  // Hard mode: the tip names no role.
  await p.evaluate(() => { localStorage.clear(); }); await p.reload();
  await p.locator('button.mbtn', { hasText: 'Start free play' }).click();
  await p.locator('button.seg, .seg button', { hasText: 'No role labels' }).first().click();
  await p.locator('button.cta', { hasText: 'Open case' }).click();
  await p.waitForSelector('.case-card:not(.case-card--preview)', { timeout: 8000 }); await p.waitForTimeout(600);
  const hardTip = await p.locator('.tip').first().innerText();
  if (/IGL|AWP|Entry|Lurker|Support/.test(hardTip)) throw new Error('the hard-mode tip should name no roles: ' + hardTip);
  // A player with a record sees none of it.
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('major-mayhem-stats-v1', JSON.stringify({ v: 1, runs: 3, titles: 0, reached: [3, 0, 0, 0, 0], streak: 0, bestStreak: 0, drafted: {}, daily: {}, ach: {}, lastNew: [], duels: { w: 0, l: 0 } })); }); await p.reload();
  await p.waitForSelector('.home3');
  if (await p.locator('.how__steps').count()) throw new Error('a returning player should get the slim How it works row');
  await p.locator('button.mbtn', { hasText: 'Start free play' }).click();
  await p.locator('button.cta', { hasText: 'Open case' }).click();
  await p.waitForSelector('.case-card:not(.case-card--preview)', { timeout: 8000 }); await p.waitForTimeout(400);
  if (await p.locator('.tip').count()) throw new Error('a player who has finished a run should see no tips');
  console.log('tips: intro, one at a time, skip, hard mode and returning player ok errors:', errs);
  if (errs.length) problems.push(`tips: page errors: ${errs.join(' | ')}`);
  await p.close();
}

/**
 * Saving (#166, #189): when the browser will not keep anything the page says so, and a backup downloaded from the settings restores a record into a
 * browser that has nothing, while a file that is not a backup changes nothing.
 */
async function dataSafety() {
  // A browser that refuses every write.
  const { p: q, errs: qerrs } = await page({ width: 1280, height: 900 });
  await q.addInitScript(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('major-mayhem-')) throw new Error('quota'); return set.call(this, k, v); }; });
  await q.goto('http://game.local/');
  await q.waitForSelector('.unsaved', { timeout: 5000 }).catch(() => { throw new Error('a failed write should show the not-saved notice'); });
  if (!/Not saved on this device/.test(await q.locator('.unsaved').innerText())) throw new Error('the notice should say it is not saved on this device');
  if (qerrs.length) problems.push(`unsaved: page errors: ${qerrs.join(' | ')}`);
  await q.close();

  const { p, errs } = await page({ width: 1280, height: 900 });
  await p.goto('http://game.local/'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('major-mayhem-stats-v1', JSON.stringify({ v: 1, runs: 7, titles: 2, reached: [3, 1, 1, 0, 2], streak: 0, bestStreak: 1, drafted: {}, daily: {}, ach: {}, lastNew: [], duels: { w: 0, l: 0 } })); }); await p.reload();
  if (await p.locator('.unsaved').count()) throw new Error('the not-saved notice should not show when saving works');
  await p.locator('.hud-btn--gear').click();
  const [download] = await Promise.all([p.waitForEvent('download'), p.locator('button', { hasText: 'Download a backup' }).click()]);
  const file = await (async () => { const chunks = []; for await (const c of await download.createReadStream()) chunks.push(c); return Buffer.concat(chunks); })();
  await p.keyboard.press('Escape');
  // A browser with nothing in it, then the backup back in.
  await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.locator('.hud-btn--gear').click();
  await p.setInputFiles('input[type="file"]', { name: 'not-a-backup.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await p.waitForSelector('.settings__warn');
  if (await p.evaluate(() => localStorage.getItem('major-mayhem-stats-v1'))) throw new Error('a file that is not a backup should change nothing');
  await p.setInputFiles('input[type="file"]', { name: 'backup.json', mimeType: 'application/json', buffer: file });
  await p.waitForSelector('.settings__restore');
  if (!/7 Major runs/.test(await p.locator('.settings__restore').innerText())) throw new Error('the preview should say what the backup holds');
  await Promise.all([p.waitForLoadState('load'), p.locator('button', { hasText: 'Replace my data' }).click()]);
  await p.waitForSelector('.home3');
  const runs = await p.evaluate(() => JSON.parse(localStorage.getItem('major-mayhem-stats-v1') ?? '{}').runs);
  if (runs !== 7) throw new Error(`the restored record should have 7 runs, has ${runs}`);
  console.log('data safety: unsaved notice, backup and restore ok errors:', errs);
  if (errs.length) problems.push(`data safety: page errors: ${errs.join(' | ')}`);
  await p.close();
}

/**
 * Keyboard and focus (#179, #180): the whole seven-round draft can be played from the keyboard with focus always on a relevant control, and the game's
 * keys stay out of an open menu.
 */
async function keyboardDraft() {
  const { p, errs } = await page({ width: 1440, height: 900 }, 'reduce');
  await p.goto('http://game.local/'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.locator('button.mbtn', { hasText: 'Start free play' }).click();
  await p.locator('button.cta', { hasText: 'Open case' }).click();
  await p.waitForSelector('.case-card:not(.case-card--preview)', { timeout: 8000 });
  // An open More menu keeps the keyboard: 1 must not jump to a roster behind it (#179).
  await p.click('[aria-label="More"]');
  await p.keyboard.press('1');
  if (!(await p.locator('.menu__panel').count())) throw new Error('pressing 1 should not close the open menu');
  if (await p.evaluate(() => !!document.activeElement?.closest('.case-card:not(.case-card--preview)'))) throw new Error('pressing 1 in an open menu should not move focus to a roster');
  await p.keyboard.press('Escape');
  if (!(await p.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'More'))) throw new Error('Escape should give focus back to More');
  const adrift = () => p.evaluate(() => !document.activeElement || document.activeElement === document.body);
  // Seven rounds: 1, Enter, Enter for each player; Enter on the coach; Open case where focus is put.
  for (let round = 0; round < 7; round++) {
    if (round > 0) {
      if (await adrift()) throw new Error(`focus was lost after round ${round}`);
      await p.keyboard.press('Enter'); // the Open case button holds focus
      await p.waitForSelector('.case-card:not(.case-card--preview), .case-item--coach', { timeout: 6000 });
      await p.waitForTimeout(250);
    } else {
      await p.locator('body').click({ position: { x: 5, y: 300 } });
    }
    if (round === 5) {
      if (!(await p.evaluate(() => document.activeElement?.classList.contains('case-item--coach')))) throw new Error('the coach round should put focus on the first coach');
      await p.keyboard.press('Enter');
      continue;
    }
    if (round > 0 && round !== 5 && !(await p.evaluate(() => document.activeElement?.classList.contains('prow')))) throw new Error(`round ${round + 1} should put focus on the first player`);
    if (round === 0) { await p.keyboard.press('1'); await p.waitForFunction(() => document.activeElement?.classList.contains('prow'), null, { timeout: 3000 }); }
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => document.activeElement?.classList.contains('cta'), null, { timeout: 3000 }).catch(() => { throw new Error('choosing a player should move focus to the Draft button'); });
    await p.keyboard.press('Enter');
    await p.waitForTimeout(250);
  }
  if (!(await p.locator('.action-bar .cta--go').count())) throw new Error('a keyboard draft should reach the lobby');
  if (!(await p.evaluate(() => document.activeElement?.classList.contains('cta--go')))) throw new Error('the lobby should put focus on Find match');
  console.log('keyboard draft: seven rounds, focus kept, menu respected errors:', errs);
  if (errs.length) problems.push(`keyboard draft: page errors: ${errs.join(' | ')}`);
  await p.close();
}

/**
 * Protecting a run under way, and yesterday's daily (#182, #183): a start that would replace a run asks first, the same way every time; a daily left
 * from an earlier day is shown as that day's, apart from today's.
 */
async function runGuards() {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  await ctx.clock.install({ time: new Date('2026-10-01T10:00:00') });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('https://fonts.**', (r) => r.fulfill({ body: '' }));
  await p.route('http://game.local/**', (r) => r.fulfill({ contentType: 'text/html', body: html }));
  await p.goto('http://game.local/'); await p.evaluate(() => localStorage.clear()); await p.reload();
  // A free run under way: starting today's daily asks, and keeping it leaves the run alone.
  await p.locator('button.mbtn', { hasText: 'Start free play' }).click();
  await p.locator('button.cta', { hasText: 'Open case' }).click();
  await p.waitForSelector('.case-card:not(.case-card--preview)');
  const seed = await p.evaluate(() => JSON.parse(localStorage.getItem('major-mayhem-run-v2')).seed);
  await p.locator('.brand__btn').first().click();
  await p.locator('.home__daily').click();
  await p.waitForSelector('.mcard__ask');
  if (!/free run/.test(await p.locator('.mcard__ask').innerText())) throw new Error('starting a daily over a free run should say the free run would be replaced');
  await p.locator('button', { hasText: 'Keep it' }).click();
  if ((await p.evaluate(() => JSON.parse(localStorage.getItem('major-mayhem-run-v2')).seed)) !== seed) throw new Error('keeping the run should leave it untouched');
  // Start a daily for the 1st (replacing the free run, confirmed), then let the day roll over.
  await p.locator('.home__daily').click();
  await p.locator('button', { hasText: 'Replace it' }).click();
  await p.waitForSelector('.case-card:not(.case-card--preview)');
  await ctx.clock.setSystemTime(new Date('2026-10-02T10:00:00'));
  await p.reload();
  await p.waitForSelector('.home3');
  const old = await p.locator('.mcard__old').innerText();
  if (!/Daily #4 \(2026-10-01\) is unfinished/.test(old)) throw new Error('an earlier day\'s daily should be shown as that day\'s: ' + old);
  if (!/#5/.test(await p.locator('.home-kicker').innerText())) throw new Error('the daily card should be today\'s');
  if (/Continue today/i.test(await p.locator('.home__daily').innerText())) throw new Error('an earlier day\'s daily must not be offered as today\'s');
  await p.locator('.home__daily').click();
  await p.waitForSelector('.mcard__ask');
  if (!/Daily #4.*abandons it/.test(await p.locator('.mcard__ask').innerText())) throw new Error('starting today should say the old daily would be abandoned');
  await p.locator('button', { hasText: 'Keep it' }).click();
  await p.locator('.mcard__old .mbtn').click();
  await p.waitForSelector('.case-card:not(.case-card--preview)');
  console.log('run guards: asks before replacing, old daily shown as its own errors:', errs);
  if (errs.length) problems.push(`run guards: page errors: ${errs.join(' | ')}`);
  await ctx.close();
}

/** The phone draft (#185): every roster option exposes fit before navigation, which never commits a pick. */
async function phoneDraft() {
  const { p, errs } = await page({ width: 390, height: 844 }, 'reduce');
  await p.goto('http://game.local/'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.locator('button.mbtn', { hasText: 'Start free play' }).click();
  await p.locator('button.cta', { hasText: 'Open case' }).click();
  await p.waitForSelector('.case-card:not(.case-card--preview)');
  const tabs = p.getByRole('group', { name: 'Choose a roster to view' }).getByRole('button');
  const sums = await tabs.locator('.case-card__sum').allTextContents();
  if (sums.length !== 3 || !sums.every((x) => /main role|Nobody|you can draft/.test(x))) throw new Error('every roster option should summarise its players before navigation: ' + JSON.stringify(sums));
  const available = await tabs.allInnerTexts();
  if (!available.every(label => /\d+ available/.test(label))) throw new Error('each roster selector must show an available-player count');
  const saved = await p.evaluate(() => localStorage.getItem('major-mayhem-run-v2'));
  for (let i = 0; i < 3; i++) {
    await tabs.nth(i).click();
    if (await tabs.nth(i).getAttribute('aria-pressed') !== 'true') throw new Error('the visible roster must be identified by its selector');
    // The rosters sit in a swipeable rail; the one the selector names is the one in view (centred, filling most of the width).
    await p.waitForTimeout(700);
    const box = await p.locator('.case-card:not(.case-card--preview)').nth(i).boundingBox();
    const vw = p.viewportSize().width;
    if (await p.locator('.case-card:not(.case-card--preview)').count() !== 3 || !box || box.width < vw * 0.75 || box.x < -2 || box.x + box.width > vw + 2) throw new Error(`phone should show the chosen roster in full in the rail: ${JSON.stringify(box)}`);
    if (await p.evaluate(() => localStorage.getItem('major-mayhem-run-v2')) !== saved) throw new Error('browsing rosters should not draft a player or alter the run');
  }
  await p.keyboard.press('1');
  await p.waitForFunction(() => document.activeElement?.classList.contains('prow'), null, { timeout: 3000 });
  if (await tabs.first().getAttribute('aria-pressed') !== 'true') throw new Error('roster keyboard shortcut must expose its roster before focusing a player');
  console.log('phone draft: visible roster summaries, navigation and keyboard focus ok errors:', errs);
  if (errs.length) problems.push(`phone draft: page errors: ${errs.join(' | ')}`);
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
  await p.waitForSelector('button.cta'); await p.waitForTimeout(400);
  if ((await p.evaluate(() => window.__ctxs.length)) !== 0) throw new Error('an audio context was created before any click');
  if (!(await heard(() => p.locator('button.mbtn', { hasText: 'Start free play' }).click()))) throw new Error('a button click made no sound');
  if (!(await p.evaluate(() => window.__ctxs[0]))) throw new Error('the audio context was created before user activation');
  const reel = await heard(() => p.locator('button.cta', { hasText: 'Open case' }).click({ force: true }), 3300);
  if (reel < 25) throw new Error(`the case reel should tick and chime, heard ${reel} notes`);
  await p.locator('[aria-label="Turn sound off"]').click();
  await p.waitForSelector('.reroll-row .ghost-btn');
  if (await heard(() => p.locator('.reroll-row .ghost-btn').click(), 600)) throw new Error('muted, but a reroll still made sound');
  await p.reload(); await p.waitForSelector('[aria-label="Turn sound on"]');
  if (await heard(async () => { await openMenu(p); await p.locator('[aria-label="Your stats"]').click(); })) throw new Error('mute did not survive a reload');
  await p.keyboard.press('Escape');
  await p.locator('[aria-label="Turn sound on"]').click();
  await openGuess(p);
  // A reveal takes about two seconds with motion on, so the six notes are counted with reduced motion, where they play together.
  await p.emulateMedia({ reducedMotion: 'reduce' });
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
await draftui();
await sound();
await guess();
await guessMotion();
await settingsAndKeys();
await tips();
await dataSafety();
await keyboardDraft();
await runGuards();
await phoneDraft();
await b.close();
if (problems.length) { console.error('FAIL\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('OK');
