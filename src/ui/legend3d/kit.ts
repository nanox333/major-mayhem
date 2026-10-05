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
  r.toneMapping = T.ACESFilmicToneMapping;
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

export type Fig = { root: T.Group; headPos: () => T.Vector3 };
const mat = (c: number, rough = .85, metal = 0) => new T.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, flatShading: true });

/** A low-poly soldier standing at the origin facing +z, about 1.8 tall. Built from boxes so it reads as a stylised target, not a person. */
export function soldier(team: 'ct' | 't') {
  const ct = team === 'ct';
  const cloth = mat(ct ? 0x33496e : 0x8a7650), vest = mat(ct ? 0x1b2640 : 0x4c4332), skin = mat(0xd2a07a, .7), dark = mat(0x15171c, .6, .3), helm = mat(ct ? 0x232d44 : 0x2a2a26, .5, .2);
  const root = new T.Group();
  const box = (w: number, h: number, d: number, m: T.Material, x: number, y: number, z: number, p: T.Object3D = root) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); p.add(b); return b; };
  box(.21, .86, .26, cloth, -.14, .43, 0); box(.21, .86, .26, cloth, .14, .43, 0);
  box(.17, .09, .34, dark, -.14, .045, .05); box(.17, .09, .34, dark, .14, .045, .05);
  box(.56, .64, .3, cloth, 0, 1.18, 0); box(.5, .5, .34, vest, 0, 1.2, 0); box(.48, .12, .33, dark, 0, .93, 0);
  box(.15, .55, .17, cloth, -.36, 1.12, .1).rotation.x = -.7; box(.15, .5, .17, cloth, .33, 1.1, .22).rotation.x = -1.2;
  box(.09, .13, .95, dark, .1, 1.22, .45);
  box(.1, .1, .1, skin, 0, 1.52, 0);
  const head = new T.Mesh(new T.SphereGeometry(.14, 12, 10), skin); head.position.set(0, 1.67, 0); root.add(head);
  const helmet = new T.Mesh(new T.SphereGeometry(.175, 12, 8, 0, Math.PI * 2, 0, Math.PI * .55), helm); helmet.position.set(0, 1.69, -.005); root.add(helmet);
  const shadow = new T.Mesh(new T.CircleGeometry(.7, 20), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: .42, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .01; root.add(shadow);
  return { root, head, helmet, shadow };
}
