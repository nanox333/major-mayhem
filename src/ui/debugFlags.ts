import { useSyncExternalStore } from 'react';

// Debug switches (the debug menu, hidden unless ?debug is in the address or Ctrl+Shift+D was pressed). Nothing here is part of the game: it only ever shows more.
export const DEBUG_FLAG = 'mm-debug';
const RATINGS = 'mm-debug-ratings';

/** `?debug` in the address, before the # (`/?debug`) or after it (`/#/?debug`, which is where it ends up when typed onto a page address). */
export const debugInUrl = () => { try { return /[?&]debug\b/.test(location.search + location.hash); } catch { return false; } };
/** Whether the debug tools are on at all. */
export const debugEnabled = () => { try { return localStorage.getItem(DEBUG_FLAG) === '1' || debugInUrl(); } catch { return debugInUrl(); } };

const listeners = new Set<() => void>();
const ratingsOn = () => { try { return debugEnabled() && localStorage.getItem(RATINGS) === '1'; } catch { return false; } };

/** Shows every player's hidden game rating in the roster archive and the roster sheets. */
export function setDebugRatings(on: boolean) {
  try { on ? localStorage.setItem(RATINGS, '1') : localStorage.removeItem(RATINGS); } catch { /* storage unavailable */ }
  listeners.forEach((fn) => fn());
}
export const useDebugRatings = (): boolean => useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, ratingsOn, () => false);

// More switches for the debug workbench (#296). Each is a plain flag in the browser, read only while the debug tools are on.
const flag = (key: string) => { try { return debugEnabled() && localStorage.getItem(key) === '1'; } catch { return false; } };
const setFlag = (key: string, on: boolean) => { try { on ? localStorage.setItem(key, '1') : localStorage.removeItem(key); } catch { /* storage unavailable */ } };
/** Forces the case reel's lighter mode on, as on a slow device. */
export const debugForceLite = () => flag('mm-debug-lite');
export const setDebugForceLite = (on: boolean) => setFlag('mm-debug-lite', on);
/** Makes the parts of the app that ask "is reduced motion on?" in code answer yes (the stylesheet's own media query is the browser's to decide). */
export const debugForceReducedMotion = () => flag('mm-debug-rm');
export const setDebugForceReducedMotion = (on: boolean) => setFlag('mm-debug-rm', on);
