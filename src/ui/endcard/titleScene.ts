import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { highlightReflections } from '../legend3d/lighting';
import { ember, glint, landingTime, letterPose, settledAt, shake, slash, slice, slicePose, smooth, spark, wave } from './titleAnim';

export type TitleName = 'noscope' | 'ninja' | 'ace' | 'knife' | 'clutch';
export const TITLE_STYLE: Record<TitleName, { tint: string; glow: string; spark: string; cross?: boolean; /** how much of the usual frame the title may fill (below 1 for a scene with a figure under it) */ fit?: number }> = {
  noscope: { tint: '#ff8412', glow: '#ff7a1c', spark: '#ffb060' },
  ninja: { tint: '#22d52a', glow: '#52ff6a', spark: '#a6ff8a' },
  ace: { tint: '#ff7a14', glow: '#ff7a1c', spark: '#ffb060' },
  knife: { tint: '#ff3a22', glow: '#ff3b2a', spark: '#ff3b24', cross: true },
  clutch: { tint: '#ff7a14', glow: '#ff7a1c', spark: '#ffb060', fit: .76 },
};

const cache = new Map<TitleName, Promise<T.Group>>();
/** One CPU copy of each title (made in Blender, scripts/legend-3d/title3d.py); every mount clones it. */
export function load(name: TitleName) {
  let p = cache.get(name);
  if (!p) {
    const url = `${import.meta.env.BASE_URL}assets/highlights/endcards/title-${name}.glb`;
    p = fetch(url, { signal: AbortSignal.timeout(4000) }).then(async (r) => { if (!r.ok) throw new Error('title unavailable'); return (await new GLTFLoader().parseAsync(await r.arrayBuffer(), url)).scene; });
    p.catch(() => cache.delete(name)); cache.set(name, p);
  }
  return p;
}

/** The letter surface, in the site's own style: clean satin paint with a soft vertical gradient on the face, dark metal sides and bevels that catch
 *  the reflections, and a burn-in dissolve for the entrance. Heat (the energy wave and the landing flash) lights the face. */
function panel(m: T.MeshStandardMaterial, opts: { accent: string }) {
  m.userData.heat = { value: 0 }; m.userData.dissolve = { value: 0 };
  m.onBeforeCompile = function (this: T.Material, shader) {
    shader.uniforms.uHeat = this.userData.heat; shader.uniforms.uDissolve = this.userData.dissolve; shader.uniforms.uAccent = { value: new T.Color(opts.accent) };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;varying vec3 vLN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP=position;vLN=normal;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vLP;varying vec3 vLN;uniform float uHeat;uniform float uDissolve;uniform vec3 uAccent;
float gh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float gn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(gh(i),gh(i+vec2(1.0,0.0)),f.x),mix(gh(i+vec2(0.0,1.0)),gh(i+vec2(1.0,1.0)),f.x),f.y);}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
float tDn=gn(vLP.xy*5.0+vLP.z*2.0)*.7+gn(vLP.xy*17.0)*.3;
if(tDn<uDissolve)discard;
float tBurn=(1.0-smoothstep(uDissolve,uDissolve+.08,tDn))*step(.001,uDissolve);
float tFront=smoothstep(.62,.9,abs(vLN.z));
vec3 tPaint=diffuseColor.rgb*mix(.8,1.12,smoothstep(-.55,.5,vLP.y));
diffuseColor.rgb=mix(vec3(.05,.047,.045),tPaint,tFront);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(.28,.4,tFront);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor=mix(.85,.12,tFront);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=uAccent*(tFront*uHeat*.55+tBurn*6.0);');
  };
  m.customProgramCacheKey = () => 'panel';
}

/** A blood splat drawn on a canvas: a heavy core, tapering spikes, flung drops. Deterministic. */
function splatTexture(seed: number) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
  const r = (n: number) => { const x = Math.sin(seed * 91.7 + n * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const fill = g.createRadialGradient(128, 128, 10, 128, 128, 120); fill.addColorStop(0, '#b01408'); fill.addColorStop(1, '#6e0a06'); g.fillStyle = fill;
  g.beginPath(); g.arc(128, 128, 44, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + r(i) * .3, len = 62 + r(i + 40) * 58, w = 5 + r(i + 80) * 9;
    g.save(); g.translate(128, 128); g.rotate(a); g.beginPath(); g.moveTo(0, -w); g.quadraticCurveTo(len * .5, -w * .7, len, 0); g.quadraticCurveTo(len * .5, w * .7, 0, w); g.closePath(); g.fill(); g.restore();
  }
  for (let i = 0; i < 46; i++) { const a = r(i + 120) * Math.PI * 2, d = 72 + r(i + 160) * 52; g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 2 + r(i + 200) * 7, 0, Math.PI * 2); g.fill(); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

/** A 1-D gradient used for the speed streaks, the slash and the slice: transparent at the left, solid at the right (or soft at both ends). */
function gradient(both: boolean) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 4; const g = c.getContext('2d')!;
  const l = g.createLinearGradient(0, 0, 256, 0);
  if (both) { l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(.5, 'rgba(255,255,255,1)'); l.addColorStop(1, 'rgba(255,255,255,0)'); }
  else { l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(.85, 'rgba(255,255,255,.9)'); l.addColorStop(1, 'rgba(255,255,255,1)'); }
  g.fillStyle = l; g.fillRect(0, 0, 256, 4);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
/** Additive light for a transparent canvas: the colour adds, the alpha is left alone (premultiplied, so the page behind shows through and the glow adds to it). */
const ADD = { blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.SrcAlphaFactor, blendDst: T.OneFactor, blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneFactor } as const;
const additive = (map: T.Texture, color: string | number) => new T.MeshBasicMaterial({ map, color, transparent: true, depthWrite: false, ...ADD, toneMapped: false, side: T.DoubleSide });

/** The title scene: the Blender letters swung in by titleAnim, lit, with sparks, an energy wave, a slice. */
export async function createTitle(name: TitleName) {
  const src = await load(name), style = TITLE_STYLE[name];
  const group = new T.Group(), root = src.clone(true);
  const letters: { obj: T.Object3D; word: number; index: number; half: number; home: T.Vector3; mat: T.MeshStandardMaterial }[] = [];
  const counts = [0, 0];
  const tint = new T.MeshStandardMaterial({ color: style.tint, emissive: '#000000', metalness: .12, roughness: .4 });
  const cream = new T.MeshStandardMaterial({ color: '#f4efe6', emissive: '#000000', metalness: .12, roughness: .4 });
  panel(tint, { accent: style.spark }); panel(cream, { accent: style.spark });
  const lineTex = gradient(true);
  root.traverse((o) => {
    const m = /^([ab])_(\d+)(?:_([pq]))?$/.exec(o.name); if (!m) return;
    const word = m[1] === 'a' ? 0 : 1, index = +m[2], half = m[3] === 'p' ? 1 : m[3] === 'q' ? -1 : 0; counts[word] = Math.max(counts[word], index + 1);
    const mesh = o as T.Mesh, proto = word ? cream : tint, mat = proto.clone(); mat.onBeforeCompile = proto.onBeforeCompile; mat.customProgramCacheKey = proto.customProgramCacheKey; mat.userData = { heat: { value: 0 }, dissolve: { value: 0 } }; mesh.material = mat;
    letters.push({ obj: o, word, index, half, home: o.position.clone(), mat });
  });
  group.add(root);
  const box = new T.Box3().setFromObject(root), size = box.getSize(new T.Vector3()), centre = box.getCenter(new T.Vector3());
  letters.forEach((l) => l.home.sub(centre)); // the letters are positioned from their own homes, centred on the title
  const frame = new T.Group(); frame.add(group); frame.rotation.z = -.14; // the same tilt as the ace's wordmark
  const CUT = (28 * Math.PI) / 180, TURN = -.3, PITCH = .1; group.rotation.set(PITCH, TURN, 0); // turned a little so the thickness and the side faces show

  const scene = new T.Scene(), camera = new T.PerspectiveCamera(26, 16 / 9, .1, 80);
  scene.add(frame);
  scene.add(new T.HemisphereLight('#ffd9b0', '#1a0d06', .4));
  const key = new T.DirectionalLight('#ffe6c8', .85); key.position.set(-3, 4, 6); scene.add(key);
  const rim = new T.PointLight(style.glow, 18, 14, 1.4); rim.position.set(2.5, -1, -2.5); scene.add(rim);
  const sweep = new T.PointLight('#ffffff', 0, 9, 1.6); sweep.position.set(0, 0, 2.2); scene.add(sweep);

  // a soft glow behind the title (replaces a CSS drop-shadow, which is costly on a full-screen canvas) and a screen flash on the camera
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!, r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.45, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c); })();
  const glowMat = new T.SpriteMaterial({ map: glowTex, color: style.glow, transparent: true, depthWrite: false, ...ADD, toneMapped: false, opacity: .2 });
  const glowSprite = new T.Sprite(glowMat); glowSprite.position.z = -.9; glowSprite.scale.set(size.x * 1.9, size.y * 1.7, 1); frame.add(glowSprite);
  const flashMat = new T.MeshBasicMaterial({ color: '#fff0d8', transparent: true, opacity: 0, depthTest: false, depthWrite: false, ...ADD, toneMapped: false });
  const flashQuad = new T.Mesh(new T.PlaneGeometry(1, 1), flashMat); flashQuad.position.z = -1; flashQuad.renderOrder = 99; flashQuad.frustumCulled = false; camera.add(flashQuad); scene.add(camera);

  // the opening slash, the slice after the wave,
  const slashMesh = new T.Mesh(new T.PlaneGeometry(1, .06), additive(lineTex, '#fff2d8')); slashMesh.position.z = .4; slashMesh.visible = false; frame.add(slashMesh);
  // the knife kill opens like its own scene: two slashes cross in an X (the same angle the letters are cut on), and each word lands in a blood splat
  const slashMesh2 = new T.Mesh(slashMesh.geometry, additive(lineTex, '#ffd9c8')); slashMesh2.position.z = .4; slashMesh2.visible = false; frame.add(slashMesh2);
  const splats = style.cross ? [0, 1].map((word) => {
    const mat = new T.SpriteMaterial({ map: splatTexture(word + 3), transparent: true, depthWrite: false, opacity: 0 }), sp = new T.Sprite(mat);
    const ys = letters.filter((l) => l.word === word).map((l) => l.home.y), y = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0;
    sp.position.set(word ? .35 : -.2, y, -.55); sp.scale.setScalar(Math.max(size.x, size.y) * (word ? 1.15 : .95)); sp.material.rotation = word ? .6 : -.4; frame.add(sp); return sp;
  }) : [];
  const sliceMesh = new T.Mesh(new T.PlaneGeometry(.14, 1), additive(lineTex, '#ffffff')); sliceMesh.rotation.z = .55; sliceMesh.position.z = .5; sliceMesh.visible = false; frame.add(sliceMesh);

  // sparks thrown from every landing, plus embers that rise through the finished title
  const perLetter = 8, emberCount = 36, total = letters.length * perLetter + emberCount;
  const positions = new Float32Array(total * 3), colours = new Float32Array(total * 3);
  const sparkGeo = new T.BufferGeometry(); sparkGeo.setAttribute('position', new T.BufferAttribute(positions, 3)); sparkGeo.setAttribute('color', new T.BufferAttribute(colours, 3));
  const sparkMat = new T.PointsMaterial({ size: .055, vertexColors: true, transparent: true, depthWrite: false, ...ADD, sizeAttenuation: true });
  const sparks = new T.Points(sparkGeo, sparkMat); sparks.frustumCulled = false; frame.add(sparks);
  const sparkColour = new T.Color(style.spark);

  let env: T.WebGLRenderTarget | undefined, distance = 10, tanHalf = .23;
  function resize(w: number, h: number) {
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const tan = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    // the canvas covers the whole card (so nothing in flight is ever clipped); the posed title is fitted by projection to about half the
    // width and half the height of the frame, and sits high so the player's plate has room under it
    group.rotation.set(PITCH, TURN, 0); frame.updateMatrixWorld(true);
    flashQuad.scale.set(2 * tan * camera.aspect, 2 * tan, 1);
    const corners = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => new T.Vector3(x * size.x / 2, y * size.y / 2, z * size.z / 2).applyMatrix4(group.matrixWorld))));
    let d = Math.max(size.x / (2 * tan * camera.aspect), size.y / (2 * tan)) * 1.3;
    for (let i = 0; i < 6; i++) {
      camera.position.set(0, 0, d); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
      const m = Math.max(...corners.map((c) => { const q = c.clone().project(camera); return Math.max(Math.abs(q.x) / ((counts[1] ? .74 : .66) * (style.fit ?? 1)), Math.abs(q.y) / ((counts[1] ? .64 : .36) * (style.fit ?? 1))); }));
      d *= m;
    }
    distance = d; tanHalf = tan; camera.position.set(0, 0, d);
  }
  const settled = settledAt(counts), minX = Math.min(...letters.map((l) => l.home.x)), spanX = Math.max(1e-3, Math.max(...letters.map((l) => l.home.x)) - minX);
  const white = new T.Color('#ffffff'), tmp = new T.Color();
  const hide = (o: number) => { positions[o] = positions[o + 1] = positions[o + 2] = 9999; };

  /** Poses everything for `age` seconds. Returns how much the title is glowing and flashing, for the canvas glow and brightness. */
  function update(age: number) {
    const sl = slice(age, settled), op = slash(age);
    let flash = 0;
    group.rotation.set(PITCH + Math.sin(age * .7) * .02, TURN + Math.sin(age * .6) * .1, 0);
    for (const l of letters) {
      const w = wave(age, settled, (l.home.x - minX) / spanX), bob = age > settled ? Math.sin(age * 1.6 + l.index * .7 + l.word) * .014 : 0;
      const jolt = sl.jolt * (l.index % 2 ? 1 : -1) * .07;
      let p;
      if (l.half) {
        // a letter cut in two on the slash: the halves slide in along the cut and meet
        const q = slicePose(age, l.word, l.index, l.half); p = { ...q, burn: q.burn };
        l.obj.visible = q.visible;
        l.obj.position.set(l.home.x + Math.cos(CUT) * q.d + jolt, l.home.y + Math.sin(CUT) * q.d + bob, l.home.z + q.z);
        l.obj.scale.setScalar(1 + w * .035); l.obj.rotation.set(0, 0, 0);
      } else {
        p = letterPose(age, l.word, l.index);
        l.obj.visible = p.visible;
        l.obj.position.set(l.home.x + p.x + jolt, l.home.y + p.y + bob, l.home.z + p.z);
        l.obj.scale.setScalar(p.scale * (1 + w * .035)); l.obj.rotation.set(p.rotX, p.rotY, p.rotZ);
      }
      l.mat.userData.dissolve.value = p.burn; l.mat.userData.heat.value = Math.min(1.5, w * .9 + p.flash + sl.power * .4);
      flash = Math.max(flash, p.flash);
    }
    // camera: starts a little far and dollies in as the title builds, shakes on every landing
    const k = shake(age, counts), dolly = 1 + .1 * (1 - smooth(0, settled, age));
    const camY = -(counts[1] ? .34 : .22) * tanHalf * distance * dolly;                 // a two-word title sits about a third of the way down the frame, a single word (the ace) near the middle
    camera.position.set(Math.sin(age * 71) * k * 6, camY + Math.cos(age * 83) * k * 5, distance * dolly);
    camera.lookAt(0, camY, 0); camera.rotateZ(Math.sin(age * 57) * k * .6);
    const g = glint(age, settled); sweep.position.x = g.x; sweep.intensity = g.power * 38 + sl.power * 30;
    rim.intensity = 16 + Math.sin(age * 2.2) * 3 + flash * 20;
    // the slash and the slice
    if (style.cross) {
      const o2 = slash(age - .1);
      slashMesh.rotation.z = CUT; slashMesh2.rotation.z = -CUT;
      for (const [m, q] of [[slashMesh, op], [slashMesh2, o2]] as const) { m.visible = q.opacity > .01; m.scale.x = size.x * 2.6 * Math.max(.01, q.length); m.scale.y = 1.6 + (1 - q.length) * 2; (m.material as T.MeshBasicMaterial).opacity = q.opacity; }
      splats.forEach((sp, word) => { const t = age - landingTime(word, 0) + .3; sp.visible = t > 0; const burst = Math.min(1, t / .14); (sp.material as T.SpriteMaterial).opacity = t > 0 ? (.95 - .35 * smooth(.3, 1.4, t)) : 0; sp.scale.setScalar(Math.max(size.x, size.y) * (word ? 1.15 : .95) * (.55 + .45 * (1 - Math.pow(1 - burst, 3)))); });
    } else {
    slashMesh.visible = op.opacity > .01; slashMesh.scale.x = size.x * 1.6 * Math.max(.01, op.length); slashMesh.scale.y = 1 + (1 - op.length) * 2;
    (slashMesh.material as T.MeshBasicMaterial).opacity = op.opacity;
    }
    sliceMesh.visible = sl.power > .01; sliceMesh.position.x = sl.x * size.x * .62; sliceMesh.scale.y = size.y * 1.5; (sliceMesh.material as T.MeshBasicMaterial).opacity = sl.power;
    // sparks from every landing, then embers
    let o = 0;
    for (const l of letters) {
      const born = l.half ? landingTime(l.word, l.index) - .12 : landingTime(l.word, l.index);
      for (let i = 0; i < perLetter; i++, o += 3) {
        const s = spark(age, born - .02, i + l.index * 37 + l.word * 211);
        if (!s) { hide(o); continue; }
        positions[o] = l.home.x + (i % 5 - 2) * .12 + s.x; positions[o + 1] = l.home.y - .25 + s.y; positions[o + 2] = s.z + .35;
        colours[o] = sparkColour.r * s.alpha; colours[o + 1] = sparkColour.g * s.alpha; colours[o + 2] = sparkColour.b * s.alpha;
      }
    }
    for (let i = 0; i < emberCount; i++, o += 3) {
      const e = ember(age, settled, i);
      if (!e) { hide(o); continue; }
      positions[o] = (e.x - .5) * size.x * 1.15; positions[o + 1] = (e.y - .5) * size.y * 1.35; positions[o + 2] = .6;
      tmp.copy(sparkColour).multiplyScalar(e.alpha * .8); colours[o] = tmp.r; colours[o + 1] = tmp.g; colours[o + 2] = tmp.b;
    }
    sparkGeo.attributes.position.needsUpdate = true; sparkGeo.attributes.color.needsUpdate = true;
    const glow = Math.min(1, flash + sl.power * .6 + op.opacity * .4);
    glowMat.opacity = .2 + glow * .5; flashMat.opacity = Math.min(1, op.opacity * .25 + sl.power * .22 + flash * .08);
    return { glow, flash: flashMat.opacity };
  }
  function attach(renderer: T.WebGLRenderer) {
    env = highlightReflections(renderer); scene.environment = env.texture; scene.environmentIntensity = 1.4;
  }
  function dispose() {
    glowTex.dispose(); glowMat.dispose(); flashQuad.geometry.dispose(); flashMat.dispose(); env?.dispose(); sparkGeo.dispose(); sparkMat.dispose(); tint.dispose(); cream.dispose(); lineTex.dispose();
    slashMesh.geometry.dispose(); (slashMesh.material as T.Material).dispose(); (slashMesh2.material as T.Material).dispose(); splats.forEach((sp) => { sp.material.map?.dispose(); sp.material.dispose(); }); sliceMesh.geometry.dispose(); (sliceMesh.material as T.Material).dispose();
   
    root.traverse((o) => { const m = o as T.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as T.Material).dispose(); } });
  }
  return { scene, camera, update, resize, attach, dispose };
}
