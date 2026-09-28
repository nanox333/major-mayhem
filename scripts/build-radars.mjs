// Turns the radar images in assets-src/radars/ (supplied by the player) into square, transparent WebPs
// in src/data/radars.json, keyed by map name.
// Generated, not committed: runs with `npm run media`, skipped when the output is newer than its inputs.
import fs from 'fs'; import sharp from 'sharp';
const OUT = 'src/data/radars.json';
const DIR = 'assets-src/radars';
const SIZE = 760;
// file → map name as used in MAPS (src/game/logic.ts). `clip` drops the source's frame first (fractions
// of the image: left, top, right, bottom), `dark` makes the black background and grey grid transparent
// (the map's own dark areas are tinted, so they stay),
// `faint` drops semi-transparent grid dots.
const MAPS = {
  mirage: { name: 'Mirage', faint: true },
  inferno: { name: 'Inferno' },
  nuke: { name: 'Nuke', faint: true },
  ancient: { name: 'Ancient', clip: [0.07, 0.06, 0.93, 0.94], dark: true },
  dust2: { name: 'Dust2' },
  anubis: { name: 'Anubis' },
  train: { name: 'Train' },
};
const files = Object.keys(MAPS).map((k) => `${DIR}/${k}.png`).filter((f) => fs.existsSync(f));
const mtime = (f) => fs.statSync(f).mtimeMs;
const inputs = [...files, new URL(import.meta.url).pathname];
if (!process.argv.includes('--force') && fs.existsSync(OUT) && inputs.every((f) => mtime(f) < mtime(OUT))) {
  console.log('radars.json is up to date');
  process.exit(0);
}

const out = {};
for (const file of files) {
  const key = file.slice(DIR.length + 1, -4);
  const { name, clip, dark, faint } = MAPS[key];
  let img = sharp(file).ensureAlpha();
  const meta = await sharp(file).metadata();
  if (clip) {
    const [l, t, r, b] = clip;
    img = img.extract({ left: Math.round(l * meta.width), top: Math.round(t * meta.height), width: Math.round((r - l) * meta.width), height: Math.round((b - t) * meta.height) });
  }
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    const grey = Math.abs(r - g) < 5 && Math.abs(g - b) < 5;
    if ((dark && (Math.max(r, g, b) < 33 || (grey && Math.max(r, g, b) < 70))) || (faint && a < 140)) data[i + 3] = 0;
    if (data[i + 3] > 40) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  // Square around the playable area with a little padding, centered.
  const side = Math.round(Math.max(x1 - x0, y1 - y0) * 1.06);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const left = Math.round(cx - side / 2), top = Math.round(cy - side / 2);
  const canvas = sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  const src = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: Math.max(0, left), top: Math.max(0, top), width: Math.min(w, left + side) - Math.max(0, left), height: Math.min(h, top + side) - Math.max(0, top) })
    .png().toBuffer();
  const webp = await canvas.composite([{ input: src, left: Math.max(0, -left), top: Math.max(0, -top) }])
    .png().toBuffer().then((b) => sharp(b).resize(SIZE, SIZE).webp({ quality: 78, alphaQuality: 80 }).toBuffer());
  out[name] = 'data:image/webp;base64,' + webp.toString('base64');
  console.log(name, `${side}px square from ${key}.png →`, Math.round(webp.length / 1024), 'KB');
}
fs.writeFileSync(OUT, JSON.stringify(out));
