import * as T from 'three';
import { SceneMaker, canvasTex, clamp, glowTex, lag, lerp, makeRenderer, rnd, smooth, soldier, speckTex, starTex } from './kit';

/**
 * The no-scope as a bullet-cam: the shot leaves an AWP that never raised its scope and the camera rides it down a dusty alley, slowing as it
 * goes through one head and then another (the collateral the moment is named for), each helmet popping off. Time is the only input.
 */
export const DURATION = 3.4;
const HEAD_Y = 1.67;
const FOES = [{ z: -16, x: 0, team: 'ct' as const }, { z: -26, x: .06, team: 't' as const }];
// bullet distance travelled (negative z) against time: fast, slow through each target, fast again
const KEYS: [number, number][] = [[0, 0], [.3, -3], [.8, -13.4], [1.3, -16.7], [1.55, -17.5], [1.9, -22.4], [2.3, -25.4], [2.7, -27.2], [3.0, -28.6], [3.4, -29.6]];
const raw = (t: number) => { if (t <= 0) return 0; for (let i = 1; i < KEYS.length; i++) if (t <= KEYS[i][0]) { const [t0, z0] = KEYS[i - 1], [t1, z1] = KEYS[i]; return lerp(z0, z1, (t - t0) / (t1 - t0)); } return KEYS[KEYS.length - 1][1]; };
const bz = (t: number) => lag(raw, t, .16, 7);
const hitAt = (z: number) => { let a = 0, b = DURATION; for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (bz(m) > z) a = m; else b = m; } return (a + b) / 2; };
export const HITS = FOES.map((f) => hitAt(f.z));

const BURST = 26;
export const noscope: SceneMaker = (canvas) => {
  const r = makeRenderer(canvas);
  const scene = new T.Scene();
  const sky = new T.Color(0xe7c48e);
  scene.background = sky; scene.fog = new T.FogExp2(0xdcb882, .034);
  const cam = new T.PerspectiveCamera(60, 1, .05, 120);

  scene.add(new T.HemisphereLight(0xfff0d0, 0x6b563a, 1.25));
  const sun = new T.DirectionalLight(0xffd9a0, 2.6); sun.position.set(-6, 9, 4); scene.add(sun);
  const rim = new T.DirectionalLight(0x7fb0ff, 1.1); rim.position.set(5, 3, -10); scene.add(rim);

  const dust = canvasTex(256, 256, (g) => {
    g.fillStyle = '#c9a56b'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { const v = 150 + rnd(i) * 70; g.fillStyle = `rgba(${v},${v * .82},${v * .55},.35)`; g.fillRect(rnd(i + 9) * 256, rnd(i + 99) * 256, 1 + rnd(i + 5) * 3, 1 + rnd(i + 7) * 3); }
  }, [6, 40]);
  const plaster = canvasTex(256, 256, (g) => {
    g.fillStyle = '#d8b783'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1500; i++) { const v = 170 + rnd(i) * 60; g.fillStyle = `rgba(${v},${v * .8},${v * .55},.3)`; g.fillRect(rnd(i + 3) * 256, rnd(i + 31) * 256, 2 + rnd(i + 8) * 14, 1 + rnd(i + 2) * 4); }
    g.fillStyle = 'rgba(90,60,30,.35)'; g.fillRect(0, 214, 256, 42);
  }, [14, 1.3]);
  const floor = new T.Mesh(new T.PlaneGeometry(14, 120), new T.MeshStandardMaterial({ map: dust, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.z = -45; scene.add(floor);
  const wallM = new T.MeshStandardMaterial({ map: plaster, roughness: 1 });
  const wall = (x: number, z0: number, z1: number, h: number) => { const w = new T.Mesh(new T.BoxGeometry(.6, h, z0 - z1), wallM); w.position.set(x, h / 2, -(z0 + z1) / 2 + 0); w.position.z = (z0 + z1) / -2; scene.add(w); };
  wall(-4.2, -20, 20, 6.5); wall(4.2, -2, 18, 6.5); wall(4.2, -29, -8, 6.5); wall(4.2, -80, -34, 6.5); wall(-4.2, -80, -20, 6.5);
  const crateM = new T.MeshStandardMaterial({ color: 0x8a6a3c, roughness: .9, flatShading: true });
  for (const [x, z, s] of [[-3, -6, 1.3], [-2.9, -7.4, .9], [3, -12, 1.1], [-2.8, -21, 1.5], [3.1, -31, 1.2], [-3, -33, 1]] as const) { const c = new T.Mesh(new T.BoxGeometry(s, s, s), crateM); c.position.set(x, s / 2, z); c.rotation.y = x * z * .1; scene.add(c); }
  const door = new T.Mesh(new T.PlaneGeometry(9, 9), new T.MeshBasicMaterial({ color: 0xfff4d8, fog: false })); door.position.set(0, 3, -75); scene.add(door);

  const foes = FOES.map((f) => { const s = soldier(f.team); s.root.position.set(f.x, 0, f.z); scene.add(s.root); s.helmet.removeFromParent(); s.helmet.position.set(f.x, HEAD_Y + .02, f.z); scene.add(s.helmet); return s; });

  const bullet = new T.Group();
  const prof = [[0, 0], [.036, .02], [.046, .09], [.047, .22], [.05, .3], [.05, .5], [.043, .52], [0, .52]].map(([x, y]) => new T.Vector2(x, y));
  const slug = new T.Mesh(new T.LatheGeometry(prof, 14), new T.MeshStandardMaterial({ color: 0xe0a64a, metalness: .95, roughness: .22, emissive: 0xff8a2a, emissiveIntensity: .55 }));
  slug.rotation.x = -Math.PI / 2; bullet.add(slug); scene.add(bullet);
  const glow = glowTex(), star = starTex(), speck = speckTex();
  const addSprite = (map: T.Texture, o = 1) => { const s = new T.Sprite(new T.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: o, fog: false })); scene.add(s); return s; };
  const halo = addSprite(glow); const flash = addSprite(star);
  const trail = new T.Mesh(new T.CylinderGeometry(.006, .03, 1, 8, 1, true), new T.MeshBasicMaterial({ color: 0xffe3b0, transparent: true, opacity: .55, blending: T.AdditiveBlending, depthWrite: false, fog: false })); trail.rotation.x = Math.PI / 2; scene.add(trail);
  const rings = Array.from({ length: 16 }, (_, i) => { const m = new T.Mesh(new T.RingGeometry(.9, 1, 40), new T.MeshBasicMaterial({ color: 0xfff1d4, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })); scene.add(m); return { m, z: -.8 - i * 1.15 }; });
  const bursts = HITS.map((_, h) => Array.from({ length: BURST }, (_, i) => { const s = addSprite(speck); return { s, v: new T.Vector3((rnd(i + h * 50) - .5) * 5, (rnd(i + h * 50 + 1) - .2) * 4.2, (rnd(i + h * 50 + 2) - .55) * 6), k: .08 + rnd(i + h * 50 + 3) * .22, warm: rnd(i + 4) > .45 }; }));
  const hitFlash = HITS.map(() => addSprite(star));
  const muzzle = addSprite(star); const veil = addSprite(glow);

  const pos = new T.Vector3(), look = new T.Vector3(), off = new T.Vector3();
  const OFF_CHASE = new T.Vector3(.95, .5, 2.7), OFF_A = new T.Vector3(1.9, .12, .9), OFF_B = new T.Vector3(-1.8, .1, .8), OFF_END = new T.Vector3(.9, 1.5, 3.8), END_POS = new T.Vector3(2.7, 1.5, -19.5), END_LOOK = new T.Vector3(0, .6, -25);

  const render = (t: number) => {
    t = clamp(t, 0, DURATION);
    const z = bz(t);
    pos.set(0, HEAD_Y - .02 * smooth(t, 0, 3), z);
    bullet.position.copy(pos); slug.rotation.y = t * 60;
    // camera: chase, swing to the side as it goes through each head, then pull back to see the aftermath
    const wa = smooth(t, HITS[0] - .38, HITS[0] - .06) * (1 - smooth(t, HITS[0] + .25, HITS[0] + .6));
    const wb = smooth(t, HITS[1] - .38, HITS[1] - .06) * (1 - smooth(t, HITS[1] + .45, HITS[1] + .8));
    const we = smooth(t, 2.75, 3.3);
    off.copy(OFF_CHASE).lerp(OFF_A, wa).lerp(OFF_B, wb).lerp(OFF_END, we);
    const lz = lag(raw, t - .05, .3, 8);
    cam.position.set(off.x, pos.y + off.y, lz + off.z);
    cam.position.lerp(END_POS, we);
    cam.position.x += Math.sin(t * 37) * .01 * (smooth(t, 0, .1) * (1 - smooth(t, .1, .5)));
    look.set(0, pos.y, lerp(z - 3, z - .2, Math.max(wa, wb)) + 0);
    look.lerp(END_LOOK, we);
    cam.lookAt(look);
    cam.fov = lerp(lerp(lerp(62, 36, wa), 36, wb), 50, we) + (1 - smooth(t, 0, .35)) * 24;
    cam.updateProjectionMatrix();

    halo.position.copy(pos); halo.scale.setScalar(.55 + .1 * Math.sin(t * 50));
    trail.position.set(0, pos.y, z + 1.2 + t * .0); trail.scale.set(1, 2.4 + clamp(-z * .35, 0, 5), 1); trail.position.z = z + trail.scale.y / 2; (trail.material as T.MeshBasicMaterial).opacity = .5 * (1 - smooth(t, 2.85, 3.3));
    for (const g of rings) { const d = g.z - z; g.m.visible = d > 0 && d < 5; if (!g.m.visible) continue; const k = d / 5; g.m.position.set(0, pos.y, g.z); g.m.scale.setScalar(.12 + k * 1.6); (g.m.material as T.MeshBasicMaterial).opacity = .3 * (1 - k) * smooth(d, 0, .08); }

    // muzzle flash right at the start, filling the frame, and a white veil that clears
    const mk = clamp(t / .28);
    muzzle.visible = t < .32; muzzle.position.set(.2, pos.y + .02, z + 1.4); muzzle.scale.setScalar(2.4 + mk * 5); (muzzle.material as T.SpriteMaterial).opacity = 1 - mk; (muzzle.material as T.SpriteMaterial).rotation = mk * .7;
    veil.visible = t < .22; veil.position.copy(cam.position).add(new T.Vector3(0, 0, -.6)); veil.scale.setScalar(2.6); (veil.material as T.SpriteMaterial).opacity = .9 * (1 - clamp(t / .22));

    foes.forEach((s, i) => {
      const th = HITS[i], dt = Math.max(0, t - th);
      const fall = smooth(dt, .02, .9) * 1.35;
      s.root.rotation.x = -fall; s.root.position.z = FOES[i].z - fall * .45; s.root.position.y = Math.sin(clamp(dt * 2, 0, Math.PI)) * .08 * (dt > 0 ? 1 : 0);
      s.shadow.visible = true;
      // the helmet leaves the head at the hit, spinning
      const ho = dt > 0 ? new T.Vector3(.9 * (i ? -1 : 1) * dt, 3.2 * dt - 4.2 * dt * dt, -2.6 * dt) : new T.Vector3();
      s.helmet.position.set(FOES[i].x + ho.x, HEAD_Y + .02 + ho.y - (dt > 0 ? 0 : 0), FOES[i].z + ho.z);
      s.helmet.rotation.set(dt * 9, dt * 5, dt * 7);
      if (s.helmet.position.y < .1) s.helmet.position.y = .1;
      const hp = hitFlash[i]; hp.visible = dt > 0 && dt < .28; hp.position.set(FOES[i].x, HEAD_Y, FOES[i].z + .1); hp.scale.setScalar(.5 + dt * 7); (hp.material as T.SpriteMaterial).opacity = .85 * (1 - dt / .28);
      for (const p of bursts[i]) {
        p.s.visible = dt > 0 && dt < 1.1; if (!p.s.visible) continue;
        p.s.position.set(FOES[i].x + p.v.x * dt * .5, HEAD_Y + p.v.y * dt - 3.2 * dt * dt, FOES[i].z + p.v.z * dt * .5);
        p.s.scale.setScalar(p.k * (1 + dt * 2)); const m = p.s.material as T.SpriteMaterial; m.opacity = (1 - dt / 1.1) * .9; m.color.set(p.warm ? 0xffc27a : 0xd9c3a0);
      }
    });
    r.render(scene, cam);
  };
  const resize = (w: number, h: number) => { r.setSize(w, h, false); cam.aspect = w / Math.max(1, h); if (cam.aspect < 1) cam.aspect = cam.aspect; cam.updateProjectionMatrix(); };
  const dispose = () => { scene.traverse((o) => { const m = o as T.Mesh; m.geometry?.dispose?.(); const mt = m.material as T.Material | T.Material[] | undefined; (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => { (x as T.MeshStandardMaterial).map?.dispose(); x.dispose(); }); }); r.dispose(); };
  return { duration: DURATION, render, resize, dispose };
};
