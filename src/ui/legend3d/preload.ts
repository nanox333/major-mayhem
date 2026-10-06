import { endcard } from '../endcard';

/** Everything the full-page cinematics need, fetched and decoded ahead of time (when a match screen opens) so none of them waits on the network
 *  or an image decode when the moment fires. Safe to call repeatedly; every piece is cached by its own module. */
let started = false;
export function preloadLegends() {
  if (started || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  started = true;
  const ignore = () => {};
  void import('../endcard/titleScene').then((m) => Promise.all((['noscope', 'ninja', 'ace', 'knife', 'clutch'] as const).map((n) => m.load(n).catch(ignore)))).catch(ignore);
  void import('./assets').then((m) => m.preloadNoscope()).catch(ignore);
  void import('../ninja/scene').then((m) => m.preloadNinja()).catch(ignore);
  void import('../ace/scene').then((m) => m.preloadAce()).catch(ignore);
  void import('../clutch/scene').then((m) => m.preloadClutch()).catch(ignore);
  const hud = new Image(); hud.src = endcard('hud-orange'); void hud.decode?.().catch(ignore);
}
