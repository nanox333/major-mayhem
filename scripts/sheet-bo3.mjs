import fs from 'fs'; import sharp from 'sharp';
fs.mkdirSync('shots', { recursive: true });
const a = JSON.parse(fs.readFileSync('assets-src/major-mayhem-bo3.json', 'utf8'));
const tile = async (k, data, bg) => { const img = await sharp(Buffer.from(data.split(',')[1], 'base64')).resize(130, 130, { fit: 'contain', background: bg }).flatten({ background: bg }).toBuffer(); return [img, Buffer.from(`<svg width="130" height="20"><rect width="100%" height="100%" fill="#000"/><text x="3" y="15" font-size="13" fill="#ff0" font-family="sans-serif">${k}</text></svg>`)]; };
const sheet = async (entries, file, bg) => { const comps = []; for (let i = 0; i < entries.length; i++) { const [k, v] = entries[i]; const [img, lab] = await tile(k, v.data, bg); const x = (i % 10) * 130, y = Math.floor(i / 10) * 150; comps.push({ input: lab, left: x, top: y }, { input: img, left: x, top: y + 20 }); } await sharp({ create: { width: 1300, height: Math.ceil(entries.length / 10) * 150, channels: 3, background: bg } }).composite(comps).jpeg({ quality: 65 }).toFile(file); };
const p = Object.entries(a.players);
for (let s = 0; s * 50 < p.length; s++) await sheet(p.slice(s * 50, s * 50 + 50), `shots/bo3-${s}.jpg`, '#1b2b38');
await sheet(Object.entries(a.teams), 'shots/bo3-teams.jpg', '#0b1d29');
console.log(p.length, Object.keys(a.teams).length);
