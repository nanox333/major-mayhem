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
