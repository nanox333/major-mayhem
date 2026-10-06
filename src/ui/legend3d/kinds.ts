import type { LegendKind } from '../../game/match';

/** The legendary moments that take over the whole page as a real-time scene (each with its own highlight component), as opposed to the card with a small scene on it. */
export const FULL_PAGE_LEGENDS = ['ace', 'ninja', 'knife', 'noscope', 'clutch5'] as const satisfies readonly LegendKind[];
export const isFullPage = (kind: LegendKind) => (FULL_PAGE_LEGENDS as readonly string[]).includes(kind);
