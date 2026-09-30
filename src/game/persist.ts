import { useSyncExternalStore } from 'react';

// Saving to the browser (#166). Writes can fail (a full quota, a private window, blocked storage) and the game keeps working, so the page must say when what
// you do is not being kept. Every store writes through here; a failure is remembered and shown until a write succeeds again.
let failed: string | null = null;
const listeners = new Set<() => void>();
const set = (v: string | null) => { if (failed !== v) { failed = v; listeners.forEach((fn) => fn()); } };

/** Writes one key. Returns whether it was kept; a failure is recorded against `what` ("your run", "your record"). */
export function safeSet(key: string, value: string, what: string): boolean {
  try { localStorage.setItem(key, value); set(null); return true; } catch { set(what); return false; }
}
export const readKey = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
export const removeKey = (key: string) => { try { localStorage.removeItem(key); } catch { /* blocked */ } };

/** What could not be saved, or null when saving works. */
export const useUnsaved = () => useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => failed);
export const unsavedNow = () => failed;
