import potrace from 'potrace';
import { readFileSync, writeFileSync } from 'node:fs';
const src = '../assets/sheet-real.png';
const svg = await new Promise((res, rej) => potrace.trace(src, { threshold: 140, turdSize: 9, optTolerance: 0.9, alphaMax: 1.0, blackOnWhite: true }, (e, s) => e ? rej(e) : res(s)));
const d = svg.match(/ d="([^"]+)"/)[1];
const subs = d.split(/(?=M)/).filter(Boolean).map((p) => {
  const nums = [...p.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => +m[0]);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i + 1 < nums.length; i += 2) { x0 = Math.min(x0, nums[i]); x1 = Math.max(x1, nums[i]); y0 = Math.min(y0, nums[i + 1]); y1 = Math.max(y1, nums[i + 1]); }
  return { p, x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, area: (x1 - x0) * (y1 - y0) };
});
writeFileSync('subs.json', JSON.stringify(subs));
console.log(svg.slice(0, 200)); console.log(subs.length, 'subpaths', d.length, 'chars');
console.log(subs.filter((s) => s.area > 20000).map((s) => [Math.round(s.x0), Math.round(s.y0), Math.round(s.x1), Math.round(s.y1)].join(',')).join('\n'));
