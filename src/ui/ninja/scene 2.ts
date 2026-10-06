import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { NINJA_CLICK, NINJA_DEFUSED, clamp, ledPhase, ninjaShake, ninjaTime } from './timeline';

const base = `${import.meta.env.BASE_URL}assets/highlights/ninja-defuse/`;
let file: Promise<ArrayBuffer> | undefined;
/** The bomb (scripts/legend-3d/ninja_bomb.py) is fetched once and kept as bytes; each mounted highlight parses its own copy, so it owns and disposes its GPU resources. */
export function preloadNinja() {
  return file ??= fetch(`${base}bomb.glb`, { signal: AbortSignal.timeout(6000) }).then((r) => {
    if (!r.ok) throw new Error('Missing bomb.glb');
    return r.arrayBuffer();
  }).catch((e) => { file = undefined; throw e; });
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
    ctx.fillStyle = '#050303'; ctx.fillRect(0, 0, 512, 192);
    ctx.fillStyle = ok ? 'rgba(67,255,134,.08)' : 'rgba(255,74,56,.07)'; for (let y = 0; y < 192; y += 6) ctx.fillRect(0, y, 512, 2);
    ctx.font = `800 ${ok ? 88 : 112}px "Courier New", ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = ok ? GREEN : RED; ctx.shadowBlur = 22; ctx.fillStyle = ok ? GREEN : RED; ctx.fillText(text, 256, 100);
    ctx.shadowBlur = 5; ctx.fillText(text, 256, 100); ctx.shadowBlur = 0; texture.needsUpdate = true;
  };
  return { texture, draw };
}
function glowTexture(rgb: string, soft = .3) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  const k = g.createRadialGradient(64, 64, 0, 64, 64, 64); k.addColorStop(0, `rgba(${rgb},1)`); k.addColorStop(soft, `rgba(${rgb},.35)`); k.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = k; g.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c);
}
function ringTexture(rgb: string) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
  const k = g.createRadialGradient(128, 128, 60, 128, 128, 126); k.addColorStop(0, `rgba(${rgb},0)`); k.addColorStop(.82, `rgba(${rgb},.9)`); k.addColorStop(.9, `rgba(${rgb},.35)`); k.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = k; g.fillRect(0, 0, 256, 256); return new T.CanvasTexture(c);
}

/** Soft, mottled smoke: a few hundred overlapping blurred blobs, drawn once. */
function smokeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
  for (let i = 0; i < 70; i++) {
    const x = 128 + (Math.sin(i * 12.9) * 70), y = 128 + (Math.sin(i * 78.2) * 70), r = 30 + (Math.sin(i * 37.7) * .5 + .5) * 60;
    const k = g.createRadialGradient(x, y, 0, x, y, r); k.addColorStop(0, 'rgba(255,255,255,.16)'); k.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = k; g.fillRect(0, 0, 256, 256);
  }
  const f = g.createRadialGradient(128, 128, 20, 128, 128, 128); f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = f; g.fillRect(0, 0, 256, 256);
  return new T.CanvasTexture(c);
}
/** The marking on the ground round the bomb: a bright ring, a thin inner one, tick marks and a few heavy segments. */
function groundRing(rgb: string) {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d')!; g.translate(512, 512);
  g.strokeStyle = `rgba(${rgb},1)`; g.shadowColor = `rgba(${rgb},1)`; g.shadowBlur = 18;
  g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 440, 0, 7); g.stroke(); g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 395, 0, 7); g.stroke();
  for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2, l = i % 6 === 0 ? 46 : 20; g.lineWidth = i % 6 === 0 ? 5 : 2.5; g.beginPath(); g.moveTo(Math.cos(a) * 452, Math.sin(a) * 452); g.lineTo(Math.cos(a) * (452 + l), Math.sin(a) * (452 + l)); g.stroke(); }
  g.lineWidth = 16; for (const a0 of [.2, 1.9, 3.6, 5.2]) { g.beginPath(); g.arc(0, 0, 470, a0, a0 + .5); g.stroke(); }
  return new T.CanvasTexture(c);
}

/** The finishing pass, harsh on purpose: a radial zoom smear, RGB split and horizontal glitch tearing that spike on every beat and run wild at the critical beat, a hard contrast curve with cold crushed blacks, a heavy vignette that bleeds red (green after the click), strobing, coarse grain and scan lines, and a white slam on the click. */
const FINISH = {
  uniforms: { tDiffuse: { value: null as T.Texture | null }, uTime: { value: 0 }, uCA: { value: .004 }, uGrain: { value: .045 }, uVig: { value: .95 }, uCrit: { value: 0 }, uGreen: { value: 0 }, uAspect: { value: 1 }, uBeat: { value: 0 }, uGlitch: { value: 0 }, uFlash: { value: 0 }, uStrobe: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uCA, uGrain, uVig, uCrit, uGreen, uAspect, uBeat, uGlitch, uFlash, uStrobe; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    vec3 tap(vec2 uv, vec2 off) { return vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b); }
    void main() {
      vec2 uv = vUv, c = uv - .5; c.x *= uAspect;
      // glitch: bands of the picture slide sideways in steps of time
      float band = floor(uv.y * 38.), g = step(.84, hash(vec2(band, floor(uTime * 22.)))) * uGlitch;
      uv.x += g * (hash(vec2(band, 7.)) - .5) * .09;
      uv += vec2(sin(uv.y * 46. + uTime * 31.), cos(uv.x * 38. + uTime * 27.)) * (.0018 * uCrit + .002 * uBeat);
      float r2 = dot(c, c);
      vec2 off = (vUv - .5) * (uCA + .012 * uBeat + .012 * uCrit) * (.5 + r2 * 4.);
      // radial smear towards the centre, harder on the beat
      vec2 dir = (vUv - .5) * (.012 * uBeat + .02 * uCrit);
      vec3 col = vec3(0.);
      for (int i = 0; i < 6; i++) { float k = float(i) / 5.; col += tap(uv - dir * k, off * (1. + k)); }
      col /= 6.;
      float l = dot(col, vec3(.299, .587, .114));
      col = mix(col, col * vec3(.7, .9, 1.25), (1. - smoothstep(0., .25, l)) * .6);
      col = (col - .03) * 1.2; col = max(col, 0.); col = pow(col, vec3(1.04));
      col *= 1. + .55 * uBeat;
      col *= 1. - smoothstep(.12, .6, r2) * uVig;
      col += uCrit * vec3(.34, .02, .01) * smoothstep(.06, .5, r2);
      col += uGreen * vec3(.0, .03, .01) * smoothstep(.1, .6, r2);
      col *= 1. - uStrobe * .55;
      col += vec3(1.) * uFlash;
      col += (hash(vUv * vec2(1920., 1080.) + uTime) - .5) * uGrain * (1. + uCrit);
      col *= 1. - (.03 + .04 * uCrit) * sin(vUv.y * 1100.);
      gl_FragColor = vec4(max(col, 0.), 1.);
    }`,
};

export async function createNinjaScene(start = 11) {
  const bytes = await preloadNinja();
  const bomb = await new GLTFLoader().parseAsync(bytes.slice(0), base);
  const scene = new T.Scene(); scene.background = new T.Color(0x020202); scene.fog = new T.FogExp2(0x030202, .62);
  const camera = new T.PerspectiveCamera(40, 1, .05, 30);
  const owned = new Set<T.BufferGeometry | T.Material | T.Texture>(); const own = <A extends T.BufferGeometry | T.Material | T.Texture>(r: A) => { owned.add(r); return r; };
  scene.add(bomb.scene);

  // very little ambient: the bomb is lit by a thin hot rim from behind, a dim warm key, and its own pulsing red light
  const probe = new T.WebGLRenderer({ canvas: document.createElement('canvas') });
  const pmrem = new T.PMREMGenerator(probe);
  const env = pmrem.fromScene(new RoomEnvironment(), .04); scene.environment = env.texture; scene.environmentIntensity = .12; pmrem.dispose(); probe.dispose(); probe.forceContextLoss();
  scene.add(new T.HemisphereLight(0x3a2c28, 0x1c0c04, .55));
  const front = new T.DirectionalLight(0xff7a30, .8); front.position.set(-.8, .9, 2.2); scene.add(front);
  const key = new T.DirectionalLight(0xffa060, 1.9); key.position.set(-1.6, 2.2, .8); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: .5, far: 7 }); key.shadow.bias = -.0006; key.shadow.normalBias = .02;
  scene.add(key);
  const rim = new T.DirectionalLight(0xff6a1a, 5); rim.position.set(1.5, 1.0, -1.8); scene.add(rim);
  const rim2 = new T.DirectionalLight(0xff3a1a, 2.4); rim2.position.set(-1.8, .8, -1.4); scene.add(rim2);
  const redLight = new T.PointLight(0xff4a1a, 0, 3.6, 1.5), greenLight = new T.PointLight(0x2bff6a, 0, 3.2, 1.6); scene.add(redLight, greenLight);

  const display = makeDisplay(); own(display.texture);
  const byName = (n: string) => bomb.scene.getObjectByName(n) as T.Object3D;
  let lcdMat: T.MeshBasicMaterial | undefined, ledMat: T.MeshStandardMaterial | undefined, ledGMat: T.MeshStandardMaterial | undefined;
  bomb.scene.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    o.castShadow = o.name !== 'ground'; o.receiveShadow = true;
    if (o.name === 'lcd') { o.position.y += .014; lcdMat = own(new T.MeshBasicMaterial({ map: display.texture, toneMapped: false })); o.material = lcdMat; o.castShadow = false; o.receiveShadow = false; }
    if (o.name === 'led') ledMat = o.material as T.MeshStandardMaterial;
    if (o.name === 'led_green') ledGMat = o.material as T.MeshStandardMaterial;
  });
  const led = byName('led'), ledG = byName('led_green'), lcd = byName('lcd');
  if (!led || !ledG || !lcd || !lcdMat || !ledMat || !ledGMat) throw new Error('Incomplete NINJA DEFUSE asset');
  bomb.scene.updateMatrixWorld(true);
  const ledWorld = new T.Vector3(); led.getWorldPosition(ledWorld); const lcdWorld = new T.Vector3(); lcd.getWorldPosition(lcdWorld);
  redLight.position.set(lcdWorld.x * .5 + ledWorld.x * .5, .75, .1); greenLight.position.copy(redLight.position);

  // the aura: soft glows around the LED and display, a pool of light on the ground, rings that pulse out with each beat, and rising embers
  const redTex = own(glowTexture('255,84,36')), greenTex = own(glowTexture('60,255,130')), poolTex = own(glowTexture('255,70,24', .15)), poolG = own(glowTexture('40,255,120', .15)), ringR = own(ringTexture('255,70,40')), ringG = own(ringTexture('70,255,140'));
  const additive = (m: T.MeshBasicMaterialParameters) => own(new T.MeshBasicMaterial({ transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false, fog: false, opacity: 0, ...m }));
  const sprite = (tex: T.Texture, size: number, at: T.Vector3) => { const s = new T.Sprite(own(new T.SpriteMaterial({ map: tex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0, fog: false }))); s.scale.setScalar(size); s.position.copy(at); scene.add(s); return s; };
  const ledGlow = sprite(redTex, .2, ledWorld), ledGreen = sprite(greenTex, .2, ledWorld);
  const lcdAt = lcdWorld.clone().add(new T.Vector3(0, .03, .08)); const lcdGlow = sprite(redTex, 1.1, lcdAt), lcdGreen = sprite(greenTex, 1.1, lcdAt);
  const haze = sprite(redTex, 3.4, new T.Vector3(0, .35, 0));
  const flat = (tex: T.Texture, size: number) => { const m = new T.Mesh(own(new T.PlaneGeometry(size, size)), additive({ map: tex, depthTest: true })); m.rotation.x = -Math.PI / 2; m.position.y = .012; scene.add(m); return m; };
  const pool = flat(poolTex, 4.4), poolGreen = flat(poolG, 4.4), rings = [flat(ringR, 1), flat(ringR, 1)], ringGreen = flat(ringG, 1);
  const markOrange = own(groundRing('255,92,32')), markGreen = own(groundRing('72,255,140'));
  const mark = flat(markOrange, 2.3), markG = flat(markGreen, 2.3); mark.position.y = .016; markG.position.y = .016;
  // orange smoke behind and around the bomb, lit from inside; and a big hot backlight
  const smokeTex = own(smokeTexture());
  const smoke = Array.from({ length: 9 }, (_, i) => { const m = new T.Sprite(own(new T.SpriteMaterial({ map: smokeTex, color: 0xff6a24, transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0, fog: false }))); const a = i / 9 * 6.283; m.position.set(Math.cos(a) * 1.5, .3 + (i % 3) * .3, -.6 + Math.sin(a) * 1.1); m.scale.setScalar(2.4 + (i % 4) * .7); scene.add(m); return { m, a, d: .6 + (i % 3) * .3 }; });
  const backlight = sprite(redTex, 6, new T.Vector3(1.1, .9, -1.4)), flash = sprite(redTex, 5, lcdWorld.clone().add(new T.Vector3(0, .05, .12)));
  (flash.material as T.SpriteMaterial).color.set(0xfff0e0);
  // big out-of-focus embers close to the camera, for depth
  const bokehN = 16, bpos = new Float32Array(bokehN * 3), bcol = new Float32Array(bokehN * 3);
  const bgeo = own(new T.BufferGeometry()); bgeo.setAttribute('position', new T.BufferAttribute(bpos, 3)); bgeo.setAttribute('color', new T.BufferAttribute(bcol, 3));
  const bokeh = new T.Points(bgeo, own(new T.PointsMaterial({ size: .16, map: own(glowTexture('255,120,50', .45)), vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true }))); bokeh.frustumCulled = false; scene.add(bokeh);

  const N = 260, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seeds = Array.from({ length: N }, (_, i) => [Math.sin(i * 12.9) * .5 + .5, Math.sin(i * 78.2) * .5 + .5, Math.sin(i * 37.7) * .5 + .5, Math.sin(i * 5.3) * .5 + .5]);
  const geo = own(new T.BufferGeometry()); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
  const points = new T.Points(geo, own(new T.PointsMaterial({ size: .016, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true })));
  points.frustumCulled = false; scene.add(points);

  // post: bloom, then the finishing pass, then the tone map
  let composer: EffectComposer | undefined, bloom: UnrealBloomPass | undefined, finish: ShaderPass | undefined, rendererRef: T.WebGLRenderer | undefined;
  const ensureComposer = (r: T.WebGLRenderer) => {
    if (composer && rendererRef === r) return composer;
    rendererRef = r; composer?.dispose();
    composer = new EffectComposer(r); composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new T.Vector2(256, 256), .75, .55, .78); composer.addPass(bloom);
    finish = new ShaderPass(FINISH); composer.addPass(finish); composer.addPass(new OutputPass());
    const s = r.getSize(new T.Vector2()); composer.setPixelRatio(r.getPixelRatio()); composer.setSize(s.x, s.y); return composer;
  };

  let aspect = 1, low = false;
  const homeA = new T.Vector3(.6, 1.6, 1.3), homeB = new T.Vector3(.12, 1.32, .98), look = new T.Vector3(), pull = new T.Vector3();
  const update = (t: number) => {
    const s = ninjaTime(t, start), sh = ninjaShake(t, s.shake + .7 * s.critical);
    const bp = ledPhase(t), beat = s.defused ? 0 : Math.exp(-(bp % 1) * 8) * (.5 + .5 * s.progress);   // a sharp spike at the start of every LED beat
    display.draw(s.defused ? 'DEFUSED' : s.text, s.defused);
    const flicker = s.critical > 0 ? 1 - .12 * (Math.sin(t * 190) > .6 ? 1 : 0) * s.critical : 1;
    lcdMat!.color.setScalar((s.defused ? 1.15 : 1.2 + .4 * s.critical + .6 * beat) * flicker);
    ledMat!.emissiveIntensity = s.led * 6; led.visible = !s.defused; ledG.visible = s.green > 0; ledGMat!.emissiveIntensity = s.green * 6;
    // the red light breathes with the LED and swells at the critical beat; it is what lights the ground
    redLight.intensity = (s.led * 1.1 + beat * 5 + s.critical * 7) * (s.defused ? 0 : 1); greenLight.intensity = s.green * 2.2;
    const m = (sp: T.Sprite) => sp.material as T.SpriteMaterial;
    m(ledGlow).opacity = s.led; ledGlow.scale.setScalar(.14 + s.led * .1 + s.critical * .12);
    m(ledGreen).opacity = Math.min(1, s.green * 1.2);
    m(lcdGlow).opacity = s.defused ? 0 : .06 + .03 * s.led + .14 * s.critical; m(lcdGreen).opacity = s.green * .18;
    m(haze).opacity = s.defused ? .01 : .02 + .02 * s.led + .05 * s.critical;
    smoke.forEach(({ m: sm, a, d }, i) => { const sp = sm.material as T.SpriteMaterial; sp.opacity = (s.defused ? .02 : .035 + .03 * s.led + .05 * s.critical + .02 * beat) * (.6 + .4 * Math.sin(t * d + i)); sp.rotation = t * .06 * (i % 2 ? 1 : -1) + a; sm.position.x = Math.cos(a + t * .08 * d) * 1.5; sm.position.z = -.6 + Math.sin(a + t * .08 * d) * 1.1; if (s.green > 0) sp.color.set(0xff6a24).lerp(new T.Color(0x3aff90), Math.min(.18, s.green * .2)); else sp.color.set(0xff6a24); });
    m(backlight).opacity = s.defused ? .04 : .07 + .05 * s.led + .08 * s.critical;
    const fl = t >= NINJA_CLICK ? clamp(1 - (t - NINJA_CLICK) / .3) : 0; m(flash).opacity = fl * .8; flash.scale.setScalar(1.6 + (1 - fl) * 2.2);
    (mark.material as T.MeshBasicMaterial).opacity = s.defused ? 0 : .5 + .3 * s.led + .5 * beat; (markG.material as T.MeshBasicMaterial).opacity = s.green * .85; mark.rotation.z = t * .12; markG.rotation.z = -t * .1;
    for (let i = 0; i < bokehN; i++) { const a = i * 2.399 + t * (.05 + (i % 5) * .02), r = .9 + (i % 7) * .22, up = ((t * (.04 + (i % 4) * .03) + i * .137) % 1); bpos[i * 3] = Math.cos(a) * r; bpos[i * 3 + 1] = .1 + up * 1.4; bpos[i * 3 + 2] = Math.sin(a) * r * .8 + .4; const v = (1 - up) * Math.min(1, up * 6) * (.18 + .3 * s.led + .35 * s.critical + .15 * beat); bcol[i * 3] = v; bcol[i * 3 + 1] = v * (s.green > 0 ? 1.6 : .5); bcol[i * 3 + 2] = v * (s.green > 0 ? .8 : .18); }
    bgeo.attributes.position.needsUpdate = true; bgeo.attributes.color.needsUpdate = true;
    const mat = (o: T.Mesh) => o.material as T.MeshBasicMaterial;
    mat(pool).opacity = s.defused ? 0 : .06 + .06 * s.led + .18 * s.critical; mat(poolGreen).opacity = s.green * .22;
    // a ring leaves the bomb on every beat, two staggered; a green one spreads out at the click
    const phase = ledPhase(t), live = s.defused ? 0 : 1;
    rings.forEach((r, i) => { const f = (phase + i * .5) % 1; r.scale.setScalar(.7 + f * 3.6); mat(r).opacity = live * (1 - f) * (.16 + .4 * s.critical); });
    const ga = clamp((t - NINJA_DEFUSED) / .55); ringGreen.scale.setScalar(.6 + ga * 4.4); mat(ringGreen).opacity = t >= NINJA_DEFUSED ? (1 - ga) * .4 : 0;
    key.intensity = 1.8 + s.critical * .8; rim.intensity = 6 + s.critical * 3 - s.relax * 1.5;
    if (bloom) bloom.strength = .8 + .7 * s.critical + .6 * beat + .3 * s.green;
    if (finish) {
      const u = finish.uniforms, flash = t >= NINJA_CLICK && t < NINJA_CLICK + .06 ? 1 - (t - NINJA_CLICK) / .06 : 0;
      u.uTime.value = t; u.uCA.value = .004 + .004 * s.shake; u.uVig.value = .7 + .1 * s.critical; u.uCrit.value = s.critical; u.uGreen.value = s.green * .5; u.uAspect.value = aspect;
      u.uBeat.value = beat; u.uGlitch.value = Math.min(1, .25 * beat + 1.2 * s.critical); u.uFlash.value = flash * .55;
      u.uStrobe.value = s.critical > 0 && Math.sin(t * 260) > .2 ? s.critical * .6 : 0;
    }
    // camera: low and close, a slow drift round the bomb, a tilt that tightens, a tremor that grows with the tension and dies at the click
    const k = s.push, back = aspect < 1 ? 1 + (1 / aspect - 1) * .65 : 1;
    camera.position.lerpVectors(homeA, homeB, k); camera.position.x += Math.sin(t * .8) * .09 * (1 - s.relax * .5); camera.position.y += Math.sin(t * .55) * .02;
    look.set(lcdWorld.x * (.3 + .4 * k), .2, .02); pull.copy(camera.position).sub(look).multiplyScalar(back - 1); camera.position.add(pull);
    camera.position.x += sh.x * 2.5 + (beat > .3 ? Math.sin(t * 140) * .012 * beat : 0); camera.position.y += sh.y * 2.5 + (beat > .3 ? Math.cos(t * 160) * .009 * beat : 0); camera.up.set(0, 1, 0); camera.lookAt(look); camera.rotateZ(.05 * (1 - k * .6) + sh.roll);
    camera.fov = (38 - 3 * s.critical - 4 * k - 3 * beat) * (aspect < 1 ? 1.2 : 1); camera.updateProjectionMatrix();
    for (let i = 0; i < N; i++) {
      const [a, b, c, d] = seeds[i], spark = i >= 230, up = (t * (.05 + .08 * d) + b) % 1;
      if (!spark) {
        const ang = a * 6.283 + t * .15 * (d - .5), rad = .25 + c * 1.3;
        pos[i * 3] = Math.cos(ang) * rad; pos[i * 3 + 1] = .02 + up * 1.3; pos[i * 3 + 2] = Math.sin(ang) * rad * .8;
        const v = low ? 0 : (1 - up) * Math.min(1, up * 8) * (.35 + .5 * d) * (.5 + .5 * Math.sin(t * 3 + a * 20)) * (.4 + .6 * s.led + s.critical); col[i * 3] = v; col[i * 3 + 1] = v * .42; col[i * 3 + 2] = v * .12;
      } else {
        const age = clamp((t - .88) / .3), v = low || s.success ? 0 : s.critical * (1 - age) * 2, dd = age * (.15 + a * .2);
        pos[i * 3] = lcdWorld.x + (a - .5) * dd * 5; pos[i * 3 + 1] = lcdWorld.y + .08 + b * dd * 2.5 - age * age * .12; pos[i * 3 + 2] = lcdWorld.z + (c - .5) * dd * 4; col[i * 3] = v; col[i * 3 + 1] = v * .55; col[i * 3 + 2] = v * .2;
      }
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    return s;
  };
  const resize = (w: number, h: number) => { aspect = w / Math.max(1, h); camera.aspect = aspect; camera.updateProjectionMatrix(); composer?.setSize(w, h); };
  const render = (r: T.WebGLRenderer) => { if (low) r.render(scene, camera); else ensureComposer(r).render(); };
  const setLow = () => { low = true; key.castShadow = false; key.shadow.map?.dispose(); };
  const dispose = () => {
    bomb.scene.traverse((o) => {
      if (!(o instanceof T.Mesh)) return; o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt: T.Material) => { Object.values(mt).forEach((v) => { if (v instanceof T.Texture) v.dispose(); }); mt.dispose(); });
    });
    owned.forEach((r) => r.dispose()); env.dispose(); key.shadow.map?.dispose(); composer?.dispose();
  };
  /** Where the camera is right now: used by the debug diagnostics to check the motion has no pops. */
  const pose = () => [...camera.position.toArray()];
  update(0); resize(1, 1);
  return { scene, camera, update, resize, render, setLow, dispose, pose };
}
