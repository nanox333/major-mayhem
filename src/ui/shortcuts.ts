import { useEffect, useRef } from 'react';

// Keyboard shortcuts (#77) for desktop players and streamers. Single-key shortcuts can be turned off in the settings (WCAG 2.1.4), they never fire
// while you are typing, with a modifier held, or with a dialog open, and everything they do is also a button on the page.

export interface Shortcut { keys: string; does: string; where: string }
export const SHORTCUTS: Shortcut[] = [
  { keys: '1  2  3', does: 'Go to the first player in that team', where: 'Draft' },
  { keys: 'Enter', does: 'Draft the player you chose', where: 'Draft' },
  { keys: 'Space', does: 'Pause or resume playback', where: 'Match' },
  { keys: '→', does: 'Next round, while paused', where: 'Match' },
  { keys: 'T', does: 'Call a timeout', where: 'Match' },
  { keys: 'M', does: 'Mute or unmute', where: 'Anywhere' },
  { keys: '?', does: 'Show these shortcuts', where: 'Anywhere' },
];

/** True while a key press belongs to something else: a field you are typing in, a menu, or a dialog. */
export function typing(e: KeyboardEvent): boolean {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.getAttribute('role') === 'combobox';
}

/** The handlers a screen gives; a key with no handler is left alone. */
export type ShortcutHandlers = Partial<Record<'1' | '2' | '3' | '4' | 'Enter' | 't' | 'm' | '?', () => void>>;

export function useShortcuts(on: boolean, handlers: ShortcutHandlers, blocked: boolean) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!on || blocked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || typing(e) || document.querySelector('[role="dialog"], .menu__panel')) return;
      const k = (e.key.length === 1 ? e.key.toLowerCase() : e.key) as keyof ShortcutHandlers;
      const fn = ref.current[k];
      if (!fn) return;
      // Enter on a focused button or link already does that button's job: only step in when focus is elsewhere.
      if (k === 'Enter' && e.target instanceof HTMLElement && /^(BUTTON|A|SUMMARY)$/.test(e.target.tagName)) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [on, blocked]);
}
