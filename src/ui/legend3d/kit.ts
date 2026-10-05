import * as T from 'three';

/** Shared pieces for the 3D legendary scenes. Every scene is a pure function of time `t` (seconds): render(t) draws that exact frame, so the debug scrubber, the live game and a screenshot all agree. */
export type Scene3D = { duration: number; render: (t: number) => void; resize: (w: number, h: number) => void; dispose: () => void };
export type SceneMaker = (canvas: HTMLCanvasElement) => Scene3D;

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (t: number, a: number, b: number) => { const k = clamp((t - a) / (b - a)); return k * k * (3 - 2 * k); };
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** A repeatable pseudo-random number from an integer, so particle bursts look the same on every frame and every run. */
export const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** Smooths a time function over a short window with no state, so a camera can lag its subject without remembering the last frame. */
export const lag = (f: (t: number) => number, t: number, win = 0.14, n = 6) => { let s = 0; for (let i = 0; i < n; i++) s += f(t - (win * i) / (n - 1)); return s / n; };

export function makeRenderer(canvas: HTMLCanvasElement) {
  const r = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  r.outputColorSpace = T.SRGBColorSpace;
  r.toneMapping = T.NoToneMapping;
  return r;
}

export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

export const glowTex = () => canvasTex(128, 128, (g) => {
  const k = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  k.addColorStop(0, 'rgba(255,255,255,1)'); k.addColorStop(.25, 'rgba(255,236,190,.75)'); k.addColorStop(.6, 'rgba(255,170,70,.18)'); k.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = k; g.fillRect(0, 0, 128, 128);
});

/** A four-pointed flash star: the shape a muzzle flash or a hit has. */
export const starTex = () => canvasTex(256, 256, (g) => {
  g.translate(128, 128);
  const k = g.createRadialGradient(0, 0, 0, 0, 0, 128);
  k.addColorStop(0, 'rgba(255,255,255,1)'); k.addColorStop(.3, 'rgba(255,220,140,.8)'); k.addColorStop(1, 'rgba(255,150,50,0)');
  g.fillStyle = k;
  for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(-128, 0); g.quadraticCurveTo(0, -10, 128, 0); g.quadraticCurveTo(0, 10, -128, 0); g.fill(); }
  g.beginPath(); g.arc(0, 0, 44, 0, 7); g.fill();
});

export const speckTex = () => canvasTex(64, 64, (g) => {
  const k = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  k.addColorStop(0, 'rgba(255,255,255,1)'); k.addColorStop(.5, 'rgba(255,255,255,.55)'); k.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = k; g.fillRect(0, 0, 64, 64);
});

/** Three flat bands of light instead of a smooth gradient: the cel-shaded look every 3D scene shares. */
const ramp = (() => { const t = new T.DataTexture(new Uint8Array([88, 88, 100, 255, 178, 176, 182, 255, 255, 255, 255, 255]), 3, 1, T.RGBAFormat); t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true; return t; })();
export const toon = (c: number) => new T.MeshToonMaterial({ color: c, gradientMap: ramp });
export const flat = (c: number, o = 1) => new T.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o, fog: false, depthWrite: o === 1 });
const ink = new T.MeshBasicMaterial({ color: 0x14110f, side: T.BackSide, fog: false });
/** A toon-shaded mesh with a black ink outline (a slightly larger copy drawn from the inside), added to `parent` at x, y, z. */
export function part(g: T.BufferGeometry, color: number | T.Material, parent: T.Object3D, x = 0, y = 0, z = 0, edge = .014) {
  const m = new T.Mesh(g, typeof color === 'number' ? toon(color) : color); m.position.set(x, y, z);
  if (edge > 0) {
    g.computeBoundingBox(); const sz = g.boundingBox!.getSize(new T.Vector3());
    const o = new T.Mesh(g, ink); o.scale.set(...(['x', 'y', 'z'] as const).map((a) => (sz[a] > 1e-4 ? (sz[a] + edge * 2) / sz[a] : 1)) as [number, number, number]);
    const c = g.boundingBox!.getCenter(new T.Vector3()); o.position.copy(c).multiply(new T.Vector3(1, 1, 1)).sub(c.clone().multiply(o.scale));
    m.add(o);
  }
  parent.add(m); return m;
}
export const box = (w: number, h: number, d: number) => new T.BoxGeometry(w, h, d);
/** A cylinder lying along z, which is how every barrel and tube here points. */
export const tube = (r1: number, r2: number, len: number, seg = 14) => { const g = new T.CylinderGeometry(r1, r2, len, seg); g.rotateX(Math.PI / 2); return g; };
/** A flat spiky star, the comic-book burst that marks a hit or a shot. */
export function starShape(points: number, outer: number, inner: number) {
  const sh = new T.Shape();
  for (let i = 0; i < points * 2; i++) { const a = (i / (points * 2)) * Math.PI * 2, r = i % 2 ? inner : outer; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  return new T.ShapeGeometry(sh);
}
/** A flat badge made of a coloured shape on a black one, always turned to face the camera. */
export function badge(g: T.BufferGeometry, color: number, edge = .06) {
  const grp = new T.Group();
  const back = new T.Mesh(g, flat(0x14110f)); back.scale.setScalar(1 + edge); back.position.z = -.002; grp.add(back);
  grp.add(new T.Mesh(g, flat(color)));
  return grp;
}
export function skyDome(top: number, low: number, bands = 6) {
  const a = new T.Color(low), b = new T.Color(top);
  return new T.Mesh(new T.SphereGeometry(200, 24, 14), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { a: { value: a }, b: { value: b } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform vec3 a; uniform vec3 b; varying float h; void main(){ float k = floor(smoothstep(0., .5, h) * ${bands}.) / ${bands}.; gl_FragColor = vec4(mix(a, b, k), 1.);\n#include <colorspace_fragment>\n}`,
  }));
}
