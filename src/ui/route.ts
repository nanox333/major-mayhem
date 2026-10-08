// Addresses for the game's pages (#222). The page is one file with no server, so a route is a hash: `#/guess`, `#/archive` and so on.
// Switching page on purpose pushes a history entry, so Back and Forward move between pages; inside a draft nothing is pushed per pick, and Back from
// the draft goes to the Home with the run kept, which is what the logo does. A challenge link (`#duel=…`) is not a route: App reads it once and clears it.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { View } from './TopBar';

/** The hash for each page. The draft is `#/play`: it is reached from Home, so Back from it is Home. */
export const ROUTES: Record<View, string> = { home: '#/', draft: '#/play', guess: '#/guess', duo: '#/duo', archive: '#/archive', stats: '#/stats', setup: '#/setup', contact: '#/contact' };
const BY_HASH = new Map<string, View>((Object.entries(ROUTES) as [View, string][]).map(([v, h]) => [h, v]));

/** The page a hash names, or null when it names none (an empty hash is the Home; anything else unknown is not a page). */
export function viewFromHash(hash: string): View | null {
  if (hash === '' || hash === '#') return 'home';
  // Tolerate a trailing slash and a query after the path (`#/guess/`, `#/guess?x`).
  const path = hash.replace(/[?].*$/, '');
  const clean = path.length > 2 ? path.replace(/\/+$/, '') : path;
  return BY_HASH.get(clean) ?? null;
}

/**
 * The page to show when the game opens on `hash`. Every visit opens on the Home unless it names a page of its own: the draft is never resumed on load (a saved
 * run is one "Continue" away), and an address the game doesn't know is the Home.
 */
export const landingView = (hash: string): View => { const v = viewFromHash(hash); return v === null || v === 'draft' ? 'home' : v; };

const isDuelHash = (hash: string) => hash.startsWith('#duel=');

/**
 * The page you are on, kept in step with the address bar. `setView` pushes a history entry when the page changes; Back, Forward and a hand-edited address
 * change the page without one. A page you landed on (a first load, an unknown address, the draft that is not resumed) has its address written over with
 * `replaceState`, so it adds nothing to the history.
 */
export function useView(): [View, (v: View) => void] {
  const [view, setViewState] = useState<View>(() => landingView(typeof location === 'undefined' ? '' : location.hash));
  const current = useRef(view);
  useEffect(() => {
    try {
      const want = ROUTES[current.current];
      if (!isDuelHash(location.hash) && location.hash !== want && !(want === ROUTES.home && location.hash === '')) history.replaceState(null, '', location.pathname + location.search + want);
    } catch { /* a sandboxed frame may not allow it: the pages still work without addresses */ }
  }, []);
  useEffect(() => {
    const onNav = () => {
      if (isDuelHash(location.hash)) return;
      // Forward after Back can land on the draft: it is a page then, and shows the run. An address the game doesn't know is the Home.
      const next = viewFromHash(location.hash) ?? 'home';
      if (next === current.current) return;
      current.current = next;
      setViewState(next);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('popstate', onNav);
    window.addEventListener('hashchange', onNav);
    return () => { window.removeEventListener('popstate', onNav); window.removeEventListener('hashchange', onNav); };
  }, []);
  const setView = useCallback((next: View) => {
    if (current.current === next) return;
    current.current = next;
    try { history.pushState(null, '', location.pathname + location.search + ROUTES[next]); } catch { /* see above */ }
    setViewState(next);
  }, []);
  return [view, setView];
}
