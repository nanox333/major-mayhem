import * as T from 'three';
import { SceneMaker, badge, box, clamp, flat, lerp, makeRenderer, part, rnd, skyDome, smooth, starShape, toon, tube } from './kit';

/**
 * The no-scope, in four cuts. One: a player fires an AWP from the hip, both scope caps still on. Two: the camera rides the bullet down a long
 * alley, wind lines streaking past. Three: it reaches one head far away, the world nearly stops, the helmet pops. Four: from behind the rifle,
 * the target going down at the far end of that alley. One shot, one kill, and the scope never came into it. Cel-shaded and inked so it reads
 * as drawn, not rendered. Time is the only input.
 */
export const DURATION = 3.9;
/** The whole scene plays this many times slower than it is written: every time below is in scene seconds. */
export const SLOW = 1.25;
const FIRE = .4, CUT_B = 1.0, HIT = 2.3, CUT_C = HIT - .12, CUT_D = 3.1;
const FOE_Z = -46, GUN_Y = 1.14, HEAD_Y = 1.65;
const CAP = 0xd8322b, SAND = 0xe6b673, SAND_D = 0xc98e52, SAND_L = 0xf2d29c, BLUE = 0x2e6fb7;

const bulletZ = (t: number) => { const u = clamp((t - CUT_B) / (HIT - CUT_B)); return lerp(-1.1, FOE_Z + .15, 1 - (1 - u) ** 1.7); };
/** The world's own clock: it nearly stops at the hit, then eases back to normal. */
const world = (t: number) => { const s = t - HIT; return s < 0 ? t : HIT + (s < .35 ? .15 * s : .0525 + (s - .35)); };

type Look = { cloth: number; vest: number; dark: number; skin: number; helm: number; scarf: number };
/** A stylised soldier from boxes and one sphere, feet at the origin, facing +z, about 1.8 tall. */
function person(l: Look) {
  const g = new T.Group();
  part(box(.22, .8, .26), l.cloth, g, -.14, .4, 0, .02); part(box(.22, .8, .26), l.cloth, g, .14, .4, 0, .02);
  part(box(.2, .1, .34), l.dark, g, -.14, .05, .05, .02); part(box(.2, .1, .34), l.dark, g, .14, .05, .05, .02);
  const torso = new T.Group(); g.add(torso);
  part(box(.66, .74, .36), l.cloth, torso, 0, 1.17, 0, .025); part(box(.58, .56, .4), l.vest, torso, 0, 1.2, 0, .02); part(box(.68, .09, .38), l.dark, torso, 0, .84, 0, .015);
  part(box(.2, .18, .2), l.scarf, torso, 0, 1.55, 0, .02);
  for (const sx of [-1, 1]) { part(box(.2, .15, .36), l.vest, torso, sx * .36, 1.5, 0, .02); part(box(.25, .17, .3), l.vest, g, sx * .14, .5, .06, .02); }
  for (const px of [-.17, 0, .17]) part(box(.13, .15, .09), l.dark, torso, px, 1.0, .24, .012);
  const head = new T.Group(); head.position.set(0, HEAD_Y + .03, 0); torso.add(head);
  part(new T.SphereGeometry(.22, 14, 12), l.skin, head, 0, 0, 0, .02);
  part(box(.3, .1, .06), l.dark, head, 0, .02, .19, .01); part(box(.12, .02, .02), 0xffffff, head, -.06, .04, .225, 0);
  return { g, torso, head };
}
const helmetOf = (c: number) => { const h = new T.Group(); part(new T.SphereGeometry(.27, 14, 8, 0, Math.PI * 2, 0, Math.PI * .56), c, h, 0, 0, 0, .02); part(box(.5, .05, .5), 0x2a2420, h, 0, -.01, 0, 0); part(box(.07, .03, .52), 0xf1ece0, h, 0, .265, 0, 0); return h; };
/** A box limb between two points, redrawn each frame so a hand can follow the rifle. */
function limb(parent: T.Object3D, color: number, thick: number, hand: number) {
  const m = part(box(thick, 1, thick), color, parent, 0, 0, 0, .014), hd = part(box(hand, hand, hand), 0x1d1f26, parent, 0, 0, 0, .012);
  const up = new T.Vector3(0, 1, 0), d = new T.Vector3();
  return (a: T.Vector3, b: T.Vector3) => { m.position.copy(a).add(b).multiplyScalar(.5); d.copy(b).sub(a); m.scale.set(1, d.length(), 1); m.quaternion.setFromUnitVectors(up, d.normalize()); hd.position.copy(b); hd.quaternion.copy(m.quaternion); };
}

export const noscope: SceneMaker = (canvas) => {
  const r = makeRenderer(canvas);
  const scene = new T.Scene();
  scene.fog = new T.Fog(0xf3d4a0, 18, 125);
  const cam = new T.PerspectiveCamera(40, 1, .05, 500);
  const sky = skyDome(0x1f66d8, 0xffd9a0, 6); sky.renderOrder = -200; scene.add(sky);
  const sun = new T.DirectionalLight(0xfff0cf, 2.1); sun.position.set(-6, 10, 5); scene.add(sun);
  scene.add(new T.HemisphereLight(0xcfe0ff, 0xc89a5e, 1.15));
  const rim = new T.DirectionalLight(0x9ec5ff, .9); rim.position.set(8, 3, -10); scene.add(rim);

  // sun and clouds ride with the camera: far enough that they never parallax, but fixed in direction
  const heaven = new T.Group(); scene.add(heaven);
  let order = -100; // the sun and clouds draw first, in this order, with no depth test: a flat backdrop that never z-fights
  const disc = (rad: number, c: number, parent: T.Object3D, x = 0, y = 0) => { const m = new T.Mesh(new T.CircleGeometry(rad, 36), new T.MeshBasicMaterial({ color: c, fog: false, depthTest: false, depthWrite: false })); m.position.set(x, y, 0); m.renderOrder = order++; parent.add(m); return m; };
  const sunD = new T.Group(); disc(34, 0xf4dccb, sunD); disc(21, 0xfae6c8, sunD); disc(11, 0xffffff, sunD);
  sunD.position.set(-70, 62, -120).setLength(190); sunD.lookAt(0, 0, 0); heaven.add(sunD);
  const clouds: T.Group[] = [];
  for (let i = 0; i < 9; i++) {
    const c = new T.Group(), az = (i / 9) * 6.283 + rnd(i) * .5, el = .16 + rnd(i + 9) * .26, sc = 1 + rnd(i + 20) * .9;
    for (const [dx, dy, rr] of [[0, 0, 11], [-13, -2.5, 8], [13, -2, 9], [-24, -5, 5.5], [24, -4.5, 6]] as const) { disc(rr * sc, 0xd3def2, c, dx * sc, dy * sc - 2.2 * sc); disc(rr * sc, 0xffffff, c, dx * sc, dy * sc); }
    c.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).multiplyScalar(180); c.lookAt(0, 0, 0); heaven.add(c); clouds.push(c);
  }

  // ---- the alley ----
  const level = new T.Group(); scene.add(level);
  part(new T.PlaneGeometry(60, 260).rotateX(-Math.PI / 2), SAND, level, 0, 0, -100, 0);
  for (const [x, w, c] of [[-1.6, 1.1, SAND_D], [1.9, .8, SAND_D], [0, .5, SAND_L]] as const) { const s = new T.Mesh(new T.PlaneGeometry(w, 220).rotateX(-Math.PI / 2), toon(c)); s.position.set(x, .01, -100); level.add(s); }
  const wall = (x: number, z0: number, z1: number, h: number, c: number) => part(box(1.2, h, Math.abs(z1 - z0)), c, level, x, h / 2, (z0 + z1) / 2, .06);
  wall(-5.2, -16, -120, 8, SAND_D); wall(5.4, 6, -22, 6.5, SAND_D); wall(5.4, -28, -120, 7.5, SAND_D);
  for (let i = 0; i < 5; i++) { const z = -18 - i * 4.6; part(box(.2, 1.6, 1.2), 0x2b3f63, level, -4.52, 4.4, z, .05); part(box(.9, .22, 1.4), SAND_L, level, -4.5, 3.5, z, .04); }
  for (let i = 0; i < 6; i++) part(box(.2, 1.4, 1), 0x2b3f63, level, 4.7, 4.8, -33 - i * 4.4, .05);
  // beams across the alley with banners: the rhythm that makes the ride feel fast
  for (let i = 0; i < 6; i++) {
    const z = -9 - i * 7.2; part(box(10.2, .36, .6), 0x7a4f2a, level, 0, 6.3, z, .05);
    const bn = part(box(.9, 1.5, .08), [0xd8322b, BLUE, 0xe8b23a][i % 3], level, i % 2 ? 1.6 : -1.7, 5.4, z, .035); bn.rotation.z = (i % 2 ? .06 : -.05);
  }
  for (const [x, z, s, c] of [[-3.1, -9, 1.2, 0xa4743c], [-3.0, -10.3, .8, 0xa4743c], [3.4, -15, 1.4, 0xb8824a], [-3.2, -24, 1.5, 0xa4743c], [3.0, -34, 1.1, 0xb8824a], [-2.8, -37, 1, 0xa4743c], [2.2, -41, .9, 0xa4743c]] as const) { const m = part(box(s, s, s), c, level, x, s / 2, z, .045); m.rotation.y = x * z * .07; }
  part(box(9, 9, 3), SAND_L, level, 0, 4.5, -53, .08);
  part(box(3.3, 4.1, .5), BLUE, level, 0, 2.05, -51.4, .06);
  part(box(4.2, .5, .7), SAND_D, level, 0, 4.3, -51.2, .05);

  // ---- the shooter ----
  const me = person({ cloth: 0x3d5a8c, vest: 0x1f2a45, dark: 0x16181f, skin: 0xe0a878, helm: 0x232d44, scarf: 0x2b3f63 });
  me.g.rotation.y = Math.PI; me.g.position.set(-.3, 0, 1.0); scene.add(me.g);
  const myHelm = helmetOf(0x2c4a80); myHelm.position.y = .02; me.head.add(myHelm);
  const mine = new T.Group(); scene.add(mine);
  const armR = limb(mine, 0x3d5a8c, .17, .13), armL = limb(mine, 0x3d5a8c, .17, .13);

  // ---- the AWP, with both lens caps on ----
  const gun = new T.Group(); scene.add(gun);
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
  part(tube(.01, .01, .13, 8), ST, gun, .07, .02, .12, .008).rotation.y = Math.PI / 2; part(new T.SphereGeometry(.024, 8, 8), BK, gun, .14, .02, .12, .008);
  part(tube(.008, .008, .5, 6), BK, gun, -.03, -.05, -.62, 0).rotation.x = .12;
  const glint = badge(starShape(4, .09, .02), 0xffffff, .2); scope.add(glint); glint.position.set(.06, .05, -.37); glint.rotation.y = Math.PI / 2;

  // muzzle flash, smoke, casing
  const mz = new T.Group(); scene.add(mz);
  const star1 = badge(starShape(9, 1, .42), 0xffd24a); const star2 = badge(starShape(7, .62, .3), 0xffffff, 0); star2.position.z = .02; mz.add(star1, star2);
  const puffs = Array.from({ length: 6 }, (_, i) => ({ m: part(new T.CircleGeometry(.2, 20), new T.MeshBasicMaterial({ color: 0xf6ead4, transparent: true, fog: false, depthWrite: false }), scene, 0, 0, 0, 0), a: rnd(i + 3) * 6.28, d: .35 + rnd(i + 11) * .5 }));
  const casing = part(tube(.012, .012, .09, 8), 0xe0b24a, scene, 0, 0, 0, .006);

  // ---- the target ----
  const foe = person({ cloth: 0x9b7f4e, vest: 0x3a2e22, dark: 0x3a2e22, skin: 0xe0a878, helm: 0xb3322b, scarf: 0xb3322b });
  const foeG = new T.Group(); foeG.position.set(0, 0, FOE_Z); foeG.add(foe.g); scene.add(foeG);
  part(box(.18, .6, .2), 0x9b7f4e, foe.torso, -.42, 1.1, .12, .02).rotation.x = -.9; part(box(.18, .55, .2), 0x9b7f4e, foe.torso, .4, 1.1, .24, .02).rotation.x = -1.25;
  const rifle = new T.Group(); part(box(.11, .14, 1.0), 0x3a2e22, rifle, 0, 0, 0, .015); part(box(.08, .2, .3), 0x3a2e22, rifle, 0, -.06, .35, .012); foe.torso.add(rifle); rifle.position.set(.1, 1.2, .5);
  const helmet = helmetOf(0xb3322b); scene.add(helmet);
  const thrown = new T.Group(); part(box(.11, .14, 1.0), 0x3a2e22, thrown, 0, 0, 0, .015); part(box(.08, .2, .3), 0x3a2e22, thrown, 0, -.06, .35, .012); thrown.visible = false; scene.add(thrown);
  const shadow = new T.Mesh(new T.CircleGeometry(.8, 24), flat(0x6e4a22, .35)); shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, .02, FOE_Z); scene.add(shadow);

  // ---- the bullet and its wind ----
  const bullet = new T.Group(); bullet.scale.setScalar(1.7); scene.add(bullet);
  part(new T.LatheGeometry([[0, 0], [.062, 0], [.06, .22], [.035, .4], [0, .5]].map(([x, y]) => new T.Vector2(x, y)), 16).rotateX(-Math.PI / 2).translate(0, 0, -.25), 0xf3b44d, bullet, 0, 0, 0, .014);
  const streak = new T.Mesh(new T.ConeGeometry(.05, 2.6, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 1.55), flat(0xfff3d0, .8)); bullet.add(streak);
  const lines = Array.from({ length: 90 }, (_, i) => { const a = rnd(i) * 6.283, d = 2.3 + rnd(i + 40) * 3.4, len = 5 + rnd(i + 80) * 12; const m = new T.Mesh(new T.PlaneGeometry(.03 + rnd(i + 5) * .035, len), flat(0xfffaee, .9)); m.position.set(Math.cos(a) * d, HEAD_Y - .3 + Math.sin(a) * d * .55, -rnd(i + 120) * 50 - 2); m.rotation.set(Math.PI / 2, 0, 0); scene.add(m); return m; });

  // ---- the hit ----
  const hitStar = badge(starShape(12, 1, .5), 0xffffff, .07), hitStar2 = badge(starShape(8, .66, .32), 0xffd24a, 0); hitStar2.position.z = .02;
  const hitG = new T.Group(); hitG.add(hitStar, hitStar2); scene.add(hitG);
  const ring = new T.Mesh(new T.RingGeometry(.92, 1, 36), flat(0xffffff, .9)); scene.add(ring);
  const shards = Array.from({ length: 8 }, (_, i) => ({ m: part(box(.1, .1, .1), i % 3 ? 0xf3b44d : 0x2e2418, scene, 0, 0, 0, .01), v: new T.Vector3((rnd(i) - .5) * 4, 1.2 + rnd(i + 20) * 3, (rnd(i + 40) - .3) * 3.2), s: rnd(i + 60) * 9 }));

  const mark = new T.Group(); scene.add(mark);
  for (const a of [.785, -.785]) for (const sg of [1, -1]) { const b = badge(new T.PlaneGeometry(.34, .09), 0xffffff, .22); b.position.set(Math.cos(a) * sg * .27, Math.sin(a) * sg * .27, 0); b.rotation.z = a; mark.add(b); }
  const veil = new T.Mesh(new T.PlaneGeometry(6, 6), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, depthWrite: false, fog: false })); veil.position.z = -.3; veil.renderOrder = 1000; cam.add(veil); scene.add(cam);
  const shock = new T.Mesh(new T.RingGeometry(.9, 1, 40), flat(0xffffff, .9)); scene.add(shock);
  const aim = new T.Vector3(), tmp = new T.Vector3(), hip = new T.Vector3(), hand = new T.Vector3();
  const render = (t: number) => {
    t = clamp(t / SLOW, 0, DURATION);
    const w = world(t), dt = Math.max(0, w - HIT), s = Math.max(0, t - HIT);
    const inA = t < CUT_B, inB = t >= CUT_B && t < CUT_C, inC = t >= CUT_C && t < CUT_D;
    const fd = Math.max(0, t - FIRE), sl = fd * .55;
    const kick = fd > 0 ? Math.exp(-sl * 7) * Math.sin(Math.min(1, sl * 9) * 1.57) : 0;
    const settle = t < FIRE ? smooth(t, 0, FIRE) : 1;
    // the shooter and the rifle: raised a little before the shot, thrown back by it
    gun.position.set(0, GUN_Y + (1 - settle) * -.05 + Math.sin(t * 3.2) * .004, kick * .2); gun.rotation.set(kick * .18, 0, 0);
    me.g.position.set(-.3, 0, 1.0 + kick * .1); me.g.rotation.x = kick * .05; me.torso.rotation.x = kick * .1 - (1 - settle) * .02;
    gun.updateMatrixWorld(true);
    armR(hip.set(-.3 + .33, 1.42, 1.0 + kick * .1), hand.set(0, 0, .26).applyMatrix4(gun.matrixWorld).add(tmp.set(0, -.2, 0)));
    armL(hip.set(-.3 - .33, 1.42, 1.0 + kick * .1), hand.set(0, -.07, -.42).applyMatrix4(gun.matrixWorld));
    glint.visible = t > .22 && t < .34; glint.scale.setScalar(Math.sin(clamp((t - .22) / .12) * Math.PI) * 1.6 + .01); glint.lookAt(cam.position);
    // muzzle: placed on the actual barrel end every frame
    tmp.set(0, .01, -1.3).applyMatrix4(gun.matrixWorld);
    mz.position.copy(tmp); mz.visible = fd > 0 && fd < .17; const bk = clamp(fd / .17);
    mz.scale.setScalar(.34 + Math.sin(bk * 1.6) * .5); mz.rotation.z = bk * .5; mz.lookAt(cam.position); mz.rotateZ(bk * .5);
    puffs.forEach((p) => { const k = clamp(sl * .8 - .02); p.m.visible = fd > 0 && k < 1; p.m.position.set(tmp.x + Math.cos(p.a) * k * .5 * p.d, tmp.y + Math.sin(p.a) * k * .4 * p.d + k * .15, tmp.z - .1 - k * .55 * p.d); p.m.scale.setScalar(.4 + k * 1.8); (p.m.material as T.MeshBasicMaterial).opacity = (1 - k) * .95; p.m.lookAt(cam.position); });
    casing.visible = fd > 0 && fd < 1.6; casing.position.set(.14 + sl * .9, GUN_Y + .12 + sl * 1.1 - sl * sl * 2.6, .1 + sl * .3 + kick * .2); casing.rotation.set(sl * 11, sl * 7, sl * 5);

    shock.visible = fd > 0 && fd < .3; shock.position.copy(tmp); shock.scale.setScalar(.15 + fd * 4.2); (shock.material as T.MeshBasicMaterial).opacity = .9 * (1 - fd / .3); shock.lookAt(cam.position);
    // bullet and wind
    const bz = inA ? -1.1 : bulletZ(Math.min(t, HIT)), u = clamp((t - CUT_B) / (HIT - CUT_B));
    const by = lerp(GUN_Y + .01, HEAD_Y + .03, smooth(u, .05, 1));
    bullet.position.set(0, by, bz); bullet.visible = t >= FIRE + .06 && t < HIT; streak.visible = t < HIT - .12; streak.scale.set(1, 1, inA ? 1 : lerp(1, .5, smooth(u, .8, 1)));
    lines.forEach((l) => { l.visible = inB; if (inB) (l.material as T.MeshBasicMaterial).opacity = .9 * (1 - smooth(u, .78, 1)); });

    // the target: head snaps back at the hit, helmet flies, then it falls away from us toward the door
    const snap = s > 0 ? smooth(s, 0, .06) * (1 - .55 * smooth(s, .25, .9)) : 0;
    foe.head.rotation.x = -snap * .6; foe.head.position.z = -snap * .1;
    const fall = smooth(dt, .05, 1.0) * 1.5;
    rifle.visible = s <= 0; thrown.visible = s > 0;
    if (s > 0) { thrown.position.set(.1 + .7 * dt, Math.max(.12, 1.2 + 2.2 * dt - 4.9 * dt * dt), FOE_Z + .5 - 1.5 * dt); const air = thrown.position.y > .13; thrown.rotation.set(air ? dt * 6 : 1.4, air ? dt * 3 : .5, air ? dt * 4 : .2); }
    foeG.rotation.x = -fall; foeG.position.set(0, Math.sin(clamp(dt * 3, 0, Math.PI)) * .1, FOE_Z - fall * .55);
    const lift = dt > 0 ? new T.Vector3(.5 * dt, 3.1 * dt - 4.9 * dt * dt, -.9 * dt) : new T.Vector3();
    helmet.position.set(lift.x, Math.max(.14, HEAD_Y + .2 + lift.y), FOE_Z + lift.z); helmet.rotation.set(dt * 7, dt * 4, dt * 6); helmet.visible = true;
    const hk = clamp(s / .5);
    hitG.visible = s > 0 && hk < 1; hitG.position.set(.04, HEAD_Y + .05, FOE_Z - .25); hitG.scale.setScalar(.15 + smooth(hk, 0, .18) * 1.15 * (1 - smooth(hk, .35, 1))); hitG.lookAt(cam.position);
    ring.visible = s > 0 && s < .45; ring.position.set(0, HEAD_Y + .05, FOE_Z + .1); ring.scale.setScalar(.2 + s * 5); (ring.material as T.MeshBasicMaterial).opacity = .9 * (1 - s / .45); ring.lookAt(cam.position);
    shards.forEach((p) => { p.m.visible = dt > 0 && dt < 1.3; p.m.position.set(p.v.x * dt * .6, HEAD_Y + p.v.y * dt - 4.9 * dt * dt, FOE_Z + p.v.z * dt * .5); p.m.position.y = Math.max(.08, p.m.position.y); p.m.rotation.set(dt * p.s, dt * p.s * .7, 0); p.m.scale.setScalar(1 - smooth(dt, .8, 1.3)); });

    // cameras
    cam.up.set(0, 1, 0); let roll = 0;
    if (inA) {
      const push = smooth(t, 0, CUT_B);
      cam.position.set(3.7 - push * .5, .72, -.5 + push * .15); aim.set(-.05, 1.22, .1 + kick * .06); cam.fov = 36 - push * 3;
      cam.position.x += Math.sin(t * 90) * kick * .014; cam.position.y += Math.cos(t * 70) * kick * .014; roll = -.04;
    } else if (inB) {
      const near = smooth(u, .5, 1);
      cam.position.set(lerp(.7, 1.1, near), by + lerp(.5, .1, near), bz + lerp(2.3, 3.3, near));
      aim.set(lerp(.05, .05, near), lerp(by - .12, HEAD_Y, near), bz - lerp(4, .5, near));
      cam.fov = lerp(lerp(84, 54, smooth(u, 0, .22)), 30, near); roll = Math.sin(u * 8) * .02 + near * .05;
    } else if (inC) {
      const k = smooth(s, 0, .8);
      cam.position.set(lerp(2.3, 3.2, k), lerp(1.62, 1.4, k), FOE_Z + lerp(3.1, 3.7, k)); aim.set(0, lerp(1.5, 1.15, k), FOE_Z - lerp(.1, .5, k)); cam.fov = lerp(30, 34, k); roll = -.04;
      cam.position.x += Math.sin(t * 80) * .03 * (s > 0 ? 1 - smooth(s, 0, .3) : 0);
    } else {
      const k = smooth(t, CUT_D, DURATION);
      cam.position.set(.8, 1.28, 1.9); aim.set(lerp(-.15, 0, k), lerp(1.3, 1.0, k), FOE_Z); cam.fov = lerp(38, 7.5, smooth(k, .1, 1)); roll = .02;
    }
    if (cam.aspect < 1.25) cam.fov = 2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * (1.25 / cam.aspect)) * (180 / Math.PI); // a tall screen widens the view so it all still fits
    cam.lookAt(aim); cam.rotateZ(roll); cam.updateProjectionMatrix();
    heaven.position.copy(cam.position); sky.position.copy(cam.position);
    mark.visible = t >= CUT_D + .45; const mk = clamp((t - CUT_D - .45) / .35);
    mark.position.set(0, 1.45, FOE_Z + .5); mark.scale.setScalar(cam.position.distanceTo(mark.position) * Math.tan((cam.fov * Math.PI) / 360) * (.2 + smooth(mk, 0, .15) * .08) * (1 - smooth(mk, .7, 1) * .4)); mark.lookAt(cam.position);
    const vq = Math.max(t >= HIT ? .85 * (1 - clamp((t - HIT) / .07)) : 0, t >= CUT_D ? .9 * (1 - clamp((t - CUT_D) / .11)) : 0);
    veil.visible = vq > .01; (veil.material as T.MeshBasicMaterial).opacity = vq;
    r.render(scene, cam);
  };
  const resize = (w: number, h: number) => { r.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.setViewOffset(w, h, 0, h * .08, w, h); /* the result card covers the bottom of the screen, so the picture sits higher */ };
  const dispose = () => { scene.traverse((o) => { const m = o as T.Mesh; m.geometry?.dispose?.(); const mt = m.material as T.Material | T.Material[] | undefined; (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => x.dispose()); }); r.dispose(); };
  return { duration: DURATION * SLOW, render, resize, dispose };
};
