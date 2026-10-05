// A tiny local server for generate.html: it receives each generated image and writes it into src/assets/legend.
// Run: node scripts/legend-assets/save-server.mjs   then open generate.html from the dev server (npm run dev) and press "Generate".
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../../src/assets/legend/', import.meta.url));
mkdirSync(out, { recursive: true });
createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const name = new URL(req.url, 'http://x').searchParams.get('name') ?? '';
  if (!/^[a-z0-9-]+\.(webp|png)$/.test(name)) { res.writeHead(400); return res.end('bad name'); }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const b64 = Buffer.concat(chunks).toString().replace(/^data:image\/\w+;base64,/, '');
    writeFileSync(out + name, Buffer.from(b64, 'base64'));
    console.log('wrote', name, Math.round(b64.length * 0.75 / 1024) + ' KB');
    res.writeHead(200); res.end('ok');
  });
}).listen(4999, () => console.log('saving into', out));
