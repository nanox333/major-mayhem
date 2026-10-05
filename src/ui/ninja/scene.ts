import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clamp, ninjaShake, ninjaTime } from './timeline';

const base = `${import.meta.env.BASE_URL}assets/highlights/ninja-defuse/`;
let files: Promise<[ArrayBuffer, ArrayBuffer]> | undefined;
/** The two GLB files are fetched once and kept as bytes. Each mounted highlight parses its own copy, so it owns (and disposes) its GPU resources. */
export function preloadNinja() {
  return files ??= Promise.all(['bomb.glb', 'hands.glb'].map(async (name) => {
    const r = await fetch(base + name, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(`Missing ${name}`);
    return r.arrayBuffer();
  })).then((v) => v as [ArrayBuffer, ArrayBuffer]).catch((e) => { files = undefined; throw e; });
}

const RED = '#e84737', GREEN = '#43ff86';
/** The display: digits drawn once per change into a canvas used as an emissive map, so they stay crisp and cost one texture upload per step. */
function makeDisplay() {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
  const ctx = canvas.getContext('2d')!, texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4; texture.wrapS = T.RepeatWrapping; texture.wrapT = T.RepeatWrapping; texture.repeat.set(1, -1); texture.offset.set(0, 1); // the screen plane comes out of the export upside down
  let shown = '';
  const draw = (text: string, ok: boolean) => {
    const key = `${text}|${ok}`; if (key === shown) return; shown = key;
    ctx.fillStyle = '#050606'; ctx.fillRect(0, 0, 512, 192);
    ctx.fillStyle = ok ? 'rgba(67,255,134,.08)' : 'rgba(232,71,55,.07)'; for (let y = 0; y < 192; y += 6) ctx.fillRect(0, y, 512, 2);
    ctx.font = `800 ${ok ? 92 : 104}px "Courier New", ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = ok ? GREEN : RED; ctx.shadowBlur = 14; ctx.fillStyle = ok ? GREEN : RED; ctx.fillText(text, 256, 100);
    ctx.shadowBlur = 0; texture.needsUpdate = true;
  };
  return { texture, draw };
}

export async function createNinjaScene(start = 11) {
  const [bombBytes, handBytes] = await preloadNinja();
  const loader = new GLTFLoader();
  const [bomb, hands] = await Promise.all([loader.parseAsync(bombBytes.slice(0), base), loader.parseAsync(handBytes.slice(0), base)]);
  const scene = new T.Scene(); scene.background = new T.Color(0x070809); scene.fog = new T.FogExp2(0x070809, .5);
  const camera = new T.PerspectiveCamera(50, 1, .05, 20);
  const owned = new Set<T.BufferGeometry | T.Material | T.Texture>();
  const own = <A extends T.BufferGeometry | T.Material | T.Texture>(r: A) => { owned.add(r); return r; };
  scene.add(bomb.scene, hands.scene);

  // lights: dim ambient, one warm key (the only shadow), a small red glow at the LED, a green one for the success
  scene.add(new T.HemisphereLight(0x5a6678, 0x3a2410, 2.4));
  const key = new T.DirectionalLight(0xff9a50, 5); key.position.set(-1.6, 2.2, -1.4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -1.6; key.shadow.camera.right = 1.6; key.shadow.camera.top = 1.6; key.shadow.camera.bottom = -1.6; key.shadow.camera.near = .5; key.shadow.camera.far = 6; key.shadow.bias = -.0008;
  scene.add(key);
  const fill = new T.DirectionalLight(0x9ab4d4, 2.0); fill.position.set(1.6, 1.2, 2); scene.add(fill);
  const redGlow = new T.PointLight(0xff2a1a, 0, 1.6, 2), greenGlow = new T.PointLight(0x2bff6a, 0, 1.6, 2); scene.add(redGlow, greenGlow);

  const display = makeDisplay(); own(display.texture);
  let led: T.Mesh | undefined, ledG: T.Mesh | undefined, ledMat: T.MeshStandardMaterial | undefined, ledGMat: T.MeshStandardMaterial | undefined, lcdMat: T.MeshBasicMaterial | undefined;
  bomb.scene.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    o.castShadow = o.name !== 'ground'; o.receiveShadow = true;
    if (o.name === 'lcd') {
      lcdMat = own(new T.MeshBasicMaterial({ map: display.texture, toneMapped: false })); o.material = lcdMat; o.castShadow = false; o.receiveShadow = false;
    }
    if (o.name === 'led') { led = o; ledMat = o.material as T.MeshStandardMaterial; }
    if (o.name === 'led_green') { ledG = o; ledGMat = o.material as T.MeshStandardMaterial; }
  });
  hands.scene.traverse((o) => { if (o instanceof T.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  const ledPos = new T.Vector3(); led?.getWorldPosition(ledPos); redGlow.position.copy(ledPos).add(new T.Vector3(0, .12, 0)); greenGlow.position.copy(redGlow.position);
  const handR = hands.scene.getObjectByName('hand_R')!, handL = hands.scene.getObjectByName('hand_L')!;
  if (!handR || !handL || !led || !ledG || !lcdMat) throw new Error('Incomplete NINJA DEFUSE asset');

  // dust motes (slow, dim) and a few sparks that only show at the critical beat: one Points object, per-point colour as its brightness
  const N = 20, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seeds = Array.from({ length: N }, (_, i) => [Math.sin(i * 12.9) * .5 + .5, Math.sin(i * 78.2) * .5 + .5, Math.sin(i * 37.7) * .5 + .5]);
  const geo = own(new T.BufferGeometry()); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
  const points = new T.Points(geo, own(new T.PointsMaterial({ size: .014, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true })));
  points.frustumCulled = false; scene.add(points);

  // camera rig: a low three-quarter view over the display, keypad and LED, pushing in slowly; hands rest on either side
  const restR = new T.Vector3(.4, .45, .55), restL = new T.Vector3(-.64, .36, .6);
  handR.rotation.set(0, .12, 0); handL.rotation.set(0, -.3, 0);
  const home = new T.Vector3(.4, 1.22, 1.22), close = new T.Vector3(.16, 1.02, .92), look = new T.Vector3(-.06, .26, .02);
  const tmp = new T.Vector3(), pull = new T.Vector3();
  let aspect = 1, low = false;
  const update = (t: number) => {
    const s = ninjaTime(t, start), sh = ninjaShake(t, s.shake);
    display.draw(s.defused ? 'DEFUSED' : s.text, s.defused);
    lcdMat!.color.setScalar(s.defused ? 1 : .9 + .35 * s.critical);
    ledMat!.emissiveIntensity = s.led * 3.4; ledMat!.visible = !s.defused; led!.visible = !s.defused;
    ledG!.visible = s.green > 0; ledGMat!.emissiveIntensity = s.green * 3.6;
    redGlow.intensity = s.led * .6 + s.critical * 1.4; greenGlow.intensity = s.green * 1.2;
    key.intensity = 5 + s.critical * 1.2 - s.relax * .3;
    // hands: the right taps between the keypad and the wires, the left steadies the case; both ease off after the click
    const work = 1 - s.relax, tap = Math.max(0, Math.sin(t * 24)) * work, sweep = Math.sin(t * 6.5) * work;
    handR.position.set(restR.x - sweep * .05 - s.relax * .05, restR.y - tap * .022 + s.relax * .07, restR.z + sweep * .03 + s.relax * .1);
    handR.rotation.set(-.12 * tap, .12 + sweep * .06, 0);
    handL.position.set(restL.x + sh.x * 1.5 - s.relax * .04, restL.y + s.relax * .05 + Math.sin(t * 47) * .002 * s.shake, restL.z + s.relax * .08);
    // camera
    const k = s.push, back = aspect < 1 ? 1 + (1 / aspect - 1) * .5 : 1;
    camera.position.lerpVectors(home, close, k); pull.copy(camera.position).sub(look).multiplyScalar(back - 1); camera.position.add(pull);
    camera.position.x += sh.x; camera.position.y += sh.y; camera.up.set(0, 1, 0); camera.lookAt(look); camera.rotateZ(sh.roll);
    camera.fov = 50 - 2.5 * s.critical - 1.5 * k; camera.updateProjectionMatrix();
    // motes and sparks
    for (let i = 0; i < N; i++) {
      const [a, b, c] = seeds[i], spark = i >= 16;
      if (!spark) { pos[i * 3] = -.9 + a * 1.8 + Math.sin(t * .6 + b * 6) * .05; pos[i * 3 + 1] = .12 + b * .75 + t * .03 * (c + .3); pos[i * 3 + 2] = -.4 + c * 1.1; const v = low ? 0 : .22 * (.5 + .5 * Math.sin(t * 2 + a * 9)); col[i * 3] = v; col[i * 3 + 1] = v * .62; col[i * 3 + 2] = v * .3; }
      else { const age = clamp((t - .88) / .24), v = low || s.success ? 0 : Math.max(0, s.critical) * (1 - age) * 1.2; const d = age * (.12 + a * .12); pos[i * 3] = -.22 + (a - .5) * d * 3; pos[i * 3 + 1] = .43 + b * d * 2 - age * age * .08; pos[i * 3 + 2] = .08 + (c - .5) * d * 2; col[i * 3] = v; col[i * 3 + 1] = v * .5; col[i * 3 + 2] = v * .15; }
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    return s;
  };
  const resize = (w: number, h: number) => { aspect = w / Math.max(1, h); camera.aspect = aspect; camera.updateProjectionMatrix(); };
  const setLow = () => { low = true; key.castShadow = false; key.shadow.map?.dispose(); };
  const dispose = () => {
    for (const root of [bomb.scene, hands.scene]) root.traverse((o) => {
      if (!(o instanceof T.Mesh)) return; o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: T.Material) => { Object.values(m).forEach((v) => { if (v instanceof T.Texture) v.dispose(); }); m.dispose(); });
    });
    owned.forEach((r) => r.dispose()); key.shadow.map?.dispose();
  };
  update(0); resize(1, 1);
  return { scene, camera, update, resize, setLow, dispose };
}
