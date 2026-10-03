import assert from 'node:assert/strict';
import { chromium, Page } from 'playwright';
import fs from 'node:fs';
import { preview } from 'vite';
import * as G from '../src/game/logic';
import { fresh, reducer, Run, roundOf, KEY, today } from '../src/game/state';
import { Stats, STATS_KEY, emptyStats, addRun } from '../src/game/stats';
import { TIP_IDS } from '../src/ui/tips';

const server = process.env.UI_BASE_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 4174, strictPort: true } });
server?.httpServer.unref();
const base = process.env.UI_BASE_URL ?? 'http://127.0.0.1:4174';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
fs.mkdirSync('shots/ui', { recursive: true });

function draft(start: Run) {
  let s = start;
  while (s.phase === 'draft') {
    s = reducer(s, { type: 'spin' });
    if (roundOf(s) === 'coach') { s = reducer(s, { type: 'coach', rosterId: s.offer[0] }); continue; }
    const bench = roundOf(s) === 'bench';
    const r = s.offer.map(id => G.rosterById.get(id)!).find(r => r.players.some(p => bench ? !G.draftedIds(s.picks).has(p.id) : G.eligibleSlots(p, s.picks).length))!;
    const p = r.players.find(p => bench ? !G.draftedIds(s.picks).has(p.id) : G.eligibleSlots(p, s.picks).length)!;
    s = reducer(s, { type: 'team', id: r.id });
    s = reducer(s, bench ? { type: 'bench', player: p } : { type: 'draft', player: p, slot: G.eligibleSlots(p, s.picks)[0] });
  }
  return s;
}
function veto(s: Run) {
  while (G.vetoTurn(s.current!.veto)) s = reducer(s, { type: 'veto', map: G.vetoChoice(s.current!.veto, 'us', G.lineupFromPicks(s.picks), G.naturalLineup(G.rosterById.get(s.current!.opponentId)!)) });
  return s;
}
const start = { ...fresh('free'), seed: 'ui-followups' };
const opened = reducer(start, { type: 'spin' });
let live = veto(reducer(reducer(draft(start), { type: 'play' }), { type: 'start' }));
live = reducer(live, { type: 'side', side: G.autoSide(live.current!.next!) });
let final = reducer(draft(start), { type: 'play' });
while (final.phase !== 'final') {
  final = veto(reducer(final, { type: 'start' }));
  while (!final.current!.done) final = reducer(final, { type: 'side', side: G.autoSide(final.current!.next!) });
  final = reducer(final, { type: 'next' });
}

async function load(p: Page, run: Run, prefs: Record<string, unknown> = {}, stats: Stats = emptyStats()) {
  await p.goto(base);
  await p.evaluate(({ key, run, prefs, tips, statsKey, stats }) => {
    localStorage.clear(); localStorage.setItem(key, JSON.stringify(run)); localStorage.setItem(statsKey, JSON.stringify(stats));
    localStorage.setItem('mm-prefs', JSON.stringify(prefs)); localStorage.setItem('mm-tips', JSON.stringify(tips));
  }, { key: KEY, run, prefs, tips: run.offerKey > 0 ? TIP_IDS : [], statsKey: STATS_KEY, stats });
  await p.reload();
  // The site always opens on the home; a saved run is one Continue away.
  const resume = p.getByRole('button', { name: /^(Continue|View your)/ });
  if (run.offerKey > 0 && await resume.count()) await resume.first().click();
}
/**
 * What a phone user would trip over on the screen that is open (#263): sideways scrolling, controls under 40px, text under 11px, and a fixed or sticky bar
 * that sits on top of the last thing on the page once scrolled to the bottom. Hidden-for-screen-readers text and zero-size labels are skipped.
 */
async function phoneProblems(p: Page): Promise<string[]> {
  await p.evaluate('window.__name = window.__name || ((f) => f)'); // tsx wraps the named helpers below in __name(), which the page does not have
  return p.evaluate(() => {
    const out: string[] = [];
    const shown = (e: Element) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && c.opacity !== '0'; };
    const name = (e: Element) => `${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} "${(e.textContent || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24)}"`;
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`sideways scroll: ${document.documentElement.scrollWidth}px of ${innerWidth}px`);
    document.querySelectorAll('a[href], button, [role="tab"], input:not([type="hidden"]), select, summary').forEach((e) => {
      if (!shown(e) || e.closest('.sr, [class*="dbg"]')) return;
      const r = e.getBoundingClientRect();
      if (Math.min(r.width, r.height) < 40) out.push(`target ${Math.round(r.width)}x${Math.round(r.height)}: ${name(e)}`);
    });
    const words = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = words.nextNode(); n; n = words.nextNode()) {
      const el = n.parentElement;
      if (!n.nodeValue?.trim() || !el || !shown(el) || el.closest('.sr, script, style, [class*="dbg"]')) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size > 0 && size < 11) out.push(`text ${size.toFixed(1)}px: ${name(el)}`);
    }
    scrollTo(0, document.documentElement.scrollHeight);
    const last = document.querySelector('footer.foot') ?? document.body.lastElementChild;
    const ends = document.createRange();
    if (last) ends.selectNodeContents(last);
    const lastBox = last ? ends.getBoundingClientRect() : undefined; // the content of the last block, not its padding
    document.querySelectorAll('body *').forEach((e) => {
      const c = getComputedStyle(e);
      if ((c.position !== 'fixed' && c.position !== 'sticky') || !shown(e) || e.closest('.modal, [class*="dbg"], .topbar')) return;
      const r = e.getBoundingClientRect();
      if (r.bottom < innerHeight - 4 || r.height > innerHeight / 2 || !lastBox) return;
      if (r.top < lastBox.bottom && r.bottom > lastBox.top && !last?.contains(e)) out.push(`bar covers the end of the page: ${name(e)}`);
    });
    scrollTo(0, 0);
    return [...new Set(out)];
  });
}
const saved = (p: Page) => p.evaluate(key => localStorage.getItem(key), KEY);
/** The left and right edge of the content column. Every screen shares one, so moving through a run never resizes what you are looking at. */
async function contentEdges(p: Page) {
  return p.evaluate(() => { const r = document.querySelector('.console__body, .editorial-home')!.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; });
}
async function fits(p: Page) { assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow'); }
try {
  for (const width of [1440, 375, 320, 768, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 900 }, reducedMotion: 'reduce' });
    const errors: string[] = [];
    const edges: number[][] = [];
    const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message));
    await load(p, start);
    // A dialog locks scrolling, which removes the scrollbar; the gutter stays reserved so the page behind it does not resize.
    assert.equal(await p.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter), 'stable', 'the scrollbar gutter should stay reserved');
    const dailyAction = p.getByRole('button', { name: "Start today's run", exact: true });
    const dailyBox = await dailyAction.boundingBox();
    assert(dailyBox && dailyBox.y >= 0 && dailyBox.y + dailyBox.height <= p.viewportSize()!.height, 'daily action is outside the first viewport');
    assert((await p.locator('.home-daily-status').innerText()).includes('a coach and a bench player'), 'five-starter illustration hid the seven-pick explanation');
    edges.push(await contentEdges(p));
    await fits(p); await p.screenshot({ path: `shots/ui/home-${width}.png`, fullPage: true });
    await load(p, opened);
    await p.locator('button.prow').first().click();
    const before = await saved(p);
    const picked = await p.locator('.draftbar__who').innerText();
    await p.getByRole('button', { name: /^View roster:/ }).first().click();
    const dialog = p.getByRole('dialog'); await dialog.waitFor();
    assert.equal(await dialog.locator('.ra-people li:not(.ra-people__coach)').count(), 5);
    await p.keyboard.press('1');
    assert.equal(await saved(p), before, 'a dialog shortcut changed the draft');
    await p.keyboard.press('Escape');
    assert.equal(await saved(p), before);
    assert.equal(await p.locator('.draftbar__who').innerText(), picked);
    if (width < 861) {
      const rosterTabs = p.getByRole('group', { name: 'Choose a roster to view' }).getByRole('button');
      await rosterTabs.nth(1).click();
      assert.equal(await p.locator('.draftbar__who').innerText(), picked, 'roster navigation silently changed the candidate');
      assert.equal(await saved(p), before, 'roster navigation changed the run');
      await rosterTabs.first().click();
      await p.getByRole('button', { name: /^Your lineup/ }).click();
      await p.getByRole('dialog', { name: 'Your lineup' }).waitFor();
      assert.equal(await p.getByRole('dialog').locator('.lineup__rows li').count(), 7);
      await p.keyboard.press('Escape');
      assert(await p.getByRole('button', { name: /^Your lineup/ }).evaluate(e => e === document.activeElement));
      assert.equal(await saved(p), before);
    }
    edges.push(await contentEdges(p));
    await fits(p); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `shots/ui/draft-${width}.png`, fullPage: true });
    await p.locator('.draftbar .cta').click();
    await p.getByRole('button', { name: 'Open case', exact: true }).waitFor();

    await load(p, { ...opened, opts: { hard: true } });
    await p.getByRole('button', { name: /^View roster:/ }).first().click();
    assert((await p.getByRole('dialog').innerText()).includes('Role hints are hidden'));
    assert(!await p.getByRole('dialog').locator('.ra-people').innerText().then(t => t.includes('AWPer')));
    await p.keyboard.press('Escape');

    await load(p, start);
    await p.getByRole('button', { name: 'Explore Major rosters', exact: true }).click();
    await p.getByRole('searchbox', { name: 'Team or player' }).fill('no such roster');
    await p.getByRole('button', { name: 'Clear filters' }).click();
    await p.getByRole('searchbox', { name: 'Team or player' }).fill('Natus');
    assert(await p.locator('.ra-rows li').count() > 0);
    await fits(p); await p.keyboard.press('Escape');

    const preview = reducer(reducer(draft(start), { type: 'play' }), { type: 'start' });
    await load(p, preview);
    assert.equal(await p.locator('.veto__map .map-art').count(), 7);
    edges.push(await contentEdges(p));
    await fits(p); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `shots/ui/veto-${width}.png`, fullPage: true });

    const bo3 = { ...preview, current: G.seeded('ui-veto', () => G.startMatch('QF', G.lineupFromPicks(preview.picks), preview.current!.opponentId, 3)) };
    await load(p, bo3);
    while (await p.locator('.veto').count()) { const open = p.locator('.veto__map button:not(:disabled)').first(); if (await open.count()) await open.click(); await p.waitForTimeout(200); }
    assert.equal(await p.locator('.veto-series li').count(), 3);
    await fits(p);

    await load(p, live);
    const markers = p.locator('.radar-marker');
    assert.equal(await markers.count(), 10, 'radar must represent both fielded fives');
    const markerRects = await markers.evaluateAll(elements => elements.map(e => {
      const { x, y, width, height } = e.getBoundingClientRect(); return { x, y, width, height };
    }));
    for (let i = 0; i < markerRects.length; i++) {
      const a = markerRects[i];
      assert(a.width >= 44 && a.height >= 44, 'radar marker is too small for touch');
      for (const b of markerRects.slice(i + 1)) assert(
        a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1,
        'radar marker tap targets overlap',
      );
    }
    const markerLabels = await markers.evaluateAll(elements => elements.map(e => e.getAttribute('aria-label')!));
    assert.equal(new Set(markerLabels.map(label => label.split(':')[0])).size, 10, 'radar marker codes are not unique');
    for (const label of markerLabels) assert(label.includes('illustrative') && /, (CT|T),/.test(label), 'radar marker lacks side or positioning context');
    await markers.first().click();
    assert((await p.locator('.radar-detail').innerText()).toLowerCase().includes(markerLabels[0].split(', ')[1].toLowerCase()), 'marker selection does not expose its identity'); // the detail line is set in capitals
    await p.getByRole('button', { name: 'Pause', exact: true }).click();
    await p.getByRole('button', { name: 'Next round ›', exact: true }).click();
    if (await p.locator('.buy__opt--eco').isVisible()) await p.locator('.buy__opt--eco').click();
    await p.getByRole('button', { name: 'All rounds', exact: true }).click();
    await p.getByRole('button', { name: 'Latest only', exact: true }).click();
    edges.push(await contentEdges(p));
    await fits(p); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `shots/ui/live-${width}.png`, fullPage: true });
    await p.reload(); await p.getByRole('button', { name: /^Continue/ }).first().click();
    assert(await p.getByRole('button', { name: 'Resume', exact: true }).count() === 1, 'pause lost on reload');
    await p.getByRole('button', { name: 'Resume', exact: true }).click();
    await p.getByRole('button', { name: 'More', exact: true }).click();
    await p.getByRole('button', { name: 'How to play and data sources', exact: true }).click();
    const seen = await p.evaluate(() => localStorage.getItem('mm-seen'));
    await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => localStorage.getItem('mm-seen')), seen, 'dialog advanced playback');
    await p.keyboard.press('Escape');
    await p.getByRole('button', { name: 'Pause', exact: true }).click();
    assert(await p.getByRole('button', { name: 'Resume', exact: true }).count() === 1);


    await load(p, { ...final, recorded: true });
    await p.getByText('Pick strength', { exact: true }).first().waitFor();
    if (width < 861) assert.equal(await p.locator('.analysis-section[open]').count(), 0);
    await p.locator('.analysis-section summary').last().click();
    assert(await p.locator('.final__actions').evaluate(e => getComputedStyle(e).position === 'static'), 'Play again obscures result analysis');
    edges.push(await contentEdges(p));
    await fits(p); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `shots/ui/results-${width}.png`, fullPage: true });
    assert(edges.every((e) => e[0] === edges[0][0] && e[1] === edges[0][1]), `the content column moves between screens at ${width}px: home, draft, veto, live, results = ${JSON.stringify(edges)}`);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`UI flows passed at ${width}px`);
  }
  // The alternate palette and narrow desktop widths must support the same decisions,
  // not merely change the root preference attribute.
  for (const width of [375, 768]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const p = await context.newPage();
    for (const prefs of [{ theme: 'light' }, { theme: 'dark', contrast: true }]) {
      for (const [name, run] of [['home', start], ['draft', opened], ['live', live], ['results', { ...final, recorded: true }]] as const) {
        await load(p, run, prefs);
        assert.equal(await p.locator('html').getAttribute('data-theme'), prefs.theme);
        if ('contrast' in prefs) assert.equal(await p.locator('html').getAttribute('data-contrast'), 'high');
        await fits(p);
        const primary = name === 'home' ? p.getByRole('button', { name: "Start today's run", exact: true })
          : name === 'draft' ? p.locator('button.prow:visible').first()
          : name === 'live' ? p.getByRole('button', { name: 'Pause', exact: true })
          : p.locator('.share-bar button').first();
        await primary.focus();
        assert(await primary.evaluate(e => e === document.activeElement), `${name} primary control cannot receive keyboard focus`);
        await p.evaluate(() => scrollTo(0, 0));
        await p.screenshot({ path: `shots/ui/${name}-${width}-${prefs.theme}${'contrast' in prefs ? '-contrast' : ''}.png`, fullPage: true });
      }
    }
    await context.close();
    console.log(`Alternate palette checks passed at ${width}px`);
  }
  // Home navigation must retain the identity of an unfinished or completed daily.
  const homeContext = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  const homePage = await homeContext.newPage();
  const day = today();
  const currentDaily = reducer(fresh('daily', day), { type: 'spin' });
  const yesterday = new Date(`${day}T12:00:00`); yesterday.setDate(yesterday.getDate() - 1);
  const oldDay = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  const dailyFinal = { ...final, mode: 'daily' as const, seed: `daily-${day}`, recorded: true };
  const finishedStats = addRun(emptyStats(), dailyFinal);
  const abandonedStats = { ...emptyStats(), daily: { [day]: { placement: 'Abandoned', reached: 0, mvp: '', grade: null, abandoned: true } } };
  for (const [name, run, stats, action] of [
    ['progress', currentDaily, emptyStats(), "Continue today's run"],
    ['old', reducer(fresh('daily', oldDay), { type: 'spin' }), emptyStats(), "Start today's run"],
    ['complete', dailyFinal, finishedStats, 'View your result'],
    ['replay', start, finishedStats, "Replay today's run"],
    ['abandoned', start, abandonedStats, 'Play it anyway'],
  ] as const) {
    await load(homePage, run, { theme: 'dark' }, stats);
    if (!await homePage.locator('.home__daily').count()) await homePage.getByRole('button', { name: 'Major Mayhem: home', exact: true }).click();
    const before = await saved(homePage);
    const shownAction = await homePage.locator('.home__daily').innerText();
    assert(shownAction.toLowerCase().includes(action.toLowerCase()), `${name} daily offers ${shownAction}, expected ${action}`);
    await fits(homePage);
    await homePage.screenshot({ path: `shots/ui/home-state-${name}.png`, fullPage: true });
    if (name === 'progress' || name === 'old' || name === 'complete') {
      if (name === 'old') {
        assert((await homePage.locator('.mcard__old').innerText()).includes(oldDay), 'old daily loses its original date');
        await homePage.locator('.mcard__old .mbtn').click();
      } else await homePage.locator('.home__daily').click();
      assert.equal(await saved(homePage), before, `${name} navigation replaced the saved daily`);
      assert.equal(await homePage.locator('.home__daily').count(), 0, `${name} action did not open its saved run`);
    }
  }
  await homeContext.close();
  console.log('Daily Home state checks passed');
  // A phone pass over every screen at the two common widths (#263).
  for (const width of [360, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 812 }, reducedMotion: 'reduce' });
    const p = await context.newPage();
    const screens: [string, () => Promise<void>][] = [
      ['home', () => load(p, start)],
      ['draft', () => load(p, opened)],
      ['live', () => load(p, live)],
      ['results', () => load(p, { ...final, recorded: true })],
      ['guess', async () => { await load(p, start); await p.locator('.shell-nav .gamelink').click(); }],
      ['archive', async () => { await load(p, start); await p.locator('.shell-nav').getByRole('button', { name: 'Roster archive', exact: true }).click(); }],
      ['settings', async () => { await load(p, start); await p.getByRole('button', { name: 'More', exact: true }).click(); await p.getByRole('button', { name: 'Settings', exact: true }).click(); }],
      ['help', async () => { await load(p, start); await p.getByRole('button', { name: 'More', exact: true }).click(); await p.getByRole('button', { name: 'How to play and data sources', exact: true }).click(); }],
    ];
    for (const [name, open] of screens) {
      await open();
      await p.waitForTimeout(400);
      const problems = await phoneProblems(p);
      assert.deepEqual(problems, [], `${name} at ${width}px:\n  ${problems.join('\n  ')}`);
    }
    await context.close();
    console.log(`Phone checks passed at ${width}px`);
  }
  const p = await browser.newPage({ reducedMotion: 'no-preference' });
  await load(p, start);
  await p.getByRole('button', { name: "Start today's run", exact: true }).click();
  await p.getByRole('button', { name: 'Open case', exact: true }).click();
  await p.getByRole('button', { name: 'Skip animation', exact: true }).click();
  await p.locator('.case-card:not(.case-card--preview)').first().waitFor();
  const dealt = JSON.parse((await saved(p))!);
  await p.waitForTimeout(3000);
  assert.equal(JSON.parse((await saved(p))!).offerKey, dealt.offerKey, 'late reel timer changed the case');
  await load(p, start, { fastReveals: true });
  await p.getByRole('button', { name: "Start today's run", exact: true }).click();
  await p.getByRole('button', { name: 'Open case', exact: true }).click();
  await p.locator('.case-card:not(.case-card--preview)').first().waitFor();
  assert.equal(await p.locator('.reel').count(), 0);
  assert.deepEqual(JSON.parse((await saved(p))!).offer, dealt.offer, 'fast reveal changed the dealt offer');
  await p.close();
} finally {
  await browser.close();
  if (server) await new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
