import { readFileSync, writeFileSync } from 'node:fs';
const subs = JSON.parse(readFileSync('subs.json'));
const g = { slashA: [], slashB: [], splat1: [], splat2: [], splat3: [], soldier: [], knife: [], scratches: [], debris: [] };
const lineDist = (x, y, a, b) => { const [x0, y0] = a, [x1, y1] = b, dx = x1 - x0, dy = y1 - y0; return Math.abs(dy * (x - x0) - dx * (y - y0)) / Math.hypot(dx, dy); };
for (const s of subs) {
  const { cx, cy } = s;
  if (cx < 695 && cy < 440) { (lineDist(cx, cy, [25, 262], [690, 28]) <= lineDist(cx, cy, [30, 418], [690, 200]) ? g.slashA : g.slashB).push(s); }
  else if (cx >= 676 && cx < 1000 && cy < 440) g.splat1.push(s);
  else if (cx >= 1000 && cx < 1315 && cy < 440) g.splat2.push(s);
  else if (cx >= 1315 && cy < 470) g.splat3.push(s);
  else if (cx < 650 && cy > 700) g.knife.push(s);
  else if (cx > 1190 && cy > 640) g.scratches.push(s);
  else if ((cx >= 625 && cx <= 1160 && cy >= 650) || (cx >= 760 && cx <= 1000 && cy >= 474)) g.soldier.push(s);
  else if (cy > 430 && cy < 700 && s.area > 120) g.debris.push(s);
}
const round = (p) => p.replace(/,/g, '').replace(/-?\d+\.\d+/g, (m) => String(+(+m).toFixed(1))).replace(/\s+/g, ' ').replace(/ ([CLMz])/g, '$1').replace(/([CLM]) /g, '$1');
const pack = (list) => {
  const x0 = Math.min(...list.map((s) => s.x0)), y0 = Math.min(...list.map((s) => s.y0)), x1 = Math.max(...list.map((s) => s.x1)), y1 = Math.max(...list.map((s) => s.y1));
  return { d: list.map((s) => round(s.p)).join(''), cx: Math.round((x0 + x1) / 2), cy: Math.round((y0 + y1) / 2), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
};
const out = {};
for (const k of Object.keys(g)) if (k !== 'debris') out[k] = pack(g[k]);
const deb = g.debris.filter((s) => s.area < 20000).sort((a, b) => b.area - a.area).slice(0, 28).map((s) => pack([s]));
let ts = `/** Traced from a ChatGPT-generated black-on-white asset sheet (potrace, scripts/knife-trace.mjs). Coordinates are the sheet's pixels (1672 x 941);\n *  each asset carries its centre and size so the animation can move and scale it. Do not edit by hand. */\nexport interface Traced { d: string; cx: number; cy: number; w: number; h: number }\n`;
for (const [k, v] of Object.entries(out)) ts += `export const ${k.toUpperCase()}: Traced = ${JSON.stringify(v)};\n`;
ts += `export const DEBRIS: Traced[] = ${JSON.stringify(deb)};\n`;
writeFileSync('traced.ts', ts);
console.log(Object.entries(out).map(([k, v]) => `${k} ${g[k].length} parts ${v.w}x${v.h} ${(v.d.length / 1024).toFixed(0)}KB`).join('\n'), `\ndebris ${deb.length}`, (ts.length / 1024).toFixed(0) + 'KB');
