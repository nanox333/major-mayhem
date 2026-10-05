import * as T from 'three';
import { clamp, ninjaShake, ninjaTime } from './timeline';

const base = `${import.meta.env.BASE_URL}assets/highlights/ninja-defuse/`;
/**
 * Where things sit on plate.webp, as fractions of the picture from its top-left. The plate is painted art of the bomb and the gloved hands with
 * the display and the LED switched off; the runtime draws the digits, the lights and the camera over it. Re-measure if the plate is redone.
 */
export const PLATE = {
  aspect: 3 / 2,
  /** The display's four corners: top-left, top-right, bottom-right, bottom-left. */
  lcd: [[.286, .312], [.481, .256], [.499, .337], [.3, .395]] as [number, number][],
  led: [.507, .259] as [number, number],
};

let plate: Promise<string> | undefined;
/** The plate is fetched once and kept as an object URL; each mount decodes its own texture so it owns (and disposes) it. */
export function preloadNinja() {
  return plate ??= fetch(`${base}plate.webp`, { signal: AbortSignal.timeout(5000) }).then(async (r) => {
    if (!r.ok) throw new Error('Missing plate');
    return URL.createObjectURL(await r.blob());
  }).catch((e) => { plate = undefined; throw e; });
}

const RED = '#e84737', GREEN = '#43ff86';
/** The display: digits drawn once per change into a canvas, so they stay crisp and cost one upload per step. */
function makeDisplay() {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
  const ctx = canvas.getContext('2d')!, texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
  let shown = '';
  const draw = (text: string, ok: boolean) => {
    const key = `${text}|${ok}`; if (key === shown) return; shown = key;
    ctx.clearRect(0, 0, 512, 192);
    ctx.font = `800 ${ok ? 98 : 112}px "Courier New", ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = ok ? GREEN : RED; ctx.shadowBlur = 22; ctx.fillStyle = ok ? GREEN : RED; ctx.fillText(text, 256, 100);
    ctx.shadowBlur = 6; ctx.fillText(text, 256, 100); ctx.shadowBlur = 0; texture.needsUpdate = true;
  };
  return { texture, draw };
}
function glowTexture(rgb: string) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  const k = g.createRadialGradient(64, 64, 0, 64, 64, 64); k.addColorStop(0, `rgba(${rgb},1)`); k.addColorStop(.35, `rgba(${rgb},.35)`); k.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = k; g.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c);
}

export async function createNinjaScene(start = 11) {
  const url = await preloadNinja();
  const map = await new Promise<T.Texture>((ok, no) => new T.TextureLoader().load(url, ok, undefined, no));
  map.colorSpace = T.SRGBColorSpace; map.anisotropy = 4;
  const scene = new T.Scene(); scene.background = new T.Color(0x050505);
  const camera = new T.PerspectiveCamera(32, 1, .1, 20);
  const owned = new Set<T.BufferGeometry | T.Material | T.Texture>(); const own = <A extends T.BufferGeometry | T.Material | T.Texture>(r: A) => { owned.add(r); return r; };
  own(map);
  // the plate: a 3 by 2 plane, covered edge to edge whatever the screen shape
  const W = 3, H = W / PLATE.aspect;
  const px = (u: number, v: number, z = 0) => new T.Vector3((u - .5) * W, (.5 - v) * H, z);
  const rect = (w: number, h: number) => own(new T.PlaneGeometry(w, h));
  scene.add(new T.Mesh(rect(W, H), own(new T.MeshBasicMaterial({ map, toneMapped: false }))));
  const additive = (m: T.MeshBasicMaterialParameters) => own(new T.MeshBasicMaterial({ transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false, ...m }));

  // the display overlay: a quad on the measured corners, so the digits sit in the plate's perspective
  const display = makeDisplay(); own(display.texture);
  const q = PLATE.lcd.map(([u, v]) => px(u, v, .002)), lcdGeo = own(new T.BufferGeometry());
  lcdGeo.setAttribute('position', new T.Float32BufferAttribute(q.flatMap((p) => [p.x, p.y, p.z]), 3));
  lcdGeo.setAttribute('uv', new T.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2)); lcdGeo.setIndex([0, 3, 2, 0, 2, 1]);
  const lcdMat = additive({ map: display.texture, opacity: 1 }); scene.add(new T.Mesh(lcdGeo, lcdMat));
  const centre = q.reduce((a, p) => a.add(p), new T.Vector3()).multiplyScalar(1 / 4), lcdW = q[1].distanceTo(q[0]);
  const redTex = own(glowTexture('255,60,40')), greenTex = own(glowTexture('60,255,130')), warmTex = own(glowTexture('255,150,60'));
  const glow = (w: number, h: number, tex: T.Texture, at: T.Vector3) => { const m = new T.Mesh(rect(w, h), additive({ map: tex, opacity: 0 })); m.position.copy(at).setZ(.003); scene.add(m); return m; };
  const ledPos = px(PLATE.led[0], PLATE.led[1], .004);
  const lcdGlow = glow(lcdW * 2.6, lcdW * 1.5, redTex, centre), greenGlow = glow(lcdW * 2.6, lcdW * 1.5, greenTex, centre);
  const ledGlow = glow(.2, .2, redTex, ledPos), ledGreen = glow(.2, .2, greenTex, ledPos);
  // a red wash over the whole plate at the critical beat, and a warm light that breathes
  const wash = new T.Mesh(rect(W * 1.2, H * 1.2), additive({ color: 0xff2a14, opacity: 0 })); wash.position.z = .005; scene.add(wash);
  const warm = glow(W * 1.1, H * .9, warmTex, new T.Vector3(.7, .1, 0)); warm.position.z = .006;

  // dust motes and a few sparks at the critical beat
  const N = 40, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seeds = Array.from({ length: N }, (_, i) => [Math.sin(i * 12.9) * .5 + .5, Math.sin(i * 78.2) * .5 + .5, Math.sin(i * 37.7) * .5 + .5]);
  const geo = own(new T.BufferGeometry()); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
  const points = new T.Points(geo, own(new T.PointsMaterial({ size: .012, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: true })));
  points.frustumCulled = false; scene.add(points);

  let aspect = 1, low = false;
  const look = new T.Vector3();
  const mat = (m: T.Mesh) => m.material as T.MeshBasicMaterial;
  const update = (t: number) => {
    const s = ninjaTime(t, start), sh = ninjaShake(t, s.shake);
    display.draw(s.defused ? 'DEFUSED' : s.text, s.defused);
    lcdMat.opacity = .95 + .05 * s.critical;
    mat(lcdGlow).opacity = s.defused ? 0 : .22 + .14 * s.led + .45 * s.critical;
    mat(greenGlow).opacity = s.green * .5;
    mat(ledGlow).opacity = s.led; ledGlow.scale.setScalar(.8 + s.led * .5 + s.critical * .5);
    mat(ledGreen).opacity = Math.min(1, s.green * 1.4); ledGreen.visible = s.green > 0;
    mat(wash).opacity = s.critical * .1; mat(warm).opacity = .08 + .04 * Math.sin(t * 5.1) + s.critical * .05;
    // camera: a slow push towards the display, a handheld tremor that grows with the tension, still at the click, easing back after it
    const fitH = Math.max(H, W / aspect) * 1.07, dist = fitH / 2 / Math.tan((camera.fov * Math.PI) / 360);
    const k = s.push, zoom = 1 - .2 * k - .02 * Math.sin(t * 3) * (1 - s.relax);
    look.copy(centre).multiplyScalar(.45 * k); look.z = 0;
    // never look past the edge of the painting: keep the view inside it, with a margin for the shake
    const visH = fitH * zoom, visW = visH * aspect, mx = Math.max(0, (W - visW) / 2 - .05), my = Math.max(0, (H - visH) / 2 - .05);
    look.x = clamp(look.x, -mx, mx); look.y = clamp(look.y, -my, my);
    camera.position.set(look.x + sh.x * 9, look.y + sh.y * 9, dist * zoom); camera.up.set(0, 1, 0); camera.lookAt(look.x, look.y, 0); camera.rotateZ(sh.roll * 2.2);
    camera.fov = 32 - 1.6 * s.critical; camera.updateProjectionMatrix();
    for (let i = 0; i < N; i++) {
      const [a, b, c] = seeds[i], spark = i >= 34;
      if (!spark) { pos[i * 3] = (a - .5) * W * .9 + Math.sin(t * .8 + b * 6) * .05; pos[i * 3 + 1] = (b - .5) * H * .9 + ((t * .05 * (c + .3)) % .3); pos[i * 3 + 2] = .01; const v = low ? 0 : .35 * (.4 + .6 * Math.sin(t * 2 + a * 9) ** 2); col[i * 3] = v; col[i * 3 + 1] = v * .62; col[i * 3 + 2] = v * .3; }
      else { const age = clamp((t - .88) / .24), v = low || s.success ? 0 : s.critical * (1 - age) * 1.4, d = age * (.18 + a * .2); pos[i * 3] = centre.x + (a - .5) * d * 4; pos[i * 3 + 1] = centre.y + .05 + b * d * 2 - age * age * .1; pos[i * 3 + 2] = .01; col[i * 3] = v; col[i * 3 + 1] = v * .5; col[i * 3 + 2] = v * .15; }
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    return s;
  };
  const resize = (w: number, h: number) => { aspect = w / Math.max(1, h); camera.aspect = aspect; camera.updateProjectionMatrix(); };
  const setLow = () => { low = true; };
  const dispose = () => { owned.forEach((r) => r.dispose()); };
  update(0); resize(1, 1);
  return { scene, camera, update, resize, setLow, dispose };
}
