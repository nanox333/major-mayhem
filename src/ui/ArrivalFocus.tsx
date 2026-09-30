import { useEffect } from 'react';
import { focusIfAdrift } from './util';

/**
 * Puts keyboard focus on the first match of `selector` when this mounts (#180): a screen that replaces the one you were on, after you committed a pick
 * or opened a case by keyboard. It does nothing for a mouse, and never takes focus from a control you already moved to.
 */
export function ArrivalFocus({ selector }: { selector: string }) {
  useEffect(() => {
    const t = setTimeout(() => focusIfAdrift(document.querySelector<HTMLElement>(selector)), 0);
    return () => clearTimeout(t);
  }, []);
  return null;
}
