import { useEffect, useRef } from 'react';
import * as G from '../game/logic';
import { Run, dailyDate, dailyNumber, squadOf } from '../game/state';
import { Props, track } from '../analytics';

/**
 * Turns run state changes into analytics events by comparing each state with the previous one, so the reducer
 * stays pure and a reload (which starts from the saved state) never repeats an event.
 */
export function useRunTracking(s: Run) {
  const prev = useRef(s);
  useEffect(() => {
    const p = prev.current;
    prev.current = s;
    if (p === s) return;
    const mode = s.mode;
    const date = dailyDate(s);
    const base: Props = date ? { mode, daily: dailyNumber(date) } : { mode };
    if (p.seed !== s.seed) {
      // A new run replaced one that was started but never finished.
      if (p.phase !== 'final' && (p.offerKey > 0 || p.picks.length > 0)) track('run_abandon', { mode: p.mode, phase: p.phase, picks: p.picks.length, matches: p.t.matches.length });
      return;
    }
    if (p.offerKey === 0 && s.offerKey === 1) track('run_start', base);
    if (s.rerolls < p.rerolls) track('reroll', { ...base, round: s.picks.length + 1 });
    if (p.phase === 'draft' && s.phase === 'ready') track('draft_done', base);
    if (s.t.matches.length > p.t.matches.length) {
      const m = s.t.matches[s.t.matches.length - 1];
      track('match_result', { ...base, stage: m.stage, result: m.won ? 'win' : 'loss', score: `${m.score[0]}-${m.score[1]}` });
    }
    if (p.phase !== 'final' && s.phase === 'final') {
      const pl = G.placement(s.t);
      const { grade } = G.draftReview(s.picks);
      const mvp = G.mvp(s.t, squadOf(s));
      track('run_finish', { ...base, placement: pl.key, reached: pl.reached, mvp: mvp.player.nick, ...(grade !== null ? { grade: Math.round(grade * 100) } : {}) });
    }
  }, [s]);
}
