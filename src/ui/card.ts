// The shareable result card: a 1080×1350 PNG drawn in the browser from the finished run (placement, path through
// the bracket, lineup with event ratings, MVP, draft grade). No server involved; photos and logos are already
// embedded as data URLs, so the canvas never gets tainted.
import { ROLE_LABEL, Roster, Player } from '../data/rosters';
import * as G from '../game/logic';
import { Run, dailyDate, dailyNumber, squadOf } from '../game/state';

const W = 1080, H = 1350;
// The same palette as the page (#100): navy surfaces and the orange accent.
const C = { bg: '#0a0f1a', panel: '#101726', line: '#243049', text: '#e9eef6', cream: '#f1e5c8', muted: '#8f9bb1', accent: '#ff8a1f', ct: '#5e98d9', win: '#4fb34f', loss: '#d9534f', silver: '#d4d7da' };
const F = { logo: '"Saira Stencil One", Impact, sans-serif', head: '"Saira Condensed", "Arial Narrow", sans-serif', body: 'Rajdhani, "Arial Narrow", system-ui, sans-serif' };
const STAGE_SHORT: Record<G.StageKey, string> = { QUAL: 'Q', QF: 'QF', SF: 'SF', F: 'F', DUEL: 'BO3' };

const loadImage = (src?: string) => new Promise<HTMLImageElement | null>((resolve) => {
  if (!src) return resolve(null);
  const i = new Image();
  i.onload = () => resolve(i); i.onerror = () => resolve(null);
  i.src = src;
});

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Sets the font, shrinking it until `text` fits in `max` pixels. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, max: number) {
  do ctx.font = `${weight} ${size}px ${family}`; while (ctx.measureText(text).width > max && (size -= 2) > 12);
}

function spaced(ctx: CanvasRenderingContext2D, px: number) {
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
}

async function avatar(ctx: CanvasRenderingContext2D, player: Player, roster: Roster, cx: number, cy: number, r: number, ring: string) {
  const img = await loadImage(player.portrait);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  if (img) ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  else {
    ctx.fillStyle = roster.color; ctx.globalAlpha = 0.45; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); ctx.globalAlpha = 1;
    ctx.fillStyle = C.cream; ctx.font = `700 ${Math.round(r * 0.8)}px ${F.head}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(player.nick.slice(0, 2).toUpperCase(), cx, cy + 2);
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = ring; ctx.stroke();
}

export async function drawResultCard(run: Run, host: string): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts) {
    await Promise.all([`400 76px ${F.logo}`, `700 40px ${F.head}`, `700 30px ${F.body}`].map((f) => document.fonts.load(f).catch(() => null)));
  }
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  const pl = G.placement(run.t);
  const champ = pl.key === 'CHAMP';
  const mine = G.lineupFromPicks(run.picks);
  const star = G.mvp(run.t, squadOf(run));
  const ratings = G.seriesRatings(run.t.matches.flatMap((m) => m.maps));
  const { grade } = G.draftReview(run.picks, !!run.opts?.hard);
  const date = dailyDate(run);
  const tone = champ ? C.accent : pl.key === 'F' ? C.silver : C.cream;

  // background
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 0, 40, W / 2, 0, 820);
  glow.addColorStop(0, champ ? 'rgba(255,138,31,.32)' : 'rgba(255,138,31,.14)'); glow.addColorStop(1, 'rgba(255,138,31,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // brand
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.cream; ctx.font = `400 76px ${F.logo}`; spaced(ctx, 2);
  ctx.fillText('MAJOR MAYHEM', W / 2, 116);
  const bar = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
  bar.addColorStop(0, 'rgba(255,138,31,0)'); bar.addColorStop(0.5, C.accent); bar.addColorStop(1, 'rgba(255,138,31,0)');
  ctx.fillStyle = bar; ctx.fillRect(W / 2 - 200, 138, 400, 5);
  ctx.fillStyle = C.accent; ctx.font = `700 30px ${F.head}`; spaced(ctx, 6);
  ctx.fillText(date ? `DAILY #${dailyNumber(date)}` : 'FREE PLAY', W / 2, 196);

  // placement
  const label = (champ ? 'Major Champions' : pl.label).toUpperCase();
  spaced(ctx, 2); fit(ctx, label, 700, 96, F.head, 960);
  ctx.fillStyle = tone; ctx.fillText(label, W / 2, 300);

  // path through the bracket
  spaced(ctx, 1); ctx.font = `700 30px ${F.head}`;
  const pills = run.t.matches.map((m) => ({ text: `${STAGE_SHORT[m.stage]} ${m.score[0]}–${m.score[1]}`, won: m.won }));
  const widths = pills.map((p) => ctx.measureText(p.text).width + 40);
  const gap = 14, total = widths.reduce((a, b) => a + b, 0) + gap * (pills.length - 1);
  let x = (W - total) / 2;
  pills.forEach((p, i) => {
    rounded(ctx, x, 334, widths[i], 54, 8);
    ctx.fillStyle = p.won ? 'rgba(79,179,79,.18)' : 'rgba(217,83,79,.18)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = p.won ? C.win : C.loss; ctx.stroke();
    ctx.fillStyle = p.won ? '#9be09b' : '#f0a19e'; ctx.textAlign = 'center';
    ctx.fillText(p.text, x + widths[i] / 2, 372);
    x += widths[i] + gap;
  });

  // lineup
  const top = 430, rowH = 128;
  for (const [i, l] of mine.entries()) {
    const y = top + i * (rowH + 10);
    const isMvp = l.player.id === star.player.id;
    rounded(ctx, 60, y, W - 120, rowH, 10);
    ctx.fillStyle = isMvp ? 'rgba(255,138,31,.12)' : C.panel; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = isMvp ? C.accent : C.line; ctx.stroke();
    ctx.fillStyle = isMvp ? C.accent : C.ct; ctx.fillRect(60, y, 6, rowH);
    await avatar(ctx, l.player, l.roster, 150, y + rowH / 2, 50, isMvp ? C.accent : C.line);

    ctx.textAlign = 'left';
    ctx.fillStyle = C.accent; ctx.font = `700 24px ${F.head}`; spaced(ctx, 3);
    ctx.fillText(ROLE_LABEL[l.slot].toUpperCase(), 228, y + 36);
    spaced(ctx, 0); fit(ctx, l.player.nick, 700, 50, F.head, 440);
    ctx.fillStyle = C.text; ctx.fillText(l.player.nick, 228, y + 82);
    const nickW = ctx.measureText(l.player.nick).width;
    if (isMvp) {
      ctx.font = `700 24px ${F.head}`; spaced(ctx, 2);
      const tw = ctx.measureText('★ MVP').width + 20;
      rounded(ctx, 228 + nickW + 16, y + 52, tw, 34, 6); ctx.fillStyle = C.accent; ctx.fill();
      ctx.fillStyle = C.bg; ctx.fillText('★ MVP', 228 + nickW + 26, y + 78);
      spaced(ctx, 0);
    }
    const logo = await loadImage(l.roster.logo);
    let tx = 228;
    if (logo) { ctx.drawImage(logo, tx, y + 94, 24, 24); tx += 32; }
    ctx.fillStyle = C.muted; ctx.font = `700 26px ${F.body}`;
    ctx.fillText(`${l.roster.org} ${l.roster.year}`, tx, y + 115);

    const st = ratings[l.player.id];
    if (st) {
      ctx.textAlign = 'right';
      ctx.fillStyle = C.muted; ctx.font = `700 26px ${F.body}`;
      ctx.fillText(`${st.k}–${st.d}`, W - 90, y + 48);
      ctx.fillStyle = st.rating >= 1.1 ? C.win : st.rating < 0.9 ? C.loss : C.text;
      ctx.font = `700 54px ${F.head}`;
      ctx.fillText(st.rating.toFixed(2), W - 90, y + 100);
    }
  }

  // coach and bench
  ctx.textAlign = 'center';
  const bench = run.bench ? G.rosterById.get(run.bench.rosterId)?.players.find((p) => p.id === run.bench!.playerId) : undefined;
  const staff = [run.coach ? `Coach ${run.coach}` : '', bench ? `Bench ${bench.nick}` : ''].filter(Boolean).join('   ·   ');
  if (staff) { ctx.fillStyle = C.muted; spaced(ctx, 2); ctx.font = `700 28px ${F.head}`; ctx.fillText(staff.toUpperCase(), W / 2, 1152); }

  // footer
  const mvpRating = ratings[star.player.id]?.rating;
  const foot = [`MVP ${star.player.nick}${mvpRating !== undefined ? ` ${mvpRating.toFixed(2)}` : ''}`, grade !== null ? `DRAFT ${Math.round(grade * 100)}%` : ''].filter(Boolean).join('   ·   ');
  ctx.fillStyle = C.accent; spaced(ctx, 3); fit(ctx, foot, 700, 36, F.head, 960);
  ctx.fillText(foot, W / 2, 1210);
  ctx.fillStyle = C.muted; spaced(ctx, 1); ctx.font = `700 30px ${F.body}`;
  ctx.fillText(host, W / 2, 1268);
  ctx.fillStyle = C.accent; ctx.fillRect(0, H - 10, W, 10);

  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas export failed'))), 'image/png'));
}

export const cardFileName = (run: Run) => {
  const date = dailyDate(run);
  return date ? `major-mayhem-daily-${dailyNumber(date)}.png` : 'major-mayhem-result.png';
};

/** The game's public address without the scheme, for the card footer (the real site even when opened as a file). */
export const siteHost = () => __SITE__.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
