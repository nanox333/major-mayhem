import * as T from 'three';
import { SceneMaker, badge, box, clamp, flat, lerp, makeRenderer, part, rnd, skyDome, smooth, starShape, toon, tube } from './kit';

/**
 * The no-scope, in three cuts. One: an AWP at the hip, both scope caps still on, and it fires. Two: the camera rides the bullet down a long
 * alley, wind lines streaking past. Three: it reaches one head far away, the world holds for a beat, the helmet pops. One shot, one kill, and
 * the scope never came into it. Cel-shaded and inked so it reads as drawn, not rendered. Time is the only input.
 */
export const DURATION = 3.7;
const FIRE = .45, CUT_B = 1.0, HIT = 2.42, STOP = .16;
const FOE_Z = -46, GUN_Y = 1.5, HEAD_Y = 1.62;
const CAP = 0xd8322b, SAND = 0xe6b673, SAND_D = 0xc98e52, SAND_L = 0xf2d29c, BLUE = 0x2e6fb7, INK = 0x14110f;

const bulletZ = (t: number) => { const u = clamp((t - CUT_B) / (HIT - CUT_B)); return lerp(-1.1, FOE_Z + .2, 1 - (1 - u) ** 2.2); };
/** The world's own clock: it freezes for STOP seconds at the hit, then carries on. */
const world = (t: number) => (t < HIT ? t : t < HIT + STOP ? HIT : t - STOP);

export const noscope: SceneMaker = (canvas) => {
  const r = makeRenderer(canvas);
  const scene = new T.Scene();
  scene.fog = new T.Fog(0xf3d4a0, 18, 120);
  const cam = new T.PerspectiveCamera(40, 1, .05, 400);
  const sky = skyDome(0x1f66d8, 0xffd9a0, 6); scene.add(sky);
  const sun = new T.DirectionalLight(0xfff0cf, 2.1); sun.position.set(-6, 10, 5); scene.add(sun);
  scene.add(new T.HemisphereLight(0xcfe0ff, 0xc89a5e, 1.15));
  const rim = new T.DirectionalLight(0x9ec5ff, .9); rim.position.set(8, 3, -10); scene.add(rim);

  // sun disc with flat rings, fixed in the sky
  const sunD = new T.Group();
  for (const [rad, c, o] of [[16, 0xfff6dc, .22], [10, 0xfff0c4, .35], [5.5, 0xffffff, 1]] as const) { const m = new T.Mesh(new T.CircleGeometry(rad, 40), flat(c, o)); m.position.z = -rad * .01; sunD.add(m); }
  scene.add(sunD);

  // ---- the alley ----
  const world3 = new T.Group(); scene.add(world3);
  part(new T.PlaneGeometry(40, 260).rotateX(-Math.PI / 2), SAND, world3, 0, 0, -100, 0);
  for (const [x, w, c] of [[-1.6, 1.1, SAND_D], [1.9, .8, SAND_D], [0, .5, SAND_L]] as const) { const s = new T.Mesh(new T.PlaneGeometry(w, 220).rotateX(-Math.PI / 2), toon(c)); s.position.set(x, .01, -100); world3.add(s); }
  const wall = (x: number, z0: number, z1: number, h: number, c: number) => { const w = Math.abs(z1 - z0); part(box(1.2, h, w), c, world3, x, h / 2, (z0 + z1) / 2, .06); };
  wall(-5.2, -16, -40, 7.5, SAND_D); wall(-5.2, -40, -120, 11, SAND_D); wall(5.4, 6, -22, 6.5, SAND_D); wall(5.4, -28, -60, 8.5, SAND_D); wall(5.4, -60, -120, 6, SAND_D);
  for (let i = 0; i < 5; i++) { const z = -18 - i * 4.6; part(box(.2, 1.6, 1.2), 0x2b3f63, world3, -4.52, 4.4, z, .05); part(box(.9, .22, 1.4), SAND_L, world3, -4.5, 3.5, z, .04); }
  for (let i = 0; i < 6; i++) { const z = -33 - i * 4.4; part(box(.2, 1.4, 1), 0x2b3f63, world3, 4.7, 4.8, z, .05); }
  for (const [x, z, s, c] of [[-3.1, -9, 1.2, 0xa4743c], [-3.0, -10.3, .8, 0xa4743c], [3.4, -15, 1.4, 0xb8824a], [-3.2, -24, 1.5, 0xa4743c], [3.0, -34, 1.1, 0xb8824a], [-2.8, -37, 1, 0xa4743c], [2.2, -41, .9, 0xa4743c]] as const) { const m = part(box(s, s, s), c, world3, x, s / 2, z, .045); m.rotation.y = x * z * .07; }
  part(box(7, 8, 3), SAND_L, world3, 0, 4, -53, .08);
  part(box(3.3, 4.1, .5), BLUE, world3, 0, 2.05, -51.4, .06);
  part(box(4.2, .5, .7), SAND_D, world3, 0, 4.3, -51.2, .05);

  // ---- the AWP, with both lens caps on ----
  const gun = new T.Group(); gun.position.set(0, GUN_Y, 0); scene.add(gun);
  const OD = 0x6f7f4c, BK = 0x20232a, ST = 0x929aa6;
  part(box(.1, .13, .5), OD, gun, 0, 0, 0, .012); part(box(.085, .17, .55), OD, gun, 0, -.03, .5, .012).rotation.x = .1;
  part(box(.06, .2, .09), BK, gun, 0, -.15, .24, .01).rotation.x = -.28; part(box(.06, .12, .12), BK, gun, 0, -.11, -.02, .01);
  part(tube(.024, .02, .9), BK, gun, 0, .01, -.7, .01); part(tube(.04, .04, .15), ST, gun, 0, .01, -1.2, .01);
  for (const dz of [-1.16, -1.22]) part(box(.1, .018, .03), BK, gun, 0, .01, dz, 0);
  const scope = new T.Group(); scope.position.set(0, .15, -.02); gun.add(scope);
  part(tube(.038, .038, .42, 16), BK, scope, 0, 0, 0, .01);
  part(tube(.055, .04, .12, 16), BK, scope, 0, 0, -.27, .01); part(tube(.04, .05, .1, 16), BK, scope, 0, 0, .26, .01);
  part(tube(.058, .058, .03, 16), CAP, scope, 0, 0, -.35, .01); part(tube(.05, .05, .03, 16), CAP, scope, 0, 0, .33, .01);
  part(box(.04, .05, .06), ST, gun, 0, .09, -.14, .008); part(box(.04, .05, .06), ST, gun, 0, .09, .1, .008);
  const bolt = part(tube(.01, .01, .13, 8), ST, gun, .07, .02, .12, .008); bolt.rotation.y = Math.PI / 2; part(new T.SphereGeometry(.024, 8, 8), BK, gun, .14, .02, .12, .008);
  part(tube(.008, .008, .5, 6), BK, gun, -.03, -.05, -.62, 0).rotation.x = .12;

  // muzzle flash, smoke, and a casing
  const burst = badge(starShape(9, 1, .42), 0xffd24a); burst.position.set(0, GUN_Y + .01, -1.42); scene.add(burst);
  const burst2 = badge(starShape(7, .62, .3), 0xffffff, .0); burst2.position.copy(burst.position); burst2.position.z += .02; scene.add(burst2);
  const puffs = Array.from({ length: 5 }, (_, i) => { const m = part(new T.CircleGeometry(.2, 20), flat(0xf6ead4), scene, 0, 0, 0, 0); return { m, a: rnd(i + 3) * 6, d: .3 + rnd(i + 11) * .5 }; });
  const casing = part(tube(.012, .012, .09, 8), 0xe0b24a, scene, 0, 0, 0, .006);

  // ---- the target, far down the alley ----
  const foe = new T.Group(); foe.position.set(0, 0, FOE_Z); scene.add(foe);
  const SK = 0xe0a878, CL = 0x9b7f4e, DK = 0x3a2e22, RED = 0xb3322b;
  part(box(.22, .8, .26), CL, foe, -.14, .4, 0, .02); part(box(.22, .8, .26), CL, foe, .14, .4, 0, .02);
  part(box(.2, .1, .34), DK, foe, -.14, .05, .05, .02); part(box(.2, .1, .34), DK, foe, .14, .05, .05, .02);
  part(box(.66, .74, .36), CL, foe, 0, 1.17, 0, .025); part(box(.58, .56, .4), DK, foe, 0, 1.2, 0, .02);
  part(box(.18, .6, .2), CL, foe, -.42, 1.1, .12, .02).rotation.x = -.9; part(box(.18, .55, .2), CL, foe, .4, 1.1, .24, .02).rotation.x = -1.25;
  part(box(.11, .14, 1.0), DK, foe, .1, 1.2, .5, .015);
  part(box(.2, .18, .2), RED, foe, 0, 1.55, 0, .02);
  const head = part(new T.SphereGeometry(.22, 14, 12), SK, foe, 0, HEAD_Y + .03, 0, .02);
  part(box(.3, .1, .06), DK, head, 0, .02, .19, .01);
  const helmet = new T.Group(); scene.add(helmet);
  part(new T.SphereGeometry(.27, 14, 8, 0, Math.PI * 2, 0, Math.PI * .56), RED, helmet, 0, 0, 0, .02); part(box(.5, .05, .5), DK, helmet, 0, -.01, 0, 0);
  const shadow = new T.Mesh(new T.CircleGeometry(.8, 24), flat(0x6e4a22, .35)); shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, .02, FOE_Z); scene.add(shadow);

  // ---- the bullet and its wind ----
  const bullet = new T.Group(); scene.add(bullet);
  part(new T.LatheGeometry([[0, 0], [.062, 0], [.06, .22], [.035, .4], [0, .5]].map(([x, y]) => new T.Vector2(x, y)), 16).rotateX(-Math.PI / 2).translate(0, 0, -.25), 0xf3b44d, bullet, 0, 0, 0, .014);
  const lines = Array.from({ length: 46 }, (_, i) => { const a = rnd(i) * 6.283, d = 1.2 + rnd(i + 40) * 3.6, len = 3 + rnd(i + 80) * 8; const m = new T.Mesh(new T.PlaneGeometry(.02 + rnd(i + 5) * .02, len), flat(0xffffff, .8)); m.rotation.x = Math.PI / 2; m.position.set(Math.cos(a) * d, HEAD_Y + Math.sin(a) * d * .6, -rnd(i + 120) * 48 - 2); scene.add(m); m.rotation.set(Math.PI / 2, 0, 0); return m; });

  // ---- the hit ----
  const hitBurst = badge(starShape(12, 1, .5), 0xffffff, .07); scene.add(hitBurst);
  const hitBurst2 = badge(starShape(8, .65, .32), 0xffd24a, .0); scene.add(hitBurst2);
  const shards = Array.from({ length: 12 }, (_, i) => ({ m: part(box(.09, .09, .09), i % 3 ? 0xf3b44d : 0x2e2418, scene, 0, 0, 0, .008), v: new T.Vector3((rnd(i) - .5) * 5, 1 + rnd(i + 20) * 3.5, (rnd(i + 40) - .3) * 4), s: rnd(i + 60) * 9 }));

  const aim = new T.Vector3();
  const render = (t: number) => {
    t = clamp(t, 0, DURATION);
    const w = world(t);
    const inA = t < CUT_B, inB = t >= CUT_B && t < HIT, inC = t >= HIT;
    const fd = Math.max(0, t - FIRE);          // time since the shot, for the gun and the things it throws
    const sl = fd * .55;                       // slow-mo
    // gun: a sway before the shot, then the kick
    const kick = fd > 0 ? Math.exp(-sl * 7) * Math.sin(Math.min(1, sl * 9) * 1.57) : 0;
    gun.position.set(0, GUN_Y + Math.sin(t * 3.2) * .008 * (fd > 0 ? 0 : 1), kick * .22); gun.rotation.set(kick * .2 + (fd > 0 ? 0 : Math.sin(t * 2.4) * .01), 0, 0);
    burst.visible = burst2.visible = fd > 0 && fd < .16; const bk = clamp(fd / .16);
    for (const b of [burst, burst2]) { b.scale.setScalar(.3 + Math.sin(bk * 1.6) * .45); b.rotation.z = bk * .5; }
    for (const p of puffs) { const k = clamp(sl * .8 - .02); p.m.visible = fd > 0 && k < 1; p.m.position.set(Math.cos(p.a) * k * .5 * p.d, GUN_Y + Math.sin(p.a) * k * .4 * p.d + k * .15, -1.5 - k * .5 * p.d); p.m.scale.setScalar(.4 + k * 1.8); (p.m.material as T.MeshBasicMaterial).opacity = 1 - k; (p.m.material as T.MeshBasicMaterial).transparent = true; p.m.lookAt(cam.position); }
    casing.visible = fd > 0; casing.position.set(.14 + sl * .9, GUN_Y + .12 + sl * 1.1 - sl * sl * 2.6, .1 + sl * .3); casing.rotation.set(sl * 11, sl * 7, sl * 5);
    // bullet and wind
    const bz = inA ? -1.1 : bulletZ(t);
    bullet.position.set(0, lerp(GUN_Y, HEAD_Y, smooth(t, CUT_B, HIT)), bz); bullet.visible = t >= FIRE + .05 && t < HIT + .05;
    for (const l of lines) { l.visible = inB; if (inB) { const u = clamp((t - CUT_B) / (HIT - CUT_B)); (l.material as T.MeshBasicMaterial).opacity = .8 * (1 - smooth(u, .7, 1)); } }

    // the target
    const dt = Math.max(0, w - HIT);
    const fall = smooth(dt, 0, 1.1) * 1.45;
    foe.rotation.x = -fall; foe.position.z = FOE_Z - fall * .5; foe.position.y = Math.sin(clamp(dt * 3.5, 0, Math.PI)) * .1;
    head.visible = dt < .001 || true;
    const hp = dt > 0 ? new T.Vector3(.9 * dt, 3.6 * dt - 4.9 * dt * dt, -.4 * dt) : new T.Vector3();
    helmet.position.set(hp.x, Math.max(.15, HEAD_Y + .17 + hp.y), FOE_Z + hp.z); helmet.rotation.set(dt * 7, dt * 4, dt * 6);
    // hit star: pops, holds through the freeze, then fades
    const hb = t >= HIT && w < HIT + .5;
    hitBurst.visible = hitBurst2.visible = hb; const hk = clamp((t - HIT) / .5);
    for (const b of [hitBurst, hitBurst2]) { b.position.set(.05, HEAD_Y + .05, FOE_Z - .5); b.scale.setScalar(.2 + smooth(hk, 0, .3) * 1.3 * (1 - hk * .2)); b.lookAt(cam.position); }
    hitBurst2.position.z += .01;
    for (const s of shards) { s.m.visible = dt > 0 && dt < 1.4; s.m.position.set(s.v.x * dt * .6, HEAD_Y + s.v.y * dt - 4.9 * dt * dt, FOE_Z + s.v.z * dt * .5); s.m.position.y = Math.max(.08, s.m.position.y); s.m.rotation.set(dt * s.s, dt * s.s * .7, 0); s.m.scale.setScalar(1 - smooth(dt, .9, 1.4)); }

    // cameras
    if (inA) {
      const push = smooth(t, 0, CUT_B) * .5;
      cam.position.set(3.9 - push, GUN_Y - .55, -1.2 + push * .4); aim.set(0, GUN_Y + .08, -.3 + kick * .1);
      cam.position.x += Math.sin(t * 90) * kick * .012; cam.position.y += Math.cos(t * 70) * kick * .012;
      cam.fov = 34; cam.up.set(0, 1, 0); cam.lookAt(aim); cam.rotateZ(-.05);
    } else if (inB) {
      const u = clamp((t - CUT_B) / (HIT - CUT_B));
      const near = smooth(u, .55, 1);
      cam.position.set(lerp(.7, .5, near), lerp(GUN_Y + .5, HEAD_Y + .22, near), bz + lerp(2.6, 2.3, near));
      aim.set(0, lerp(GUN_Y, HEAD_Y, near), bz - lerp(8, 1.2, near));
      cam.fov = lerp(lerp(78, 46, smooth(u, 0, .25)), 30, near); cam.up.set(0, 1, 0); cam.lookAt(aim); cam.rotateZ(Math.sin(u * 9) * .02 + lerp(.0, .05, near));
    } else {
      const k = smooth(t, HIT, DURATION);
      cam.position.set(lerp(3.2, 3.9, k), lerp(HEAD_Y + .05, 1.1, k), FOE_Z + lerp(.6, 3.4, k)); aim.set(0, lerp(HEAD_Y, .8, k), FOE_Z - lerp(0, .5, k));
      cam.position.x += Math.sin(t * 80) * .03 * (1 - smooth(t, HIT, HIT + .35)); cam.fov = lerp(26, 32, k); cam.up.set(0, 1, 0); cam.lookAt(aim); cam.rotateZ(-.06);
    }
    if (cam.aspect < 1.25) cam.fov = 2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * (1.25 / cam.aspect)) * (180 / Math.PI); // a tall screen widens the view so the rifle still fits
    cam.updateProjectionMatrix();
    sky.position.copy(cam.position);
    sunD.position.set(cam.position.x - 55, 60, cam.position.z - 150); sunD.lookAt(cam.position);
    r.render(scene, cam);
  };
  const resize = (w: number, h: number) => { r.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); };
  const dispose = () => { scene.traverse((o) => { const m = o as T.Mesh; m.geometry?.dispose?.(); const mt = m.material as T.Material | T.Material[] | undefined; (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => x.dispose()); }); r.dispose(); };
  return { duration: DURATION, render, resize, dispose };
};
