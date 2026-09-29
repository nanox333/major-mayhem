// Turns the raw sound files in assets-src/sounds/ (ogg, wav, mp3 or flac) into the small mono mp3s in src/sounds/ that the game
// inlines into its build. Each file is decoded in Chromium (so any format it plays works), mixed to mono, trimmed of leading and
// trailing silence, levelled to a common loudness, faded out and encoded with lamejs.
//
//   npm run sounds                       # assets-src/sounds -> src/sounds
//   node scripts/prepare-sounds.mjs --in some/dir --out other/dir
//
// Needs Chromium, the same as the e2e run (see the README); set CHROMIUM_PATH to use an existing one.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const IN = arg('in', 'assets-src/sounds');
const OUT = arg('out', 'src/sounds');

const RATE = 44100;
const KBPS = 96;
const TARGET_RMS_DB = -22;    // every sample is levelled to this loudness (over the part that isn't silence)...
const PEAK_CAP = 0.95;        // ...unless that would clip
const HEAD_THRESHOLD = 0.004; // where a sound starts (about -48 dB)
const TAIL_THRESHOLD = 0.0008; // where it has died away (about -62 dB), so quiet decays aren't chopped
const HEAD_MARGIN = 0.002, TAIL_MARGIN = 0.03, FADE_IN = 0.001, FADE_OUT = 0.012, MAX_SECONDS = 4;

const require = createRequire(import.meta.url);
/** lamejs's source entry point is broken under Node ("MPEGMode is not defined"); its prebuilt bundle works when evaluated. */
function loadLame() {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${fs.readFileSync(require.resolve('lamejs/lame.all.js'), 'utf8')}\n;this.lamejs = lamejs;`, sandbox);
  return sandbox.lamejs;
}

function process1(samples) {
  let first = 0, last = samples.length - 1;
  while (first < samples.length && Math.abs(samples[first]) < HEAD_THRESHOLD) first++;
  while (last > first && Math.abs(samples[last]) < TAIL_THRESHOLD) last--;
  if (first >= last) return null;
  first = Math.max(0, first - Math.round(HEAD_MARGIN * RATE));
  last = Math.min(samples.length - 1, last + Math.round(TAIL_MARGIN * RATE), first + Math.round(MAX_SECONDS * RATE));
  const x = Float32Array.from(samples.slice(first, last + 1));
  let sq = 0, peak = 0;
  for (const v of x) { sq += v * v; peak = Math.max(peak, Math.abs(v)); }
  const rms = Math.sqrt(sq / x.length);
  const gain = Math.min(10 ** (TARGET_RMS_DB / 20) / rms, PEAK_CAP / peak);
  const fadeIn = Math.round(FADE_IN * RATE), fadeOut = Math.round(FADE_OUT * RATE);
  for (let i = 0; i < x.length; i++) {
    let g = gain;
    if (i < fadeIn) g *= i / fadeIn;
    if (i >= x.length - fadeOut) g *= (x.length - 1 - i) / fadeOut;
    x[i] *= g;
  }
  return x;
}

function encode(lame, x) {
  const enc = new lame.Mp3Encoder(1, RATE, KBPS);
  const pcm = new Int16Array(x.length);
  for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767)));
  const chunks = [];
  for (let i = 0; i < pcm.length; i += 1152) chunks.push(Buffer.from(enc.encodeBuffer(pcm.subarray(i, i + 1152))));
  chunks.push(Buffer.from(enc.flush()));
  return Buffer.concat(chunks);
}

const files = fs.existsSync(IN) ? fs.readdirSync(IN).filter((f) => /\.(ogg|wav|mp3|flac)$/i.test(f)).sort() : [];
if (files.length === 0) { console.error(`No sound files in ${IN}.`); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
await page.setContent('<html></html>');
const lame = loadLame();
const rows = [];
let bad = 0;
for (const f of files) {
  const b64 = fs.readFileSync(path.join(IN, f)).toString('base64');
  // Decode and mix down to mono at 44.1 kHz in the browser.
  const mono = await page.evaluate(async ([data, rate]) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const buffer = await new OfflineAudioContext(1, 1, rate).decodeAudioData(bytes.buffer);
    const out = new Float32Array(buffer.length);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) { const d = buffer.getChannelData(ch); for (let i = 0; i < out.length; i++) out[i] += d[i] / buffer.numberOfChannels; }
    return Array.from(out);
  }, [b64, RATE]).catch((e) => { console.error(`${f}: could not decode (${String(e).split('\n')[0]})`); return null; });
  const x = mono && process1(mono);
  if (!x) { console.error(`${f}: skipped (silent or undecodable)`); bad++; continue; }
  const mp3 = encode(lame, x);
  const name = f.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  fs.writeFileSync(path.join(OUT, `${name}.mp3`), mp3);
  let sq = 0, peak = 0; for (const v of x) { sq += v * v; peak = Math.max(peak, Math.abs(v)); }
  rows.push({ file: f, out: `${name}.mp3`, seconds: +(x.length / RATE).toFixed(2), peakDb: +(20 * Math.log10(peak)).toFixed(1), rmsDb: +(20 * Math.log10(Math.sqrt(sq / x.length))).toFixed(1), kB: +(mp3.length / 1024).toFixed(1) });
}
await browser.close();
console.table(rows);
console.log(`${rows.length} sounds, ${(rows.reduce((n, r) => n + r.kB, 0)).toFixed(0)} kB of mp3${bad ? `, ${bad} skipped` : ''}`);
process.exit(bad ? 1 : 0);
