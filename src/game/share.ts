// Spoiler-light result text for sharing, in the style of daily puzzle games.
import * as G from './logic';
import { Run, dailyDate, dailyNumber, squadOf } from './state';

const STAGE_SHORT: Record<G.StageKey, string> = { QUAL: 'Q', QF: 'QF', SF: 'SF', F: 'F', DUEL: 'BO3' };

/** `practice` marks a replay of a daily that was already played: it is shared as practice and never as a scored attempt (#162). */
export function shareText(run: Run, url?: string, practice = false): string {
  const pl = G.placement(run.t);
  const star = G.mvp(run.t, squadOf(run));
  const rating = G.seriesRatings(run.t.matches.flatMap((m) => m.maps), 'mine')[star.player.id]?.rating;
  const { grade } = G.draftReview(run.picks, !!run.opts?.hard);
  const date = dailyDate(run);
  const duel = run.duel;
  const head = date ? `Major Mayhem Daily #${dailyNumber(date)}${practice ? ' (practice)' : ''}` : duel ? `Major Mayhem draft duel vs ${duel.name}` : 'Major Mayhem';
  const trophy = pl.key === 'CHAMP' || pl.key === 'DUEL-W' ? '🏆' : pl.key === 'F' ? '🥈' : pl.reached >= 2 ? '🎖️' : '💀';
  const m0 = run.t.matches[0];
  const title = duel && m0 ? `${m0.won ? 'Won' : 'Lost'} ${m0.score[0]}–${m0.score[1]}` : pl.key === 'CHAMP' ? 'Major Champions' : pl.label;
  const box = (won: boolean) => (won ? '🟩' : '🟥');
  const swiss = run.t.matches.filter((m) => m.stage === 'QUAL').map((m) => box(m.won)).join('');
  const knockout = run.t.matches.filter((m) => m.stage !== 'QUAL').map((m) => `${STAGE_SHORT[m.stage]} ${box(m.won)}`).join(' ');
  // One target per pick that had alternatives: hit when it was the strongest choice in its case (#73).
  const scored = G.draftReview(run.picks, !!run.opts?.hard).rounds.filter((r) => r.best);
  const hits = scored.filter((r) => r.value >= r.best!.value - 1e-9).length;
  const lines = [
    `${head} ${trophy} ${title}${run.opts?.hard ? ' 💀' : ''}`,
    ...(swiss ? [`Swiss ${swiss}`] : []),
    ...(knockout ? [knockout] : []),
    ...(scored.length ? [`Draft ${scored.map((r) => (r.value >= r.best!.value - 1e-9 ? '🎯' : '⬜')).join('')}  (${hits}/${scored.length} best picks)`] : []),
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
