import { fileURLToPath } from 'node:url';
// Builds the icons and the link-preview image into public/ (generated, not committed): favicons, home-screen
// icons and a 1200×630 preview for Discord, X, WhatsApp and Reddit. It uses the game's own fonts (assets-src/fonts,
// SIL Open Font License), colors, a map radar and player photos, so it needs `build-media` and `build-radars` first.
// Runs with `npm run media`, skipped when every output is newer than its inputs.
import fs from 'fs'; import sharp from 'sharp';

const OUT = 'public';
const FONTS = {
  logo: { file: 'assets-src/fonts/SairaStencilOne-Regular.ttf', family: 'Saira Stencil One' },
  head: { file: 'assets-src/fonts/SairaCondensed-Bold.ttf', family: 'Saira Condensed Bold' },
  body: { file: 'assets-src/fonts/Rajdhani-Bold.ttf', family: 'Rajdhani Bold' },
};
const OUTPUTS = ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'og.png'].map((f) => `${OUT}/${f}`);
const INPUTS = ['src/data/media.json', 'src/data/radars.json', 'site.config.json', fileURLToPath(import.meta.url), ...Object.values(FONTS).map((f) => f.file)];
const mtime = (f) => fs.statSync(f).mtimeMs;
if (!process.argv.includes('--force') && OUTPUTS.every((f) => fs.existsSync(f)) && INPUTS.every((i) => OUTPUTS.every((o) => mtime(i) < mtime(o)))) {
  console.log('social images are up to date');
  process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });

const site = JSON.parse(fs.readFileSync('site.config.json', 'utf8'));
const media = JSON.parse(fs.readFileSync('src/data/media.json', 'utf8'));
const radars = JSON.parse(fs.readFileSync('src/data/radars.json', 'utf8'));
const BG = site.themeColor, GOLD = site.accent, CT = '#5e98d9', CREAM = '#f1e5c8', MUTED = '#8f9bb1';
const dataUri = (s) => Buffer.from(s.split(',')[1], 'base64');

/** Text rendered with one of the bundled fonts. `size` is in pixels. */
const text = (s, font, size, color, extra = '') =>
  sharp({ text: { text: `<span foreground="${color}"${extra}>${s}</span>`, font: `${FONTS[font].family} ${size}px`, fontfile: FONTS[font].file, rgba: true, dpi: 72 } }).png().toBuffer({ resolveWithObject: true });

// ---------- icons: an orange shield (the game's team-badge shape) with a stencil M ----------
const SHIELD = 'M20 2 L36 9 V22 C36 30 29 36 20 38 C11 36 4 30 4 22 V9 Z';
const iconSvg = (size, pad) => {
  const s = (size - pad * 2) / 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2633"/><stop offset="1" stop-color="#07090c"/></linearGradient></defs>
    <rect width="${size}" height="${size}" fill="${BG}"/>
    <g transform="translate(${pad} ${pad}) scale(${s})"><path d="${SHIELD}" fill="url(#g)" stroke="${GOLD}" stroke-width="2.4" stroke-linejoin="round"/></g>
  </svg>`;
};
async function icon(size, pad, file) {
  const inner = size - pad * 2;
  const m = await text('M', 'logo', Math.round(inner * 0.56), GOLD);
  const base = sharp(Buffer.from(iconSvg(size, pad)));
  const left = Math.round((size - m.info.width) / 2), top = Math.round(pad + inner * 0.5 - m.info.height / 2);
  await base.composite([{ input: m.data, left, top }]).png().toFile(`${OUT}/${file}`);
}
await icon(512, 36, 'icon-512.png');
await icon(192, 14, 'icon-192.png');
await icon(180, 14, 'apple-touch-icon.png');
await icon(512, 110, 'icon-maskable-512.png'); // Android crops maskable icons to a circle: keep the shield inside the safe zone
await sharp(`${OUT}/icon-192.png`).resize(32, 32).png().toFile(`${OUT}/favicon-32.png`);
// The SVG favicon can't rely on fonts, so it embeds the 192px render.
const fav = (await sharp(`${OUT}/icon-192.png`).resize(64, 64).png().toBuffer()).toString('base64');
fs.writeFileSync(`${OUT}/favicon.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,${fav}"/></svg>\n`);

// ---------- link preview: 1200×630 ----------
const W = 1200, H = 630;
const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="glow" cx="0.2" cy="0.1" r="0.9"><stop offset="0" stop-color="#1c2236"/><stop offset="0.55" stop-color="${BG}"/></radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0.45" stop-color="${BG}" stop-opacity="1"/><stop offset="0.75" stop-color="${BG}" stop-opacity="0.35"/><stop offset="1" stop-color="${BG}" stop-opacity="0.1"/></linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
</svg>`;
const radar = await sharp(dataUri(radars.Mirage ?? radars.Dust2)).resize(630, 630).ensureAlpha(0.75).png().toBuffer();
const radarDim = await sharp(radar).composite([{ input: Buffer.from(`<svg width="630" height="630"><rect width="630" height="630" fill="${BG}" fill-opacity="0.2"/></svg>`), blend: 'atop' }]).png().toBuffer();
const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0.38" stop-color="${BG}" stop-opacity="1"/><stop offset="0.72" stop-color="${BG}" stop-opacity="0.25"/><stop offset="1" stop-color="${BG}" stop-opacity="0"/></linearGradient>
  <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
  <rect x="72" y="238" width="420" height="5" fill="url(#bar)"/>
  <rect x="0" y="${H - 8}" width="${W}" height="8" fill="${GOLD}"/>
</svg>`;

// Five famous names, one per role, as round portraits.
const LINEUP = [['karrigan', 'IGL'], ['s1mple', 'AWP'], ['donk', 'ENTRY'], ['ropz', 'LURK'], ['xyp9x', 'SUPPORT']];
const R = 96;
const ring = (c) => Buffer.from(`<svg width="${R}" height="${R}"><circle cx="${R / 2}" cy="${R / 2}" r="${R / 2 - 2}" fill="none" stroke="${c}" stroke-width="3"/></svg>`);
const mask = Buffer.from(`<svg width="${R}" height="${R}"><circle cx="${R / 2}" cy="${R / 2}" r="${R / 2 - 2}" fill="#fff"/></svg>`);
const layers = [];
for (const [i, [id, role]] of LINEUP.entries()) {
  const p = media.players[id];
  if (!p) continue;
  const face = await sharp(dataUri(p.src)).resize(R, R).composite([{ input: mask, blend: 'dest-in' }, { input: ring(i % 2 ? CT : GOLD) }]).png().toBuffer();
  const x = 72 + i * 118, y = 430;
  layers.push({ input: face, left: x, top: y });
  const lab = await text(role, 'head', 20, i % 2 ? CT : GOLD, ' letter_spacing="1500"');
  layers.push({ input: lab.data, left: Math.round(x + R / 2 - lab.info.width / 2), top: y + R + 8 });
}

const title = await text('MAJOR MAYHEM', 'logo', 104, CREAM);
const tag1 = await text('Draft a dream team from CS Major history.', 'body', 38, CREAM);
const tag2 = await text('Then win the Major.', 'body', 38, GOLD);
const chip = await text('NEW DAILY CHALLENGE EVERY DAY', 'head', 22, BG, ' letter_spacing="2000"');
const chipBg = Buffer.from(`<svg width="${chip.info.width + 36}" height="44"><path d="M0 0 H${chip.info.width + 36} V34 L${chip.info.width + 26} 44 H0 Z" fill="${GOLD}"/></svg>`);
const host = await text(site.url.replace(/^https?:\/\//, '').replace(/\/$/, ''), 'head', 22, MUTED, ' letter_spacing="1000"');

await sharp(Buffer.from(bg))
  .composite([
    { input: radarDim, left: W - 630, top: 0 },
    { input: Buffer.from(overlay) },
    { input: chipBg, left: 72, top: 70 },
    { input: chip.data, left: 90, top: 70 + Math.round((40 - chip.info.height) / 2) },
    { input: title.data, left: 66, top: 128 },
    { input: tag1.data, left: 72, top: 262 },
    { input: tag2.data, left: 72, top: 310 },
    ...layers,
    { input: host.data, left: W - 72 - host.info.width, top: H - 60 },
  ])
  .png({ compressionLevel: 9, palette: false })
  .toFile(`${OUT}/og.png`);
console.log('social images:', OUTPUTS.map((f) => `${f.slice(OUT.length + 1)} ${Math.round(fs.statSync(f).size / 1024)}KB`).join(', '));
