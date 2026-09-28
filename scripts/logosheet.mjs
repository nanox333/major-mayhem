import fs from 'fs'; import sharp from '/home/claude/.npm-global/lib/node_modules/sharp/lib/index.js';
const a = JSON.parse(fs.readFileSync('assets-src/major-mayhem-assets.json', 'utf8'));
const items = Object.entries(a.logos); const W = 180;
const comps = [];
for (let i = 0; i < items.length; i++) { const [k, v] = items[i];
  const img = await sharp(Buffer.from(v.data.split(',')[1], 'base64')).resize(140, 120, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  comps.push({ input: img, left: (i % 6) * W + 20, top: Math.floor(i / 6) * 170 + 36 }, { input: Buffer.from(`<svg width="${W}" height="30"><text x="6" y="20" font-size="15" fill="#ff0" font-family="sans-serif">${k} ${v.license}</text></svg>`), left: (i % 6) * W, top: Math.floor(i / 6) * 170 });
}
await sharp({ create: { width: W * 6, height: 340, channels: 3, background: '#0b1d29' } }).composite(comps).jpeg().toFile('shots/logos.jpg');
