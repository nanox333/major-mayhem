// Fetches missing player photos and team logos from bo3.gg's public pages (server-rendered, so no browser needed).
// Certificate checking stays ON: run with NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt behind the agent proxy.
// Only entries missing from assets-src/ are fetched. A photo is kept only if the page title names the player
// (nick, with the real name in brackets); everything else is listed in shots/bo3-review.json for a human.
import fs from 'fs';
import { execFile } from 'child_process';

const BO3 = 'assets-src/major-mayhem-bo3.json';
const pid = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
const rosters = JSON.parse(fs.readFileSync('src/data/rosters.json', 'utf8'));
const bo3 = JSON.parse(fs.readFileSync(BO3, 'utf8'));
const other = JSON.parse(fs.readFileSync('assets-src/major-mayhem-assets.json', 'utf8'));
const have = new Set([...Object.keys(bo3.players), ...Object.keys(other.players)].map(pid));
const LOGO_DROP = new Set(['Team Spirit', 'Team Dignitas']); // same list as build-media.mjs: wrong orgs in the Commons bundle
const haveLogo = new Set([...Object.keys(bo3.teams), ...Object.keys(other.logos).filter((k) => !LOGO_DROP.has(k))]);
const BO3_WRONG = new Set(['huNter-']);

const nicks = [...new Set(rosters.rosters.flatMap((r) => r.players.map((p) => p.nick)))].filter((n) => !have.has(pid(n)));
const orgs = [...new Set(rosters.rosters.map((r) => r.org))].filter((o) => !haveLogo.has(o));
const only = process.argv.slice(2);
const wanted = (n) => !only.length || only.includes(n);
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9_]+/g, '-').replace(/^-|-$/g, ''); // bo3.gg keeps underscores
// slugs that can't be derived from the nick / org name (bo3.gg's own URLs)
const PLAYER_SLUG = { saffee: 'saffe', frozen: 'frozen-david-cernansky', xertioN: 'xertionic', 910: 'player-910', kNg: 'kngv' };
const TEAM_SLUG = { 'Luminosity Gaming': 'luminosity-cs-go', AVANGAR: 'avangar-cs-go', 'Team LDLC.com': 'ldlc-cs-go', 'Copenhagen Flames': 'cph-flames', 'Team Dignitas': 'dignitas', 'LGB eSports': 'lgb-cs-go', 'SK Gaming': 'sk', 'NRG Esports': 'nrg' };
// team page titles use short names ("SK", "NRG")
const TEAM_TITLE = { 'Team Dignitas': 'Dignitas', 'SK Gaming': 'SK', 'NRG Esports': 'NRG', 'Luminosity Gaming': 'Luminosity', 'Team LDLC.com': 'LDLC', 'LGB eSports': 'LGB' };
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

fs.mkdirSync('shots', { recursive: true });
const review = [];
// plain curl (normal certificate checking; bo3.gg serves the rendered page to it, but only a JS shell to fetch())
const curl = (url) => new Promise((res) => execFile('curl', ['-sS', '--fail', '--max-time', '40', url], { encoding: 'buffer', maxBuffer: 64 << 20 }, (e, out) => res(e ? null : out)));
const html = async (url) => { const b = await curl(url); return b ? b.toString('utf8') : null; };
const img = async (url) => { const b = await curl(url); return b && b.length > 500 ? `data:image/webp;base64,${b.toString('base64')}` : null; };
const titleOf = (h) => (h.match(/<title>([^<]*)/)?.[1] || '').replace(/&amp;/g, '&').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const nick of nicks.filter(wanted)) {
  const url = `https://bo3.gg/players/${PLAYER_SLUG[nick] || slug(nick)}`;
  try {
    await sleep(1500);
    const h = BO3_WRONG.has(nick) ? null : await html(url);
    if (!h) { review.push({ nick, why: 'no page' }); continue; }
    const title = titleOf(h);
    if (!norm(title.split('(')[0]).includes(norm(nick)) && norm(title.split('(')[0]) !== norm(nick)) { review.push({ nick, why: 'name mismatch', title }); continue; }
    const ids = [...new Set([...h.matchAll(/uploads\/player\/(\d+)\/image\/([^"'\\ ?&)]+)/g)].map((m) => m[0]))];
    if (ids.length !== 1) { review.push({ nick, why: ids.length ? 'several player images' : 'no photo on page', title, ids }); continue; }
    const data = await img(`https://image-proxy.bo3.gg/${ids[0]}?w=400&h=400`);
    if (!data) { review.push({ nick, why: 'photo download failed', title }); continue; }
    bo3.players[nick] = { page: url, name: title.replace(/\s+CS2 Stats.*$/, ''), data };
    console.log('photo', nick, '->', title);
  } catch (e) {
    review.push({ nick, why: String(e.message).slice(0, 120) });
  }
}

const teamSlugs = (o) => [...new Set([...(TEAM_SLUG[o] ? [TEAM_SLUG[o]] : []), slug(o), slug(o.replace(/ (Esports|eSports|Gaming|Team)$/i, '')), slug(o.replace(/^Team /i, '')), slug(o.replace(/\.com/i, ''))])];
for (const org of orgs.filter(wanted)) {
  try {
    let found = null;
    for (const sl of teamSlugs(org)) { await sleep(1500); const h = await html(`https://bo3.gg/teams/${sl}`); if (h) { found = { h, url: `https://bo3.gg/teams/${sl}` }; break; } }
    if (!found) { review.push({ org, why: 'no page', tried: teamSlugs(org) }); continue; }
    const title = titleOf(found.h);
    if (!norm(title).startsWith(norm(TEAM_TITLE[org] || org).slice(0, 5))) { review.push({ org, why: 'name mismatch', title }); continue; }
    // the page also shows opponents' logos; the team's own logo is the image that appears most often
    const count = {};
    for (const m of found.h.matchAll(/uploads\/team\/(\d+)\/image\/([^"'\\ ?&)]+)/g)) count[m[0]] = (count[m[0]] || 0) + 1;
    const ids = Object.entries(count).sort((a, b) => b[1] - a[1]);
    if (!ids.length || (ids[1] && ids[1][1] === ids[0][1])) { review.push({ org, why: ids.length ? 'logo ambiguous' : 'no logo on page', title, ids }); continue; }
    ids[0] = ids[0][0];
    const data = await img(`https://image-proxy.bo3.gg/${ids[0]}`);
    if (!data) { review.push({ org, why: 'logo download failed', title }); continue; }
    bo3.teams[org] = { page: found.url, data };
    console.log('logo', org, '->', title);
  } catch (e) {
    review.push({ org, why: String(e.message).slice(0, 120) });
  }
}

bo3.retrieved = new Date().toISOString();
fs.writeFileSync(BO3, JSON.stringify(bo3));
fs.writeFileSync('shots/bo3-review.json', JSON.stringify(review, null, 1));
console.log('missing players', nicks.length, 'orgs', orgs.length, '| needs review', review.length, '(shots/bo3-review.json)');
