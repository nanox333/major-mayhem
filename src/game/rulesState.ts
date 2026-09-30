// The active rules version (see RULES in data/rosters.ts). The game sets it to the current run's version; the
// simulation and role data follow it, so an old daily replays exactly as it first played.
import { LATEST_RULES, applyRoles } from '../data/rosters';

let activeRules = LATEST_RULES;
export const rules = () => activeRules;

const listeners: (() => void)[] = [];
/** Runs `fn` whenever the active rules version changes, so a cache that depends on the rules can drop what it holds. */
export const onRulesChange = (fn: () => void) => { listeners.push(fn); };

export function setRules(v: number) {
  if (v === activeRules) return;
  activeRules = v;
  applyRoles(v);
  for (const fn of listeners) fn();
}
/** Runs `fn` under rules `v`, then restores the previous version. */
export function withRules<T>(v: number, fn: () => T): T {
  const prev = activeRules;
  setRules(v);
  try { return fn(); } finally { setRules(prev); }
}
