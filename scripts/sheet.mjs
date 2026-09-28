import fs from 'fs'; import sharp from '/home/claude/.npm-global/lib/node_modules/sharp/lib/index.js';
const a = JSON.parse(fs.readFileSync('assets-src/major-mayhem-assets.json', 'utf8'));
const items = Object.entries(a.players);
const W = 200, H = 250, COLS = 6;
for (let s = 0; s * 18 < items.length; s++) {
  const chunk = items.slice(s * 18, s * 18 + 18);
  const comps = [];
  for (let i = 0; i < chunk.length; i++) {
    const [k, v] = chunk[i];
    const buf = Buffer.from(v.data.split(',')[1], 'base64');
    const img = await sharp(buf).resize(W, H - 30, { fit: 'contain', background: '#222' }).toBuffer();
    const label = Buffer.from(`<svg width="${W}" height="30"><rect width="100%" height="100%" fill="#000"/><text x="6" y="21" font-size="18" fill="#ff0" font-family="sans-serif">${k} ${v.w}x${v.h}</text></svg>`);
    comps.push({ input: img, left: (i % COLS) * W, top: Math.floor(i / COLS) * H + 30 }, { input: label, left: (i % COLS) * W, top: Math.floor(i / COLS) * H });
  }
  await sharp({ create: { width: W * COLS, height: H * 3, channels: 3, background: '#111' } }).composite(comps).jpeg({ quality: 70 }).toFile(`shots/sheet${s}.jpg`);
}
console.log(items.length);
