/** Routine CI: catch startup, asset and navigation failures without simulating a whole tournament. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, Page } from 'playwright';
import { KEY, today } from '../src/game/state';
import { GUESS_KEY, prosOn } from '../src/game/guess';

const html = fs.readFileSync('dist/index.html', 'utf8');
const out = 'shots/smoke';
fs.mkdirSync(out, { recursive: true });
const candidate = [...prosOn(today()).values()][0];
assert(candidate, 'No players available for Guess');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const fits = async (p: Page) => assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal page overflow');
const saved = (p: Page) => p.evaluate(key => localStorage.getItem(key), KEY);

try {
  for (const width of [1280, 375]) {
    const started = performance.now();
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const p = await context.newPage();
    const errors: string[] = [];
    p.on('pageerror', error => errors.push(error.message));
    // Route the actual production file without a server or external services.
    await p.route('http://game.local/**', route => route.fulfill({ contentType: 'text/html', body: html }));
    try {
      await p.goto('http://game.local/');
      const daily = p.getByRole('button', { name: "Start today's run", exact: true });
      await daily.waitFor();
      assert(await p.locator('.home-mode-card--guess').getByRole('button', { name: 'Play now', exact: true }).isVisible());
      await p.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.home-mode-art img')]
        .every(img => img.complete && img.naturalWidth > 0), null, { timeout: 5000 });
      await fits(p);
      await p.screenshot({ path: `${out}/home-${width}.png`, fullPage: true });

      await daily.click();
      // Every round opens from a sealed case; with reduced motion the cards are there as soon as it is opened.
      await p.getByRole('button', { name: 'Open case', exact: true }).click();
      await p.locator('.case-card:visible button.prow').first().click();
      await p.locator('.draftbar .cta').click();
      const run = await saved(p);
      assert.equal(JSON.parse(run!).picks.length, 1, 'A draft pick was not saved');
      await fits(p);

      await p.getByRole('button', { name: 'Major Mayhem: home', exact: true }).click();
      await p.locator('.home-mode-card--guess').getByRole('button', { name: 'Play now', exact: true }).click();
      await p.getByRole('combobox').fill(candidate.nick);
      await p.locator('.guess__suggest button').first().click();
      await p.waitForFunction(key => {
        const history = JSON.parse(localStorage.getItem(key) || '{}');
        return Object.values(history).some(day => (day as { guesses: string[] }).guesses.length === 1);
      }, GUESS_KEY);
      assert.equal(await saved(p), run, 'Guess navigation replaced the unfinished Major');
      await fits(p);
      assert.deepEqual(errors, [], 'Browser errors');
      console.log(`Smoke passed at ${width}px (${((performance.now() - started) / 1000).toFixed(1)}s)`);
    } catch (error) {
      await p.screenshot({ path: `${out}/failure-${width}.png`, fullPage: true }).catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }

  // Page addresses (#222): Back and Forward move between pages, a reload keeps the page, a draft survives leaving it, and the challenge link still works.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const errors: string[] = [];
    const open = async (url: string) => {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('http://game.local/**', route => route.fulfill({ contentType: 'text/html', body: html }));
      await page.goto(url);
      return page;
    };
    const p = await open('http://game.local/');
    try {
      const hash = () => p.evaluate(() => location.hash);
      const home = p.getByRole('button', { name: "Start today's run", exact: true });
      const isHome = async () => { await home.waitFor(); assert.ok(['', '#/'].includes(await hash()), `Home address was ${await hash()}`); };
      await isHome();
      const current = async () => p.locator('[aria-current="page"]').first().innerText();
      // Each page: open it from the header, go Back to the Home, Forward to the page again, and reload on it.
      const pages: [string, () => Promise<void>, ReturnType<typeof p.locator>, string][] = [
        ['Guess the pro', () => p.locator('.shell-nav .gamelink').click(), p.getByRole('combobox'), '#/guess'],
        ['Roster archive', () => p.locator('.shell-nav').getByRole('button', { name: 'Roster archive', exact: true }).click(), p.locator('.ra-intro'), '#/archive'],
        ['Your stats', () => p.getByRole('button', { name: 'Your stats', exact: true }).click(), p.locator('.sp-hero'), '#/stats'],
      ];
      for (const [name, go, marker, want] of pages) {
        await go();
        await marker.waitFor();
        assert.equal(await hash(), want, `${name}: address`);
        await p.goBack(); await isHome();
        await p.goForward(); await marker.waitFor();
        assert.equal(await hash(), want, `${name}: address after Forward`);
        await p.reload(); await marker.waitFor();
        assert.equal(await hash(), want, `${name}: address after reload`);
        await p.goBack(); await isHome();
      }
      assert.match(await current(), /Home/i, 'The Home tab is the current page');
      await p.locator('.shell-nav .gamelink').click();
      assert.match(await current(), /Guess/i, 'The Guess tab follows the page');
      await p.goBack(); await isHome();

      // A draft: starting it is one step in the history, picks add none, and Back keeps the run.
      await home.click();
      await p.getByRole('button', { name: 'Open case', exact: true }).click();
      await p.locator('.case-card:visible button.prow').first().click();
      const before = await p.evaluate(() => history.length);
      await p.locator('.draftbar .cta').click();
      assert.equal(await p.evaluate(() => history.length), before, 'A pick added a history entry');
      assert.equal(await hash(), '#/play');
      const run = await saved(p);
      assert.equal(JSON.parse(run!).picks.length, 1);
      await p.goBack();
      await p.getByRole('button', { name: /Continue/ }).first().waitFor();
      assert.equal(await saved(p), run, 'Back discarded the run');
      await p.goForward();
      await p.getByRole('button', { name: 'Open case', exact: true }).waitFor();
      // A reload on the draft opens the Home, with the run one Continue away.
      await p.reload(); await p.getByRole('button', { name: /Continue/ }).first().waitFor();
      assert.equal(await saved(p), run);
      assert.ok(['', '#/'].includes(await hash()));
      await p.close();

      // An address the game does not know is the Home.
      const lost = await open('http://game.local/#/nope');
      await lost.locator('.home-mode-card--guess').waitFor(); // only the Home has it
      assert.equal(await lost.evaluate(() => location.hash), '#/');
      await lost.close();
      // Opening a page directly.
      const direct = await open('http://game.local/#/guess');
      await direct.getByRole('combobox').waitFor();
      await direct.close();
      // A challenge link opens the invite and is cleared from the address, beside the router.
      const duel = await open('http://game.local/#duel=garbage');
      await duel.getByText("That challenge link doesn't work").waitFor();
      assert.equal(await duel.evaluate(() => location.hash), '');
      await duel.close();
      assert.deepEqual(errors, [], 'Browser errors');
      console.log('Page addresses passed');
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
