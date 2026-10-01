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
} finally {
  await browser.close();
}
