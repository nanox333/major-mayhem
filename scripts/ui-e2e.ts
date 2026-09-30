import assert from 'node:assert/strict';
import { chromium, Page } from 'playwright';
import fs from 'node:fs';
import { preview } from 'vite';
import * as G from '../src/game/logic';
import { fresh, reducer, Run, roundOf, KEY } from '../src/game/state';

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

async function load(p: Page, run: Run, prefs: Record<string, unknown> = {}) {
  await p.goto(base);
  await p.evaluate(({ key, run, prefs }) => {
    localStorage.clear(); localStorage.setItem(key, JSON.stringify(run));
    localStorage.setItem('mm-prefs', JSON.stringify(prefs)); localStorage.setItem('mm-tips', 'false');
  }, { key: KEY, run, prefs });
  await p.reload();
}
const saved = (p: Page) => p.evaluate(key => localStorage.getItem(key), KEY);
async function fits(p: Page) { assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow'); }
try {
  for (const width of [1440, 375, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 900 }, reducedMotion: 'reduce' });
    const errors: string[] = [];
    const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message));
    await load(p, opened);
    await p.locator('button.prow').first().click();
    const before = await saved(p);
    const picked = await p.locator('.draftbar__who').innerText();
    await p.getByRole('button', { name: /^View roster:/ }).first().click();
    const dialog = p.getByRole('dialog'); await dialog.waitFor();
    assert.equal(await dialog.locator('.roster-people li').count(), 5);
    await p.keyboard.press('1');
    assert.equal(await saved(p), before, 'a dialog shortcut changed the draft');
    await p.keyboard.press('Escape');
    assert.equal(await saved(p), before);
    assert.equal(await p.locator('.draftbar__who').innerText(), picked);
    if (width < 861) {
      await p.getByRole('button', { name: /^Your lineup/ }).click();
      await p.getByRole('dialog', { name: 'Your lineup' }).waitFor();
      assert.equal(await p.getByRole('dialog').locator('.lineup__rows li').count(), 7);
      await p.keyboard.press('Escape');
      assert(await p.getByRole('button', { name: /^Your lineup/ }).evaluate(e => e === document.activeElement));
      assert.equal(await saved(p), before);
    }
    await fits(p); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `shots/ui/draft-${width}.png`, fullPage: true });
    await p.locator('.draftbar .cta').click();
    await p.getByRole('button', { name: 'Open case', exact: true }).waitFor();

    await load(p, { ...opened, opts: { hard: true } });
    await p.getByRole('button', { name: /^View roster:/ }).first().click();
    assert((await p.getByRole('dialog').innerText()).includes('Role hints are hidden'));
    assert(!await p.getByRole('dialog').locator('.roster-people').innerText().then(t => t.includes('AWPer')));
    await p.keyboard.press('Escape');

    await load(p, start);
    await p.getByRole('button', { name: 'Explore Major rosters', exact: true }).click();
    await p.getByRole('searchbox', { name: 'Team or player' }).fill('no such roster');
    await p.getByRole('button', { name: 'Clear filters' }).click();
    await p.getByRole('searchbox', { name: 'Team or player' }).fill('Natus');
    assert(await p.locator('.roster-list li').count() > 0);
    await fits(p); await p.keyboard.press('Escape');

    const preview = reducer(reducer(draft(start), { type: 'play' }), { type: 'start' });
    await load(p, preview);
    assert.equal(await p.locator('.veto__map .map-art').count(), 7);
    await fits(p); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `shots/ui/veto-${width}.png`, fullPage: true });

    const bo3 = { ...preview, current: G.seeded('ui-veto', () => G.startMatch('QF', G.lineupFromPicks(preview.picks), preview.current!.opponentId, 3)) };
    await load(p, bo3);
    while (await p.locator('.veto').count()) await p.locator('.veto__map button:not(:disabled)').first().click();
    assert.equal(await p.locator('.veto-series li').count(), 3);
    await fits(p);

    await load(p, live);
    await p.getByRole('button', { name: '❚❚ Pause', exact: true }).click();
    await p.getByRole('button', { name: 'Next round ›', exact: true }).click();
    if (await p.getByRole('button', { name: 'Save (eco)', exact: true }).isVisible()) await p.getByRole('button', { name: 'Save (eco)', exact: true }).click();
    await p.getByRole('button', { name: 'Earlier rounds', exact: true }).click();
    await p.getByRole('button', { name: 'Return to live', exact: true }).click();
    await fits(p); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `shots/ui/live-${width}.png`, fullPage: true });
    await p.reload(); assert(await p.getByRole('button', { name: '▶ Resume', exact: true }).count() === 1, 'pause lost on reload');
    await p.getByRole('button', { name: '▶ Resume', exact: true }).click();
    await p.getByRole('button', { name: 'How to play and data sources', exact: true }).click();
    const seen = await p.evaluate(() => localStorage.getItem('mm-seen'));
    await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => localStorage.getItem('mm-seen')), seen, 'dialog advanced playback');
    await p.keyboard.press('Escape');
    await p.getByRole('button', { name: '❚❚ Pause', exact: true }).click();
    assert(await p.getByRole('button', { name: '▶ Resume', exact: true }).count() === 1);


    await load(p, { ...final, recorded: true });
    await p.getByText('Pick strength', { exact: true }).first().waitFor();
    if (width < 861) assert.equal(await p.locator('.analysis-section[open]').count(), 0);
    await p.locator('.analysis-section summary').last().click();
    assert(await p.locator('.final__actions').evaluate(e => getComputedStyle(e).position === 'static'), 'Play again obscures result analysis');
    await fits(p); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `shots/ui/results-${width}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`UI flows passed at ${width}px`);
  }
  const p = await browser.newPage({ reducedMotion: 'no-preference' });
  await load(p, start);
  await p.getByRole('button', { name: "Start today's run", exact: true }).click();
  await p.getByRole('button', { name: 'Show case', exact: true }).click();
  await p.locator('.case-card').first().waitFor();
  const dealt = JSON.parse((await saved(p))!);
  await p.waitForTimeout(3000);
  assert.equal(JSON.parse((await saved(p))!).offerKey, dealt.offerKey, 'late reel timer changed the case');
  await load(p, start, { fastReveals: true });
  await p.getByRole('button', { name: "Start today's run", exact: true }).click();
  await p.locator('.case-card').first().waitFor();
  assert.equal(await p.locator('.reel').count(), 0);
  assert.deepEqual(JSON.parse((await saved(p))!).offer, dealt.offer, 'fast reveal changed the dealt offer');
  await p.close();
} finally {
  await browser.close();
  if (server) await new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
