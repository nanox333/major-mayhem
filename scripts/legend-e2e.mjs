import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdir } from 'node:fs/promises';

const server = process.env.UI_BASE_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 4183, strictPort: true } });
const base = process.env.UI_BASE_URL ?? 'http://127.0.0.1:4183';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
await mkdir('shots/legend', { recursive: true });
const errors = [];
async function pageFor(viewport, reducedMotion = 'no-preference') {
  const page = await browser.newPage({ viewport, reducedMotion });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/?debug`);
  await page.getByRole('button', { name: 'Debug', exact: true }).click();
  await page.getByRole('tab', { name: 'Effects', exact: true }).click();
  return page;
}
try {
  for (const [name, viewport, asset] of [
    ['desktop', { width: 1280, height: 720 }, 'noscope.mp4'],
    ['phone', { width: 390, height: 844 }, 'noscope-portrait.mp4'],
  ]) {
    const page = await pageFor(viewport);
    await page.getByRole('button', { name: 'No-scope', exact: true }).nth(1).click();
    await page.waitForFunction(() => document.querySelector('.lg3d')?.cinematicVideo?.readyState >= 2);
    assert.ok((await page.locator('.lg3d').evaluate(c => c.cinematicVideo.src)).endsWith(asset));
    assert.equal(await page.locator('video').count(), 0);
    assert.equal(await page.locator('.lg3d').evaluate(c => c.cinematicVideo.isConnected), false);
    await page.getByRole('slider', { name: 'Time' }).fill('2.5');
    await page.waitForFunction(() => { const v = document.querySelector('.lg3d')?.cinematicVideo; return !v.seeking && Math.abs(v.currentTime - 2.5) < .002; });
    await page.getByRole('button', { name: 'Forward one frame' }).click();
    await page.waitForFunction(() => { const v = document.querySelector('.lg3d')?.cinematicVideo; return !v.seeking && Math.abs(v.currentTime - (2.5 + 1 / 30)) < .002; });
    await page.screenshot({ path: `shots/legend/${name}-scrub.png` });
    await page.getByRole('button', { name: 'Close', exact: true }).last().click();
    await page.getByRole('button', { name: 'No-scope', exact: true }).first().click();
    await page.waitForFunction(() => { const v = document.querySelector('.legend .lg3d')?.cinematicVideo; return v && !v.paused && v.currentTime > .1; });
    await page.waitForFunction(() => document.querySelector('.legend .lg3d')?.cinematicVideo?.currentTime > 4.2);
    await page.screenshot({ path: `shots/legend/${name}-card.png` });
    assert.equal(await page.locator('.legend__pic img').evaluate(img => getComputedStyle(img).pointerEvents), 'none');
    assert.equal(await page.locator('.legend__pic img').evaluate(img => { const r = img.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === img; }), false);
    await page.locator('.legend').waitFor({ state: 'detached', timeout: 7000 });
    await page.close();
    console.log(`${name}: playback, frame seeking, card and completion passed`);
  }
  const delayed = await pageFor({ width: 1280, height: 720 });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await delayed.route('**/legend/*.mp4', async route => { await gate; await route.continue(); });
  await delayed.getByRole('button', { name: 'No-scope', exact: true }).first().click();
  await delayed.locator('.legend.is-loading').waitFor();
  assert.equal(await delayed.locator('.legend__card').evaluate(el => getComputedStyle(el).animationPlayState), 'paused');
  release();
  await delayed.waitForFunction(() => document.querySelector('.legend') && !document.querySelector('.legend.is-loading'));
  await delayed.getByRole('button', { name: 'Continue', exact: true }).click();
  await delayed.locator('.legend').waitFor({ state: 'detached' });
  await delayed.close();
  console.log('Delayed load: animations wait; skip closes the overlay');

  const failed = await pageFor({ width: 390, height: 844 });
  await failed.route('**/legend/*.mp4', route => route.abort());
  await failed.getByRole('button', { name: 'No-scope', exact: true }).first().click();
  await failed.locator('.legend.is-still').waitFor();
  assert.equal(await failed.locator('.legend .lg3d').count(), 0);
  await failed.locator('.legend').waitFor({ state: 'detached', timeout: 5000 });
  await failed.close();
  console.log('Failed video: static card and completion passed');

  const reduced = await pageFor({ width: 390, height: 844 }, 'reduce');
  let requests = 0;
  reduced.on('request', request => { if (request.url().endsWith('.mp4')) requests++; });
  await reduced.getByRole('button', { name: 'No-scope', exact: true }).first().click();
  await reduced.locator('.legend.is-still').waitFor();
  assert.equal(await reduced.locator('.legend .lg3d').count(), 0);
  assert.equal(requests, 0);
  await reduced.getByRole('button', { name: 'Continue', exact: true }).click();
  await reduced.locator('.legend').waitFor({ state: 'detached' });
  await reduced.close();
  assert.deepEqual(errors, []);
  console.log('Reduced motion: no video requested; no page errors');
} finally {
  await browser.close();
  await server?.close();
}
