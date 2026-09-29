// Fetches missing player photos and team logos from bo3.gg's public pages with headless Chromium.
// Certificate checking stays ON: run with NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt behind the agent proxy.
// Only entries that are missing from assets-src/ are fetched. A photo is kept only if the page's own player
// name matches the nick (or the real name in the page title); everything else is listed in shots/bo3-review.json.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');

const BO3 = 'assets-src/major-mayhem-bo3.json';
const pid = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
const rosters = JSON.parse(fs.readFileSync('src/data/rosters.json', 'utf8'));
const bo3 = JSON.parse(fs.readFileSync(BO3, 'utf8'));
const other = JSON.parse(fs.readFileSync('assets-src/major-mayhem-assets.json', 'utf8'));
const have = new Set([...Object.keys(bo3.players), ...Object.keys(other.players)].map(pid));
const haveLogo = new Set([...Object.keys(bo3.teams), ...Object.keys(other.logos)]);
const BO3_WRONG = new Set(['huNter-']);

const nicks = [...new Set(rosters.rosters.flatMap((r) => r.players.map((p) => p.nick)))].filter((n) => !have.has(pid(n)));
const orgs = [...new Set(rosters.rosters.map((r) => r.org))].filter((o) => !haveLogo.has(o));
const only = process.argv.slice(2);
const wanted = (n) => !only.length || only.includes(n);
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

fs.mkdirSync('shots', { recursive: true });
const review = [];
const browser = await chromium.launch({ headless: true, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const grab = async (url) => {
  const r = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  return r && r.status() < 400;
};
const dataOf = async (src) => {
  const r = await ctx.request.get(src);
  if (!r.ok()) return null;
  const type = r.headers()['content-type'] || 'image/webp';
  return `data:${type.split(';')[0]};base64,${(await r.body()).toString('base64')}`;
};

for (const nick of nicks.filter(wanted)) {
  const url = `https://bo3.gg/players/${slug(nick)}`;
  try {
    if (BO3_WRONG.has(nick) || !(await grab(url))) { review.push({ nick, why: 'no page' }); continue; }
    const info = await page.evaluate(() => {
      const h1 = document.querySelector('h1')?.textContent?.trim() || '';
      const imgs = [...document.querySelectorAll('img')].map((i) => ({ src: i.currentSrc || i.src, alt: i.alt || '', w: i.naturalWidth, h: i.naturalHeight }));
      return { title: document.title, h1, imgs };
    });
    const label = norm(info.h1 + ' ' + info.title);
    if (!label.includes(norm(nick))) { review.push({ nick, why: 'name mismatch', h1: info.h1, title: info.title }); continue; }
    // the player photo is the large image whose alt text names the player
    const cand = info.imgs.filter((i) => i.src && norm(i.alt).includes(norm(nick)) && i.w >= 200 && !/logo|flag/i.test(i.src));
    if (!cand.length) { review.push({ nick, why: 'no photo on page', h1: info.h1 }); continue; }
    const data = await dataOf(cand[0].src);
    if (!data) { review.push({ nick, why: 'photo download failed', src: cand[0].src }); continue; }
    bo3.players[nick] = { page: url, name: info.h1 || nick, data };
    console.log('photo', nick, '->', info.h1, cand[0].w + 'x' + cand[0].h);
  } catch (e) {
    review.push({ nick, why: String(e.message).slice(0, 120) });
  }
}

for (const org of orgs.filter(wanted)) {
  const url = `https://bo3.gg/teams/${slug(org)}`;
  try {
    if (!(await grab(url))) { review.push({ org, why: 'no page' }); continue; }
    const info = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent?.trim() || '', title: document.title, imgs: [...document.querySelectorAll('img')].map((i) => ({ src: i.currentSrc || i.src, alt: i.alt || '', w: i.naturalWidth })) }));
    if (!norm(info.h1 + info.title).includes(norm(org).slice(0, 6))) { review.push({ org, why: 'name mismatch', h1: info.h1 }); continue; }
    const cand = info.imgs.filter((i) => i.src && norm(i.alt).includes(norm(org).slice(0, 6)) && i.w >= 40);
    if (!cand.length) { review.push({ org, why: 'no logo on page' }); continue; }
    const data = await dataOf(cand[0].src);
    if (!data) { review.push({ org, why: 'logo download failed' }); continue; }
    bo3.teams[org] = { page: url, data };
    console.log('logo', org, cand[0].w + 'px');
  } catch (e) {
    review.push({ org, why: String(e.message).slice(0, 120) });
  }
}

await browser.close();
bo3.retrieved = new Date().toISOString();
fs.writeFileSync(BO3, JSON.stringify(bo3));
fs.writeFileSync('shots/bo3-review.json', JSON.stringify(review, null, 1));
console.log('missing players', nicks.length, 'orgs', orgs.length, '| needs review', review.length, '(shots/bo3-review.json)');
