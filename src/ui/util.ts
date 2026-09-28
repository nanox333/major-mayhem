import { Roster } from '../data/rosters';

export const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const fmt = (r: number) => r.toFixed(2);
const RARITY: Record<string, string> = { Champions: 'gold', 'Runner-up': 'covert', Semifinalist: 'classified', Quarterfinalist: 'restricted' };
export const rarity = (r: Roster) => RARITY[r.result] ?? 'milspec';
export const ratingClass = (r: number) => (r >= 1.1 ? 'hi' : r < 0.9 ? 'lo' : '');

/** Live-match signals for the board, which lives outside the match screen. */
export const pulse = (id: string, good: boolean) => window.dispatchEvent(new CustomEvent('mm-pulse', { detail: { id, good } }));
export const announceMap = (map: string | null) => window.dispatchEvent(new CustomEvent('mm-map', { detail: map }));
export const announceSide = (side: 'T' | 'CT') => window.dispatchEvent(new CustomEvent('mm-side', { detail: side }));
