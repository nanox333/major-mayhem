import { fileURLToPath } from 'node:url';
// Turns the image bundles in assets-src/ (bo3.gg, plus Wikimedia Commons for gaps) into cropped portraits + logos
// in src/data/media.json, with credits kept for each file. media.json is generated, not committed: this runs
// before dev, build, test and check, and skips the work when the output is newer than its inputs and this script.
import fs from 'fs'; import sharp from 'sharp';
const OUT = 'src/data/media.json';
const INPUTS = ['assets-src/major-mayhem-assets.json', 'assets-src/major-mayhem-bo3.json', fileURLToPath(import.meta.url)];
const mtime = (f) => fs.statSync(f).mtimeMs;
if (!process.argv.includes('--force') && fs.existsSync(OUT) && INPUTS.every((f) => mtime(f) < mtime(OUT))) {
  console.log('media.json is up to date');
  process.exit(0);
}
const a = JSON.parse(fs.readFileSync('assets-src/major-mayhem-assets.json', 'utf8'));
const pid = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
// Photos rejected after review: group shots where the player can't be identified with confidence.
const DROP = new Set(['Fifflaren', 'magixx', 'apEX']);
// Manual crops: center (fraction of width/height) and side (fraction of the shorter edge).
const CROP = {
  byali: [.64, .42, .62], Hiko: [.73, .38, .55], aizy: [.3, .45, .55], flamie: [.57, .42, .5], Edward: [.56, .4, .7],
  fnx: [.52, .42, .6], nitr0: [.8, .33, .5], Aleksib: [.42, .43, .55], jkaem: [.5, .35, .55], flameZ: [.6, .45, .6],
  mezii: [.5, .2, .8], donk: [.38, .28, .55], Skadoodle: [.44, .3, .7], rain: [.58, .24, .6], NEO: [.6, .38, .85],
  pashaBiceps: [.5, .42, .85], Snax: [.5, .45, .85], seized: [.5, .35, .75], FalleN: [.55, .3, .6], AdreN: [.5, .22, .5],
  allu: [.45, .38, .75], coldzera: [.5, .38, .85], JDC: [.55, .38, .85], s1mple: [.45, .42, .85], Dosia: [.6, .46, .9],
  Xizt: [.5, .35, .85], tarik: [.5, .3, .9], ZywOo: [.5, .38, .85], mou: [.5, .38, .9], EliGE: [.5, .42, .95],
};
const DEF = [.5, .36, .82];
const out = { players: {}, logos: {} };
const credit = (v) => ({ source: 'Wikimedia Commons', file: v.file, author: v.author || 'Unknown', license: v.license, page: v.page });
for (const [nick, v] of Object.entries(a.players)) {
  if (DROP.has(nick)) continue;
  const buf = Buffer.from(v.data.split(',')[1], 'base64');
  const m = await sharp(buf).metadata();
  const [cx, cy, s] = CROP[nick] ?? DEF;
  const side = Math.round(Math.min(m.width, m.height) * s);
  const left = Math.max(0, Math.min(m.width - side, Math.round(cx * m.width - side / 2)));
  const top = Math.max(0, Math.min(m.height - side, Math.round(cy * m.height - side / 2)));
  const img = await sharp(buf).extract({ left, top, width: side, height: side }).resize(168, 168).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  out.players[pid(nick)] = { src: 'data:image/jpeg;base64,' + img.toString('base64'), ...credit(v) };
}
const LOGO_DROP = new Set(['Team Spirit', 'Team Dignitas']);   // wrong organizations with the same name
const INVERT = new Set(['MIBR', 'Team EnVyUs']);               // black logos: shown white on the dark UI
for (const [org, v] of Object.entries(a.logos)) {
  if (LOGO_DROP.has(org)) continue;
  let img = sharp(Buffer.from(v.data.split(',')[1], 'base64')).trim().resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (INVERT.has(org)) img = img.negate({ alpha: false });
  const b = await img.png({ palette: true }).toBuffer();
  out.logos[org] = { src: 'data:image/png;base64,' + b.toString('base64'), ...credit(v) };
}
// ---- bo3.gg (primary source when present): studio photos and team logos read from public pages ----
const b = JSON.parse(fs.readFileSync('assets-src/major-mayhem-bo3.json', 'utf8'));
const BO3_WRONG = new Set(['huNter-']); // page shows a different person
let bp = 0, bl = 0;
for (const [nick, v] of Object.entries(b.players)) {
  if (BO3_WRONG.has(nick)) continue;
  const buf = Buffer.from(v.data.split(',')[1], 'base64');
  const m = await sharp(buf).metadata();
  const side = Math.round(m.width * 0.6);
  const img = await sharp(buf).extract({ left: Math.round(m.width * 0.2), top: Math.round(m.height * 0.02), width: side, height: side }).resize(176, 176).webp({ quality: 80, alphaQuality: 80 }).toBuffer();
  out.players[pid(nick)] = { src: 'data:image/webp;base64,' + img.toString('base64'), source: 'bo3.gg', file: v.name, author: 'bo3.gg', license: 'Used for a personal fan project; rights belong to their owners', page: v.page };
  bp++;
}
for (const [org, v] of Object.entries(b.teams)) {
  const img = await sharp(Buffer.from(v.data.split(',')[1], 'base64')).trim().resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 85, alphaQuality: 90 }).toBuffer();
  out.logos[org] = { src: 'data:image/webp;base64,' + img.toString('base64'), source: 'bo3.gg', file: org + ' logo', author: org, license: 'Trademark of ' + org + '; used for identification', page: v.page };
  bl++;
}
console.log('bo3 players', bp, 'bo3 logos', bl);
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('players', Object.keys(out.players).length, 'logos', Object.keys(out.logos).length, 'KB', Math.round(fs.statSync(OUT).size / 1024));
