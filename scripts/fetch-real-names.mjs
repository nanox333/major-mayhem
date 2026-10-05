// Fills each person's real name in src/data/rosters.json ("players" table, next to "country") from bo3.gg's public player pages, whose titles read
// "nick (Real Name) CS2 Stats". A name is only kept when the title names the same nick; anything else is left BLANK and listed in shots/names-review.json
// for a human, never guessed. Names already in the file are kept unless you pass --refresh. Run: node scripts/fetch-real-names.mjs [--refresh] [nick ...]
import fs from 'fs';
import { execFile } from 'child_process';

const FILE = 'src/data/rosters.json';
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const bo3 = JSON.parse(fs.readFileSync('assets-src/major-mayhem-bo3.json', 'utf8'));
const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const only = args.filter((a) => !a.startsWith('--'));
const pid = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
const norm = pid;
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9_]+/g, '-').replace(/^-|-$/g, '');
// bo3.gg URLs that can't be derived from the nick (the same list as fetch-bo3-photos.mjs)
const PLAYER_SLUG = { saffee: 'saffe', frozen: 'frozen-david-cernansky', xertioN: 'xertionic', 910: 'player-910', kNg: 'kngv' };
const ENT = { '&amp;': '&', '&#x27;': "'", '&#39;': "'", '&quot;': '"', '&apos;': "'" };
const decode = (s) => s.replace(/&(amp|quot|apos|#x27|#39);/g, (m) => ENT[m] ?? m);
const curl = (url) => new Promise((res) => execFile('curl', ['-sS', '--fail', '--max-time', '30', url], { encoding: 'buffer', maxBuffer: 16 << 20 }, (e, out) => res(e ? null : out.toString('utf8'))));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const titleOf = (h) => decode((h.match(/<title>([^<]*)/)?.[1] || '').trim());
/** "nick (Real Name) CS2 Stats – Team" -> the name, if the part before the bracket is this nick. */
const nameFrom = (title, nick) => {
  const m = title.replace(/\s+CS2 Stats.*$/, '').match(/^(.*?) \((.+)\)$/);
  return m && norm(m[1]) === norm(nick) ? m[2].trim() : null;
};

// one entry per person: the id, and a nick to look them up by
const people = new Map();
for (const r of data.rosters) for (const p of r.players) { const id = p.id ?? pid(p.nick); if (!people.has(id)) people.set(id, p.nick); }

fs.mkdirSync('shots', { recursive: true });
const review = [];
let added = 0, kept = 0;
for (const [id, nick] of people) {
  if (only.length && !only.includes(nick)) continue;
  const row = data.players[id];
  if (!row) { review.push({ id, nick, why: 'no row in the players table' }); continue; }
  if (row.name && !refresh) { kept++; continue; }
  let name = bo3.players[nick] ? nameFrom(bo3.players[nick].name, nick) : null;
  let from = 'bo3.gg (saved)';
  if (!name) {
    await sleep(1200);
    // The address segment comes from a nick in rosters.json: only plain slugs are requested, and it is encoded anyway.
    const page = PLAYER_SLUG[nick] || slug(nick);
    if (!/^[a-z0-9_-]+$/.test(page)) { review.push({ id, nick, why: 'the nick does not make a plain bo3.gg address' }); continue; }
    const h = await curl(`https://bo3.gg/players/${encodeURIComponent(page)}`);
    if (!h) { review.push({ id, nick, why: 'no page' }); continue; }
    const title = titleOf(h);
    name = nameFrom(title, nick);
    from = 'bo3.gg (fetched)';
    if (!name) { review.push({ id, nick, why: 'no real name, or the page is for another nick', title }); continue; }
  }
  row.name = name; added++;
  console.log(nick.padEnd(14), '->', name, `(${from})`);
}
fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + '\n');
fs.writeFileSync('shots/names-review.json', JSON.stringify(review, null, 1));
console.log(`${added} names added, ${kept} already there, ${review.length} left blank (see shots/names-review.json)`);
