import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { instantiateOperator, preloadNoscope } from '../legend3d/assets';
import { createRagdoll } from '../legend3d/ragdoll';
import { addGrit } from '../legend3d/grit';
import { FALL_SLOW, KILLS, clamp, clutchTime, smooth } from './timeline';

/** The 1v5 CLUTCH world: an abstract arena (a floor, a wall with an opening, two side structures) lit from behind the far wall, the survivor and five
 *  enemies (the operator from the no-scope kit, posed on its bones and dropped with its ragdoll), a few flashes and dust. Everything is a pure function
 *  of `update(t)`. About 25k triangles, one directional light, one short-lived point light, no shadows. */

let arena: Promise<T.Group> | undefined;
/** The arena (scripts/legend-3d/clutch_assets.py) and the no-scope kit are fetched once and kept as CPU copies. */
export function preloadClutch() {
  void preloadNoscope().catch(() => {});
  return arena ??= (async () => {
    const url = `${import.meta.env.BASE_URL}assets/highlights/clutch/arena.glb`;
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error('Clutch arena unavailable');
    return (await new GLTFLoader().parseAsync(await response.arrayBuffer(), url)).scene;
  })().catch((e) => { arena = undefined; throw e; });
}

/** Where everyone stands (x, z): the survivor near the camera, the five enemies fanned out in the distance, then the hero shot's final places. */
const SURVIVOR = new T.Vector3(-1.2, 0, 1.6);
const ENEMY: readonly (readonly [number, number])[] = [[-3.2, -6.8], [-1.4, -9.2], [.9, -6.4], [3, -9], [5, -6.8]];
const HERO_SURVIVOR = new T.Vector3(0, 0, -3.3);
const HERO_ENEMY: readonly (readonly [number, number])[] = [[-2.7, -3.2], [2.1, -3.6], [-1.3, -5.7], [3.4, -5.4], [.6, -7.3]];
const CHEST = 1.3;

function starTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,248,225,1)'); r.addColorStop(.18, 'rgba(255,170,80,.85)'); r.addColorStop(.5, 'rgba(243,122,48,.22)'); r.addColorStop(1, 'rgba(243,122,48,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,200,130,.9)';
  for (let i = 0; i < 6; i++) { g.save(); g.translate(64, 64); g.rotate(i * Math.PI / 3 + .3); g.beginPath(); g.moveTo(0, -3); g.lineTo(62 - (i % 2) * 18, 0); g.lineTo(0, 3); g.fill(); g.restore(); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d')!;
  const r = g.createRadialGradient(128, 70, 0, 128, 70, 120); r.addColorStop(0, 'rgba(255,190,110,1)'); r.addColorStop(.25, 'rgba(243,122,48,.65)'); r.addColorStop(.6, 'rgba(180,70,20,.22)'); r.addColorStop(1, 'rgba(120,40,10,0)');
  g.save(); g.scale(1, .55); g.translate(0, 56); g.fillStyle = r; g.fillRect(0, -60, 256, 260); g.restore();
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
const ADD = { blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.SrcAlphaFactor, blendDst: T.OneFactor } as const;
const seeded = (i: number, k: number) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };

export async function createClutchScene(dust: number) {
  const [arenaSource, ...operators] = await Promise.all([preloadClutch(), ...Array.from({ length: 6 }, () => instantiateOperator())]);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(36, 16 / 9, .1, 90);
  scene.background = new T.Color('#0b0706'); scene.fog = new T.Fog('#1a0f09', 10, 44);
  const owned = new Set<T.BufferGeometry | T.Material | T.Texture>();
  const own = <A extends T.BufferGeometry | T.Material | T.Texture>(r: A) => { owned.add(r); return r; };

  // ---- the arena: three meshes, re-coloured to the palette and given the stone grit
  const arenaRoot = arenaSource.clone(true);
  const colours: Record<string, string> = { ground: '#1a1918', wall: '#1d1918', trim: '#2c241f' };
  arenaRoot.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const m = new T.MeshStandardMaterial({ color: colours[o.name] ?? '#222', roughness: o.name === 'ground' ? .62 : .9, metalness: 0 });
    addGrit(m, o.name === 'ground' ? .6 : .3); own(m); o.material = m; o.geometry = own(o.geometry.clone());
  });
  scene.add(arenaRoot);

  // ---- six operators sharing one geometry; the survivor is darker, the enemies a warmer brown-black
  const [survivorSrc, ...enemySrc] = operators;
  const mesh = (o: T.Object3D) => { let m: T.SkinnedMesh | undefined; o.traverse((c) => { if (c instanceof T.SkinnedMesh) m = c; }); return m!; };
  const sharedGeometry = mesh(survivorSrc).geometry;
  for (const o of operators.slice(1)) { const m = mesh(o); m.geometry.dispose(); m.geometry = sharedGeometry; }
  own(sharedGeometry);
  const skin = (colour: string, rough: number) => {
    const base = mesh(survivorSrc).material as T.MeshStandardMaterial, m = base.clone();
    for (const [key, value] of Object.entries(m)) if (value instanceof T.Texture) { const t = value.clone(); own(t); (m as unknown as Record<string, unknown>)[key] = t; }
    m.color.set(colour); m.roughness = rough; m.metalness = 0; m.envMapIntensity = .2; return own(m);
  };
  const survivorMat = skin('#6a706f', .85), enemyMat = skin('#9a7a64', .85);
  mesh(survivorSrc).material = survivorMat;
  for (const o of enemySrc) mesh(o).material = enemyMat;
  for (const o of operators) { const m = mesh(o); m.frustumCulled = false; own(m.material as T.Material); }
  operators.forEach((o) => o.traverse((c) => { if (c instanceof T.SkinnedMesh) { c.castShadow = false; c.receiveShadow = false; } }));

  const joint = (target: T.Object3D, n: string) => target.getObjectByName(n);
  const jointNames = ['TargetBody', 'TargetHead', 'LeftArm', 'RightArm', 'LeftLeg', 'RightLeg', 'LeftKnee', 'RightKnee'];
  /** A bone pose: the bind rotation, then an Euler on top. */
  function rig(target: T.Object3D) {
    const joints = jointNames.map((n) => joint(target, n)).filter((o): o is T.Object3D => !!o), bind = new Map(joints.map((o) => [o, o.quaternion.clone()]));
    const delta = new T.Quaternion(), e = new T.Euler();
    return {
      reset() { for (const j of joints) j.quaternion.copy(bind.get(j)!); },
      pose(name: string, x: number, y = 0, z = 0) { const o = joint(target, name); if (o) o.quaternion.copy(bind.get(o)!).multiply(delta.setFromEuler(e.set(x, y, z))); },
    };
  }

  // survivor
  const survivorSlot = new T.Group(); survivorSlot.add(survivorSrc); scene.add(survivorSlot);
  const survivor = rig(survivorSrc);
  // enemies: slot (place) > inner (+24 in z, because the ragdoll samples a fall that happens at z = -24) > the operator
  const enemies = enemySrc.map((target, i) => {
    const slot = new T.Group(), inner = new T.Group(); inner.position.set(0, 0, 24); target.position.set(0, 0, -24); inner.add(target); slot.add(inner); scene.add(slot);
    slot.position.set(ENEMY[i][0], 0, ENEMY[i][1]); slot.updateMatrixWorld(true);
    const bones = rig(target), ragdoll = createRagdoll(target);
    return { slot, inner, target, bones, ragdoll };
  });
  // the physics boxes are thinner than the model: how far the body sinks below the floor at each point of the fall, to lift it by exactly that
  const lift: number[] = (() => {
    const e = enemies[0], box = new T.Box3(), out: number[] = [];
    for (let k = 0; k <= 28; k++) { e.bones.reset(); e.ragdoll.update(k / 40); e.target.updateMatrixWorld(true); box.makeEmpty(); box.expandByObject(e.target, true); out.push(box.isEmpty() ? 0 : Math.max(0, -box.min.y + .012)); }
    return out;
  })();
  const liftAt = (s: number) => { const u = clamp(s / .7) * (lift.length - 1), i = Math.floor(u); return lift[i] + (lift[Math.min(i + 1, lift.length - 1)] - lift[i]) * (u - i); };

  // ---- light: a faint warm sky, an orange backlight from behind the far wall, and a short orange flash light for the shots
  scene.add(new T.HemisphereLight('#e39a58', '#14100d', .95));
  const back = new T.DirectionalLight('#f37a30', 2.4); back.position.set(0, 6, -16); back.target.position.set(0, 1, 0); scene.add(back, back.target);
  const fill = new T.DirectionalLight('#ffd0a0', 1.1); fill.position.set(2, 3, 9); scene.add(fill);
  const flashLight = new T.PointLight('#ff9a4a', 0, 14, 1.6); scene.add(flashLight);
  const star = own(starTexture()), glowTex = own(glowTexture());

  const backdrop = new T.Sprite(own(new T.SpriteMaterial({ map: glowTex, color: '#ff8a3a', transparent: true, depthWrite: false, fog: false, ...ADD, opacity: .6 })));
  backdrop.position.set(0, 3.2, -26); backdrop.scale.set(34, 14, 1); scene.add(backdrop);
  const spriteOf = (scale: number) => { const s = new T.Sprite(own(new T.SpriteMaterial({ map: star, transparent: true, depthWrite: false, fog: false, ...ADD, opacity: 0 }))); s.scale.setScalar(scale); s.visible = false; scene.add(s); return s; };
  const muzzle = spriteOf(1.3), impact = spriteOf(1.0);

  // ---- the sparks of each hit (6 per kill, a pool) and the dust in the light
  const SPARKS = 6, sparkGeo = own(new T.BufferGeometry()), sparkPos = new Float32Array(SPARKS * 3);
  sparkGeo.setAttribute('position', new T.BufferAttribute(sparkPos, 3));
  const sparkMat = own(new T.PointsMaterial({ size: .09, color: '#ffb060', transparent: true, depthWrite: false, fog: false, ...ADD, sizeAttenuation: true }));
  const sparks = new T.Points(sparkGeo, sparkMat); sparks.frustumCulled = false; scene.add(sparks);
  const dustGeo = own(new T.BufferGeometry()), dustPos = new Float32Array(dust * 3); dustGeo.setAttribute('position', new T.BufferAttribute(dustPos, 3));
  const dustMat = own(new T.PointsMaterial({ size: .05, color: '#ffc88a', transparent: true, depthWrite: false, fog: false, ...ADD, sizeAttenuation: true, opacity: .6 }));
  const dustPoints = new T.Points(dustGeo, dustMat); dustPoints.frustumCulled = false; scene.add(dustPoints);

  const tmp = new T.Vector3(), lookAt = new T.Vector3(), dir = new T.Vector3(), right = new T.Vector3(), up = new T.Vector3(0, 1, 0), muzzleAt = new T.Vector3(), focus = new T.Vector3(), head = new T.Vector3();
  const enemyAt = (i: number) => new T.Vector3(ENEMY[i][0], 0, ENEMY[i][1]);
  const GROUP = new T.Vector3(0, 0, -7.4);
  /** A point that may sit between two enemies (p from -1, the middle of the group, to 4): the reticle, the camera's attention and the survivor's aim all follow it. */
  const focusAt = (p: number, out_: T.Vector3) => {
    if (p <= -1) return out_.copy(GROUP);
    const i = Math.min(4, Math.floor(p)), j = Math.min(4, i + 1), u = p - i;
    return out_.copy(enemyAt(i)).lerp(enemyAt(j), u);
  };
  // the tracer: a thin bright line from the muzzle to the enemy for a moment after each shot
  const tracer = new T.Mesh(own(new T.CylinderGeometry(.014, .014, 1, 6, 1, true)), own(new T.MeshBasicMaterial({ color: '#ffe2b0', transparent: true, depthWrite: false, fog: false, ...ADD, opacity: 0 })));
  tracer.visible = false; scene.add(tracer);

  function aimPose(rig_: ReturnType<typeof rig>, amount: number, kick: number) {
    // both arms come up to the shoulder with the rifle, the chest leans into it, the shot kicks it back
    rig_.pose('RightArm', -1.15 * amount - .12 * kick); rig_.pose('LeftArm', -1.05 * amount - .1 * kick); rig_.pose('TargetBody', .06 * amount - .07 * kick);
  }

  function update(seconds: number) {
    const s = clutchTime(seconds), t = s.t;
    const heroOn = s.swapped;
    focusAt(s.reticle.p, focus);
    // ---- survivor: stands in the foreground, turning smoothly to wherever the reticle is
    survivor.reset();
    if (heroOn) {
      survivorSlot.position.copy(HERO_SURVIVOR); survivorSlot.rotation.y = Math.PI + .06;
      survivor.pose('RightArm', -.1); survivor.pose('LeftArm', -.06); survivor.pose('TargetHead', -.03 * Math.sin(t * 1.3));
    } else {
      dir.set(focus.x - SURVIVOR.x, 0, focus.z - SURVIVOR.z).normalize();
      survivorSlot.position.copy(SURVIVOR); survivorSlot.rotation.y = Math.atan2(dir.x, dir.z);
      const last = s.kill >= 0 ? Math.exp(-Math.max(0, t - KILLS[s.kill]) * 7) : 0;
      aimPose(survivor, smooth(1.3, 2.6, t), last);
    }
    survivorSlot.updateMatrixWorld(true);

    // ---- enemies: standing, aiming at him and swaying a little, until their kill; then the ragdoll fall in slow motion; the hero shot has them in their final places
    enemies.forEach((e, i) => {
      e.bones.reset(); e.target.position.set(0, 0, -24); e.target.rotation.set(0, 0, 0);
      const fall = t - KILLS[i];
      if (heroOn) e.slot.position.set(HERO_ENEMY[i][0], 0, HERO_ENEMY[i][1]); else e.slot.position.set(ENEMY[i][0], 0, ENEMY[i][1]);
      if (fall >= 0 || heroOn) {
        const f = heroOn ? 9 : fall * FALL_SLOW;
        e.ragdoll.update(f); e.target.position.y += liftAt(f);
        const headBone = joint(e.target, 'TargetHead'); if (headBone && !heroOn) { const snap = (1 - Math.exp(-f * 45)) * Math.exp(-f * 3.4); headBone.rotateX(-.5 * snap); }
      } else {
        aimPose(e.bones, .7 + .2 * Math.sin(t * 1.7 + i * 1.3), 0);
        e.bones.pose('TargetBody', .025 * Math.sin(t * 1.1 + i));
      }
      e.slot.updateMatrixWorld(true);
    });

    // ---- the camera: one slow move from a wide view to a closer one; it never cuts. Its attention drifts toward the reticle, never all the way.
    const k = s.push;
    if (!heroOn) {
      camera.position.set(1.7 - .7 * k + Math.sin(t * .35) * .1, 1.55 - .08 * k, 6.6 - 1.6 * k);
      lookAt.set(GROUP.x, 1.3, GROUP.z).lerp(tmp.set(focus.x, 1.3, focus.z), .55 * s.reticle.on);
      camera.fov = 38 - 5 * k - 1.5 * clamp(s.impact);
    } else {
      const h = s.heroPush; camera.position.set(.9 - .5 * h, .72 + .06 * h, 3.3 - 1.0 * h); lookAt.set(0, 1.95, -4.6); camera.fov = 34 - 2 * h;
    }
    camera.updateProjectionMatrix(); camera.lookAt(lookAt);
    const f = THREE_RAD * camera.fov; camera.rotateX(s.shakeY * f * 2); camera.rotateY(s.shakeX * f * 2);
    camera.updateMatrixWorld(true);

    // ---- flashes: the muzzle of the survivor's rifle, the tracer, the hit on the enemy, and one orange light for both
    const kk = s.kill;
    if (!heroOn && kk >= 0 && (s.muzzle > 0 || s.impact > 0 || s.tracer > 0)) {
      const target = enemyAt(kk); dir.set(target.x - SURVIVOR.x, 0, target.z - SURVIVOR.z).normalize(); right.crossVectors(dir, up).normalize();
      muzzleAt.copy(SURVIVOR).addScaledVector(dir, 1.0).addScaledVector(right, .12); muzzleAt.y = 1.36;
      muzzle.position.copy(muzzleAt); muzzle.visible = s.muzzle > 0; (muzzle.material as T.SpriteMaterial).opacity = s.muzzle; muzzle.scale.setScalar(.38 + .3 * s.muzzle + (kk === 4 ? .18 : 0)); (muzzle.material as T.SpriteMaterial).rotation = kk * 1.3;
      impact.position.set(target.x, CHEST, target.z + .15); impact.visible = s.impact > 0; (impact.material as T.SpriteMaterial).opacity = clamp(s.impact); impact.scale.setScalar(.4 + .4 * clamp(s.impact) + (kk === 4 ? .3 : 0));
      // the tracer runs from the muzzle to the chest
      tmp.set(target.x, CHEST, target.z + .15).sub(muzzleAt); const len = tmp.length();
      tracer.visible = s.tracer > 0; tracer.position.copy(muzzleAt).addScaledVector(tmp, .5); tracer.scale.set(1, len, 1); tracer.quaternion.setFromUnitVectors(up, tmp.normalize()); (tracer.material as T.MeshBasicMaterial).opacity = s.tracer;
      flashLight.position.copy(s.impact > 0 ? impact.position : muzzleAt).add(tmp.set(0, .2, 1.2)); flashLight.intensity = 34 * Math.max(s.muzzle, s.impact) * (kk === 4 ? 1.4 : 1);
    } else { muzzle.visible = false; impact.visible = false; tracer.visible = false; flashLight.intensity = 0; }
    // sparks off the hit
    const sparkAge = kk >= 0 ? t - KILLS[kk] - .03 : -1;
    sparks.visible = !heroOn && sparkAge >= 0 && sparkAge < .9;
    if (sparks.visible) {
      const target = enemyAt(kk);
      for (let j = 0; j < SPARKS; j++) {
        const a = seeded(j, 1) * Math.PI * 2, sp = .5 + seeded(j, 2) * 1.6;
        sparkPos[j * 3] = target.x + Math.cos(a) * sp * sparkAge; sparkPos[j * 3 + 1] = CHEST + Math.sin(a) * sp * sparkAge * .6 - 2.2 * sparkAge * sparkAge; sparkPos[j * 3 + 2] = target.z + .2 + Math.abs(Math.sin(a * 1.7)) * sp * sparkAge * .8;
      }
      sparkGeo.attributes.position.needsUpdate = true; sparkMat.opacity = clamp(1 - sparkAge / .9);
    }
    // the light behind the far wall comes up for the hero shot
    (backdrop.material as T.SpriteMaterial).opacity = .5 * s.glow + .1; back.intensity = 2.2 + 1.6 * s.glow;
    // dust drifting slowly through the light
    for (let i = 0; i < dust; i++) {
      const x = (seeded(i, 1) - .5) * 14, z = -9 + seeded(i, 2) * 12, y = ((seeded(i, 3) * 5 + t * (.05 + seeded(i, 4) * .1)) % 5);
      dustPos[i * 3] = x + Math.sin(t * .5 + i) * .12; dustPos[i * 3 + 1] = y; dustPos[i * 3 + 2] = z;
    }
    dustGeo.attributes.position.needsUpdate = true; dustMat.opacity = .3 + .45 * s.glow;
    // where the reticle is on screen (the head of whoever it is on)
    head.copy(focus).setY(1.55).project(camera);
    return { ...s, screen: { x: (head.x + 1) / 2, y: (1 - head.y) / 2 } };
  }

  function resize(w: number, h: number) { camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); }
  function dispose() {
    owned.forEach((r) => r.dispose());
    scene.traverse((o) => { if (o instanceof T.SkinnedMesh) o.skeleton.dispose(); });
  }
  function stats(renderer: T.WebGLRenderer) { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }; }
  update(0);
  return { scene, camera, update, resize, dispose, stats };
}
const THREE_RAD = Math.PI / 180;
