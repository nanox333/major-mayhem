import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, ninjaShake, ninjaTime } from './timeline';

const base = `${import.meta.env.BASE_URL}assets/highlights/ninja-defuse/`;
let files: Promise<[ArrayBuffer, ArrayBuffer]> | undefined;
/** The two GLBs (scripts/legend-3d/ninja_bomb.py, ninja_glove.py) are fetched once and kept as bytes; each mounted highlight parses its own copy, so it owns and disposes its GPU resources. */
export function preloadNinja() {
  return files ??= Promise.all(['bomb.glb', 'glove.glb'].map(async (name) => {
    const r = await fetch(base + name, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error(`Missing ${name}`);
    return r.arrayBuffer();
  })).then((v) => v as [ArrayBuffer, ArrayBuffer]).catch((e) => { files = undefined; throw e; });
}

const RED = '#ff4a38', GREEN = '#43ff86';
/** The display: digits drawn once per change into a canvas, so they stay crisp and cost one upload per step. */
function makeDisplay() {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
  const ctx = canvas.getContext('2d')!, texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4; texture.repeat.set(1, -1); texture.offset.set(0, 1); texture.wrapT = T.RepeatWrapping;
  let shown = '';
  const draw = (text: string, ok: boolean) => {
    const key = `${text}|${ok}`; if (key === shown) return; shown = key;
    ctx.fillStyle = '#060404'; ctx.fillRect(0, 0, 512, 192);
    ctx.fillStyle = ok ? 'rgba(67,255,134,.07)' : 'rgba(255,74,56,.06)'; for (let y = 0; y < 192; y += 6) ctx.fillRect(0, y, 512, 2);
    ctx.font = `800 ${ok ? 88 : 112}px "Courier New", ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = ok ? GREEN : RED; ctx.shadowBlur = 20; ctx.fillStyle = ok ? GREEN : RED; ctx.fillText(text, 256, 100);
    ctx.shadowBlur = 5; ctx.fillText(text, 256, 100); ctx.shadowBlur = 0; texture.needsUpdate = true;
  };
  return { texture, draw };
}
function glowTexture(rgb: string) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  const k = g.createRadialGradient(64, 64, 0, 64, 64, 64); k.addColorStop(0, `rgba(${rgb},1)`); k.addColorStop(.3, `rgba(${rgb},.35)`); k.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = k; g.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c);
}

/** Which key the right hand presses at a given moment: a fixed, hurried pattern that speeds up with the tension. */
const KEYS: [number, number][] = [[1, 1], [2, 0], [0, 2], [3, 1], [1, 0], [2, 2], [0, 1], [3, 2], [1, 2], [2, 1]];

export async function createNinjaScene(start = 11) {
  const [bombBytes, handBytes] = await preloadNinja();
  const loader = new GLTFLoader();
  const [bomb, hands] = await Promise.all([loader.parseAsync(bombBytes.slice(0), base), loader.parseAsync(handBytes.slice(0), base)]);
  const scene = new T.Scene(); scene.background = new T.Color(0x060606); scene.fog = new T.FogExp2(0x060606, .42);
  const camera = new T.PerspectiveCamera(42, 1, .05, 30);
  const owned = new Set<T.BufferGeometry | T.Material | T.Texture>(); const own = <A extends T.BufferGeometry | T.Material | T.Texture>(r: A) => { owned.add(r); return r; };
  scene.add(bomb.scene, hands.scene);

  // image-based light for the metal, kept low; the look comes from a warm key, a hot orange rim and a small red glow
  const probe = new T.WebGLRenderer({ canvas: document.createElement('canvas') });
  const pmrem = new T.PMREMGenerator(probe);
  const env = pmrem.fromScene(new RoomEnvironment(), .04); scene.environment = env.texture; scene.environmentIntensity = .35; pmrem.dispose(); probe.dispose(); probe.forceContextLoss();
  scene.add(new T.HemisphereLight(0x4a5260, 0x2a1a0c, .9));
  const key = new T.DirectionalLight(0xffa35c, 4.2); key.position.set(-1.4, 2.4, 1.2); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: .5, far: 7 }); key.shadow.bias = -.0006; key.shadow.normalBias = .02;
  scene.add(key);
  const rim = new T.DirectionalLight(0xff7a2a, 3.2); rim.position.set(1.8, 1.1, -1.6); scene.add(rim);
  const fill = new T.DirectionalLight(0x8aa6c8, .9); fill.position.set(1.4, 1.4, 2.2); scene.add(fill);
  const redLight = new T.PointLight(0xff2a1a, 0, 1.4, 2), greenLight = new T.PointLight(0x2bff6a, 0, 1.4, 2); scene.add(redLight, greenLight);

  // named parts the clock drives
  const display = makeDisplay(); own(display.texture);
  const byName = (root: T.Object3D, n: string) => root.getObjectByName(n) as T.Object3D;
  let lcdMat: T.MeshBasicMaterial | undefined, ledMat: T.MeshStandardMaterial | undefined, ledGMat: T.MeshStandardMaterial | undefined;
  bomb.scene.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    o.castShadow = o.name !== 'ground'; o.receiveShadow = true;
    if (o.name === 'lcd') { o.position.y += .014; /* clear of the glass so the two never fight for depth */ lcdMat = own(new T.MeshBasicMaterial({ map: display.texture, toneMapped: false })); o.material = lcdMat; o.castShadow = false; o.receiveShadow = false; }
    if (o.name === 'led') ledMat = o.material as T.MeshStandardMaterial;
    if (o.name === 'led_green') ledGMat = o.material as T.MeshStandardMaterial;
  });
  hands.scene.traverse((o) => { if (o instanceof T.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  const led = byName(bomb.scene, 'led'), ledG = byName(bomb.scene, 'led_green'), lcd = byName(bomb.scene, 'lcd');
  const handR = byName(hands.scene, 'hand_R'), handL = byName(hands.scene, 'hand_L');
  if (!led || !ledG || !lcd || !handR || !handL || !lcdMat || !ledMat || !ledGMat) throw new Error('Incomplete NINJA DEFUSE assets');
  const keys = KEYS.map(([r, c]) => byName(bomb.scene, `key_${r}_${c}`));
  const keyY = keys.map((k) => k.position.y);
  bomb.scene.updateMatrixWorld(true);
  const ledWorld = new T.Vector3(); led.getWorldPosition(ledWorld); redLight.position.copy(ledWorld).add(new T.Vector3(0, .1, .05)); greenLight.position.copy(redLight.position);
  const lcdWorld = new T.Vector3(); lcd.getWorldPosition(lcdWorld);
  const redTex = own(glowTexture('255,60,40')), greenTex = own(glowTexture('60,255,130'));
  const sprite = (tex: T.Texture, size: number, at: T.Vector3) => { const s = new T.Sprite(own(new T.SpriteMaterial({ map: tex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0, fog: false }))); /* glows are overlays: depth-testing them cut jagged holes where they crossed the case */; s.scale.setScalar(size); s.position.copy(at); scene.add(s); return s; };
  const ledGlow = sprite(redTex, .16, ledWorld), ledGreen = sprite(greenTex, .16, ledWorld), lcdGlow = sprite(redTex, .78, lcdWorld.clone().add(new T.Vector3(0, .02, .06))), lcdGreen = sprite(greenTex, .78, lcdWorld.clone().add(new T.Vector3(0, .02, .06)));

  // each glove is one sculpted mesh (from a Meshy model, see ninja_glove.py); a dark sleeve runs back from the wrist
  const sleeveMat = own(new T.MeshStandardMaterial({ color: 0x1d1f21, roughness: .92, metalness: 0 }));
  for (const h of [handR, handL]) { const sl = new T.Mesh(own(new T.CylinderGeometry(.13, .165, .8, 24, 1, true)), sleeveMat); sl.rotation.x = Math.PI / 2; sl.position.set(0, .015, .6); sl.scale.set(.92, 1, 1.05); sl.castShadow = true; h.add(sl); }

  // dust motes and a few sparks at the critical beat
  const N = 40, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seeds = Array.from({ length: N }, (_, i) => [Math.sin(i * 12.9) * .5 + .5, Math.sin(i * 78.2) * .5 + .5, Math.sin(i * 37.7) * .5 + .5]);
  const geo = own(new T.BufferGeometry()); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
  const points = new T.Points(geo, own(new T.PointsMaterial({ size: .012, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true })));
  points.frustumCulled = false; scene.add(points);

  // post: a restrained bloom so the display and the LEDs glow, nothing more
  let composer: EffectComposer | undefined, bloom: UnrealBloomPass | undefined, rendererRef: T.WebGLRenderer | undefined;
  const ensureComposer = (r: T.WebGLRenderer) => {
    if (composer && rendererRef === r) return composer;
    rendererRef = r; composer?.dispose();
    composer = new EffectComposer(r); composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new T.Vector2(256, 256), .55, .6, .86); composer.addPass(bloom); composer.addPass(new OutputPass());
    const s = r.getSize(new T.Vector2()); composer.setPixelRatio(r.getPixelRatio()); composer.setSize(s.x, s.y); return composer;
  };

  let aspect = 1, low = false;
  const homeA = new T.Vector3(.55, 1.5, 1.55), homeB = new T.Vector3(.18, 1.16, 1.02), look = new T.Vector3(), pull = new T.Vector3();
  const keyTarget = new T.Vector3(), keyNext = new T.Vector3();
  const update = (t: number) => {
    const s = ninjaTime(t, start), sh = ninjaShake(t, s.shake), work = 1 - s.relax;
    display.draw(s.defused ? 'DEFUSED' : s.text, s.defused);
    lcdMat!.color.setScalar(s.defused ? 1 : .95 + .3 * s.critical);
    ledMat!.emissiveIntensity = s.led * 3.2; led.visible = !s.defused; ledG.visible = s.green > 0; ledGMat!.emissiveIntensity = s.green * 3.2;
    redLight.intensity = s.led * .7 + s.critical * 1.6; greenLight.intensity = s.green * 1.4;
    (ledGlow.material as T.SpriteMaterial).opacity = s.led * .9; ledGlow.scale.setScalar(.12 + s.led * .06 + s.critical * .05);
    (ledGreen.material as T.SpriteMaterial).opacity = Math.min(1, s.green * 1.2);
    (lcdGlow.material as T.SpriteMaterial).opacity = s.defused ? 0 : .16 + .22 * s.critical + .05 * s.led;
    (lcdGreen.material as T.SpriteMaterial).opacity = s.green * .32;
    key.intensity = 4.2 + s.critical * 1.4; rim.intensity = 3.2 + s.critical * .8 - s.relax * .3;
    if (bloom) bloom.strength = .5 + .35 * s.critical + .2 * s.green;
    // right hand: it glides from key to key on a smooth path (never jumping), dips to press each one, and eases off after the click
    const rate = 2.4 + 2.6 * s.progress, ph = t * rate, i0 = Math.floor(ph), local = ph - i0, idx = i0 % KEYS.length, next = (i0 + 1) % KEYS.length;
    const glide = local < .45 ? 0 : (() => { const k = (local - .45) / .55; return k * k * (3 - 2 * k); })();
    const press = work * Math.sin(clamp(local / .45) * Math.PI) ** 2 * (local < .45 ? 1 : 0);
    keys[idx].getWorldPosition(keyTarget); keys[next].getWorldPosition(keyNext); keyTarget.lerp(keyNext, glide);
    keys.forEach((k, i) => { k.position.y = keyY[i] - (i === idx ? press * .02 : 0); });
    const sway = Math.sin(t * 2.3) * .004 * work;
    handR.position.set(keyTarget.x + .1 + s.relax * .1 + sway, .53 + (1 - press) * .04 + s.relax * .2, keyTarget.z + .4 + s.relax * .1);
    handR.rotation.set(-.3 - press * .12, .28 + (keyTarget.x - .27) * .5 + Math.sin(t * 2.9) * .012 * work, 0); handR.scale.setScalar(.8);
    // left hand: holds the case steady, with a soft tremor that grows with the tension
    const trem = s.shake * work;
    handL.position.set(-.42 + Math.sin(t * 5.3) * .003 * trem - s.relax * .05, .5 + s.relax * .18 + Math.sin(t * 7.1) * .0025 * trem, .56 + s.relax * .12);
    handL.scale.setScalar(.8); handL.rotation.set(-.2, -.22 + Math.sin(t * 4.1) * .01 * trem, 0);
    // camera: a slow orbit and push-in (real parallax), a handheld tremor that grows with the tension, dead still at the click, easing back after it
    const k = s.push, back = aspect < 1 ? 1 + (1 / aspect - 1) * .55 : 1;
    camera.position.lerpVectors(homeA, homeB, k); camera.position.x += Math.sin(t * .9) * .05 * (1 - s.relax);
    look.set(lcdWorld.x * .5 * k + .08, .28, .1); pull.copy(camera.position).sub(look).multiplyScalar(back - 1); camera.position.add(pull);
    camera.position.x += sh.x * 2; camera.position.y += sh.y * 2; camera.up.set(0, 1, 0); camera.lookAt(look); camera.rotateZ(sh.roll);
    camera.fov = 42 - 2 * s.critical - 3 * k; camera.updateProjectionMatrix();
    for (let i = 0; i < N; i++) {
      const [a, b, c] = seeds[i], spark = i >= 34;
      if (!spark) { pos[i * 3] = -1 + a * 2; pos[i * 3 + 1] = .08 + b * .9 + ((t * .04 * (c + .3)) % .25); pos[i * 3 + 2] = -.6 + c * 1.6 + Math.sin(t * .7 + b * 6) * .04; const v = low ? 0 : .3 * (.4 + .6 * Math.sin(t * 2 + a * 9) ** 2); col[i * 3] = v; col[i * 3 + 1] = v * .62; col[i * 3 + 2] = v * .3; }
      else { const age = clamp((t - .88) / .24), v = low || s.success ? 0 : s.critical * (1 - age) * 1.4, d = age * (.14 + a * .16); pos[i * 3] = lcdWorld.x + (a - .5) * d * 4; pos[i * 3 + 1] = lcdWorld.y + .08 + b * d * 2 - age * age * .1; pos[i * 3 + 2] = lcdWorld.z + (c - .5) * d * 3; col[i * 3] = v; col[i * 3 + 1] = v * .5; col[i * 3 + 2] = v * .15; }
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    return s;
  };
  const resize = (w: number, h: number) => { aspect = w / Math.max(1, h); camera.aspect = aspect; camera.updateProjectionMatrix(); composer?.setSize(w, h); };
  const render = (r: T.WebGLRenderer) => { if (low) r.render(scene, camera); else ensureComposer(r).render(); };
  const setLow = () => { low = true; key.castShadow = false; key.shadow.map?.dispose(); };
  const dispose = () => {
    for (const root of [bomb.scene, hands.scene]) root.traverse((o) => {
      if (!(o instanceof T.Mesh)) return; o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: T.Material) => { Object.values(m).forEach((v) => { if (v instanceof T.Texture) v.dispose(); }); m.dispose(); });
    });
    owned.forEach((r) => r.dispose()); env.dispose(); key.shadow.map?.dispose(); composer?.dispose();
  };
  update(0); resize(1, 1);
  return { scene, camera, update, resize, render, setLow, dispose };
}
