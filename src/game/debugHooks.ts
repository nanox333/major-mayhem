import type { LegendKind } from './match';

/**
 * Debug-only switches, set by the debug menu and never by the game. Each one is read in exactly one place and is `null` in normal
 * play, so with the menu off nothing here changes a result. `legend` makes the next round your team wins a legendary one (#292, #296).
 */
export const debugHooks: { legend: LegendKind | null } = { legend: null };
