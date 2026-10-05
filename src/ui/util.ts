import { useEffect, useState } from 'react';
import { debugForceReducedMotion } from './debugFlags';
import { Roster } from '../data/rosters';

/** Whether a media query matches now, and again when it changes (a phone turned sideways, a window resized). */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

// Whether the last thing you did was press a key (and not use a pointer): focus is only moved for you when you are steering by keyboard (#180).
let keyboard = false;
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => { keyboard = true; }, true);
  window.addEventListener('pointerdown', () => { keyboard = false; }, true);
}
export const usedKeyboard = () => keyboard;
/** Moves focus to `el` when you are using the keyboard and focus has been lost (a control that held it was removed), never taking it from somewhere you put it (#180). */
export function focusIfAdrift(el: HTMLElement | null) {
  if (el && keyboard && (!document.activeElement || document.activeElement === document.body)) el.focus();
}

export const reduceMotion = () => typeof window !== 'undefined' && (debugForceReducedMotion() || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
export const fmt = (r: number) => r.toFixed(2);
const RARITY: Record<string, string> = { Champions: 'gold', 'Runner-up': 'covert', Semifinalist: 'classified', Quarterfinalist: 'restricted' };
export const rarity = (r: Roster) => RARITY[r.result] ?? 'milspec';
export const ratingClass = (r: number) => (r >= 1.1 ? 'hi' : r < 0.9 ? 'lo' : '');

/** Live-match signals for the board, which lives outside the match screen. */
export const pulse = (id: string, good: boolean) => window.dispatchEvent(new CustomEvent('mm-pulse', { detail: { id, good } }));
export const announceMap = (map: string | null) => window.dispatchEvent(new CustomEvent('mm-map', { detail: map }));
export const announceSide = (side: 'T' | 'CT') => window.dispatchEvent(new CustomEvent('mm-side', { detail: side }));
