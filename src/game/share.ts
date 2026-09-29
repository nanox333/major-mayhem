// Spoiler-light result text for sharing, in the style of daily puzzle games.
import { ROLE_SHORT } from '../data/rosters';
import * as G from './logic';
import { Run, dailyDate, dailyNumber, squadOf } from './state';

const STAGE_SHORT: Record<G.StageKey, string> = { QUAL: 'Q', QF: 'QF', SF: 'SF', F: 'F', DUEL: 'BO3' };

export function shareText(run: Run, url?: string): string {
  const pl = G.placement(run.t);
  const mine = G.lineupFromPicks(run.picks);
  const star = G.mvp(run.t, squadOf(run));
  const rating = G.seriesRatings(run.t.matches.flatMap((m) => m.maps))[star.player.id]?.rating;
  const { grade } = G.draftReview(run.picks);
  const date = dailyDate(run);
  const duel = run.duel;
  const head = date ? `Major Mayhem Daily #${dailyNumber(date)}` : duel ? `Major Mayhem draft duel vs ${duel.name}` : 'Major Mayhem';
  const trophy = pl.key === 'CHAMP' || pl.key === 'DUEL-W' ? '🏆' : pl.key === 'F' ? '🥈' : pl.reached >= 2 ? '🎖️' : '💀';
  const m0 = run.t.matches[0];
  const title = duel && m0 ? `${m0.won ? 'Won' : 'Lost'} ${m0.score[0]}–${m0.score[1]}` : pl.key === 'CHAMP' ? 'Major Champions' : pl.label;
  const path = run.t.matches.map((m) => `${STAGE_SHORT[m.stage]}${m.won ? '🟩' : '🟥'}`).join(' ');
  const lines = [
    `${head} ${trophy} ${title}`,
    path,
    [...mine.map((l) => `${ROLE_SHORT[l.slot]} ${l.player.nick}`), ...(run.coach ? [`Coach ${run.coach}`] : [])].join(' · '),
    `MVP ${star.player.nick}${rating !== undefined ? ` ${rating.toFixed(2)}` : ''}${grade !== null ? ` · Draft ${Math.round(grade * 100)}%` : ''}`,
  ];
  if (url) lines.push(url);
  return lines.join('\n');
}

/** The page's own link, when it's served from a web address (not opened as a local file). */
export const pageUrl = () => (typeof location !== 'undefined' && location.protocol.startsWith('http') ? location.href.split('#')[0] : undefined);

/** Clipboard API where allowed, falling back to a hidden textarea. */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}
