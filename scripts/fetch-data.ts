/**
 * Setup step: fetch each Major's page once, cache it in data/cache/, and check every roster in
 * src/data/rosters.ts against it. The game never fetches anything at runtime.
 *
 *   npm run fetch-data                       # Wikipedia (default source)
 *   npm run fetch-data -- --source liquipedia
 *   npm run fetch-data -- --refresh          # ignore the cache
 *
 * Liquipedia API rules followed here (https://liquipedia.net/api-terms-of-use):
 * a descriptive User-Agent with contact info, gzip, one request at a time, and at most
 * one request every 2 seconds for action=query. Set CONTACT to your email or site before running.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROSTERS } from '../src/data/rosters';

const args = process.argv.slice(2);
const source = args.includes('--source') ? args[args.indexOf('--source') + 1] : 'wikipedia';
const refresh = args.includes('--refresh');
const contact = process.env.CONTACT ?? 'set-CONTACT-env-var';
const UA = `MajorMayhem/1.0 (fan game; ${contact})`;

// Wikipedia page title -> Liquipedia page title for the same event (best-guess titles;
// the script reports any page that does not resolve so you can correct it).
const LIQUIPEDIA: Record<string, string> = {
  EMS_One_Katowice_2014: 'EMS_One/2014/Katowice',
  ESL_One_Cologne_2014: 'ESL/One/2014/Cologne',
  ESL_One_Katowice_2015: 'ESL/One/2015/Katowice',
  'DreamHack_Open_Cluj-Napoca_2015': 'DreamHack/2015/Cluj-Napoca',
  'MLG_Major_Championship:_Columbus': 'MLG/2016/Columbus',
  ESL_One_Cologne_2016: 'ESL/One/2016/Cologne',
  ELEAGUE_Major_2017: 'ELEAGUE/2017/Major',
  'PGL_Major:_Krak%C3%B3w_2017': 'PGL/2017/Krakow',
  'ELEAGUE_Major:_Boston_2018': 'ELEAGUE/2018/Major',
  'FACEIT_Major:_London_2018': 'FACEIT/2018/Major',
  IEM_Katowice_Major_2019: 'Intel_Extreme_Masters/Season_XIII/Katowice',
  'StarLadder_Major:_Berlin_2019': 'StarLadder/2019/Major',
  PGL_Major_Stockholm_2021: 'PGL/2021/Stockholm',
  PGL_Major_Antwerp_2022: 'PGL/2022/Antwerp',
  IEM_Rio_Major_2022: 'Intel_Extreme_Masters/2022/Rio',
  PGL_Major_Copenhagen_2024: 'PGL/2024/Copenhagen',
  Perfect_World_Shanghai_Major_2024: 'Perfect_World/Major/2024/Shanghai',
  StarLadder_Budapest_Major_2025: 'StarLadder/2025/Major',
  IEM_Cologne_Major_2026: 'Intel_Extreme_Masters/2026/Cologne',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cacheDir = path.join('data', 'cache', source);
fs.mkdirSync(cacheDir, { recursive: true });

async function wikitext(wikiTitle: string): Promise<string | null> {
  const title = source === 'liquipedia' ? LIQUIPEDIA[wikiTitle] : decodeURIComponent(wikiTitle);
  if (!title) return null;
  const file = path.join(cacheDir, `${title.replace(/[^\w.-]+/g, '_')}.json`);
  if (!refresh && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')).wikitext;
  const base = source === 'liquipedia' ? 'https://liquipedia.net/counterstrike/api.php' : 'https://en.wikipedia.org/w/api.php';
  const url = `${base}?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&redirects=1&titles=${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip' } });
  await sleep(source === 'liquipedia' ? 2100 : 1000);
  if (!res.ok) { console.warn(`  ${res.status} for ${title}`); return null; }
  const json: any = await res.json();
  const page = json?.query?.pages?.[0];
  const text: string | undefined = page?.revisions?.[0]?.slots?.main?.content;
  if (!text) { console.warn(`  no content for ${title}`); return null; }
  fs.writeFileSync(file, JSON.stringify({ title, source, url, retrievedAt: new Date().toISOString(), wikitext: text }));
  return text;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const byPage = new Map<string, typeof ROSTERS>();
for (const r of ROSTERS) {
  const page = r.sourceUrl.split('/wiki/')[1];
  byPage.set(page, [...(byPage.get(page) ?? []), r]);
}

let problems = 0;
for (const [page, rosters] of byPage) {
  console.log(`${source}: ${decodeURIComponent(page)}`);
  const text = await wikitext(page);
  if (!text) { problems++; continue; }
  const hay = norm(text);
  for (const r of rosters) {
    const missing = r.players.filter((p) => !hay.includes(norm(p.nick)));
    if (missing.length) { problems++; console.log(`  ✗ ${r.org} ${r.year}: not found on page: ${missing.map((p) => p.nick).join(', ')}`); }
    else console.log(`  ✓ ${r.org} ${r.year}`);
  }
}
console.log(problems ? `\n${problems} item(s) need a look.` : '\nAll rosters matched their source pages.');
