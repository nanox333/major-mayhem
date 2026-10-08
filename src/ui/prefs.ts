import { safeSet } from '../game/persist';
import { useSyncExternalStore } from 'react';
import { resolveLanguage, setLanguage } from '../i18n';

// Preferences (#110, #75, #77): high contrast, and whether single-key shortcuts are on. The game has one palette, dark; there is no light theme. Kept in this browser like the sound and tip settings,
// and the game works when storage is blocked. They are applied as attributes on <html> so the contrast mode in styles.css switches without a re-render.

export interface Prefs {
  /** Stronger borders, brighter text and a thicker focus ring. */
  contrast: boolean;
  /** Single-key shortcuts (WCAG 2.1.4 asks for a way to turn them off). */
  shortcuts: boolean;
  fastReveals: boolean;
  /** The language code (src/i18n). With nothing saved, the first browser language the game has, else English. */
  language: string;
}
export const DEFAULT_PREFS: Prefs = { contrast: false, shortcuts: true, fastReveals: false, language: 'en' };
const KEY = 'mm-prefs';

/** Reads what was saved, keeping only values that make sense. With nothing saved, high contrast follows the system's "more contrast" setting, and the language follows the browser's. */
export function parsePrefs(raw: string | null, systemContrast = false, systemLanguages: readonly string[] = []): Prefs {
  let v: Partial<Prefs> = {};
  try { const o = raw ? JSON.parse(raw) : null; if (o && typeof o === 'object') v = o; } catch { /* a broken save: use the defaults */ }
  return {
    contrast: typeof v.contrast === 'boolean' ? v.contrast : systemContrast,
    shortcuts: typeof v.shortcuts === 'boolean' ? v.shortcuts : DEFAULT_PREFS.shortcuts,
    fastReveals: typeof v.fastReveals === 'boolean' ? v.fastReveals : DEFAULT_PREFS.fastReveals,
    language: resolveLanguage(typeof v.language === 'string' ? v.language : null, systemLanguages),
  };
}

const media = (q: string) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : null);
const read = (): Prefs => {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  const systemLanguages = typeof navigator === 'undefined' ? [] : [...(navigator.languages ?? [navigator.language])];
  return parsePrefs(raw, !!media('(prefers-contrast: more)')?.matches, systemLanguages);
};

let prefs: Prefs = typeof window === 'undefined' ? DEFAULT_PREFS : read();
const listeners = new Set<() => void>();

/** Puts the preferences on the page: the contrast mode is an attribute on <html>. */
export function applyPrefs(p: Prefs = prefs) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.contrast = p.contrast ? 'high' : 'normal';
}

export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch };
  safeSet(KEY, JSON.stringify(prefs), 'your settings');
  applyPrefs();
  setLanguage(prefs.language);
  listeners.forEach((fn) => fn());
}
export const getPrefs = () => prefs;
export const usePrefs = (): Prefs => useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, getPrefs);

// Applied as soon as this file loads, before the first paint, so there is no flash of the wrong contrast or language.
applyPrefs();
setLanguage(prefs.language);
