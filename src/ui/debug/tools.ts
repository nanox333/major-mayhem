// Debug-only helpers (#296): a snapshot of the player's saves, a scan of the page for layout problems, and a bug report.
const SNAP = 'mm-debug-snapshot';
const FLAGS = new Set(['mm-debug', 'mm-debug-ratings', 'mm-debug-lite', 'mm-debug-rm', 'mm-debug-clock', SNAP]);
const ownKeys = () => { try { return Object.keys(localStorage).filter((k) => (k.startsWith('major-mayhem') || k.startsWith('mm-')) && !FLAGS.has(k)); } catch { return []; } };

/** Keeps a copy of the real saves the first time the debug tools change anything, so one button can put them back. */
export function snapshotOnce(): boolean {
  try {
    if (localStorage.getItem(SNAP)) return false;
    const data: Record<string, string> = {};
    for (const k of ownKeys()) data[k] = localStorage.getItem(k) ?? '';
    localStorage.setItem(SNAP, JSON.stringify({ at: new Date().toISOString(), data }));
    return true;
  } catch { return false; }
}
export const snapshotInfo = (): { at: string; keys: number } | null => {
  try { const v = JSON.parse(localStorage.getItem(SNAP) ?? 'null'); return v ? { at: String(v.at), keys: Object.keys(v.data ?? {}).length } : null; } catch { return null; }
};
/** Puts the saves back as they were at the snapshot and forgets it. */
export function restoreSnapshot(): boolean {
  try {
    const v = JSON.parse(localStorage.getItem(SNAP) ?? 'null');
    if (!v?.data) return false;
    for (const k of ownKeys()) localStorage.removeItem(k);
    for (const [k, val] of Object.entries(v.data)) localStorage.setItem(k, String(val));
    localStorage.removeItem(SNAP);
    return true;
  } catch { return false; }
}
export const dropSnapshot = () => { try { localStorage.removeItem(SNAP); } catch { /* storage unavailable */ } };

export interface Finding { kind: 'overflow' | 'tap' | 'text'; label: string; detail: string }
const label = (el: Element) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} “${(el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)}”`;

/**
 * Looks for what the phone audit looked for (#250–#263): things wider than the screen, tap targets under 40px and text under 11.5px. Offenders get
 * a `data-dbg-flag` attribute, which the debug styles outline, until the next scan or `clearScan`.
 */
export function scanPage(): Finding[] {
  clearScan();
  const out: Finding[] = [];
  const vw = innerWidth;
  const vis = (el: Element) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  if (document.documentElement.scrollWidth > vw + 1) out.push({ kind: 'overflow', label: 'The page scrolls sideways', detail: `${document.documentElement.scrollWidth}px wide in a ${vw}px window` });
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.dbg, .dbg-preview, [aria-hidden="true"], .sr, footer') || !vis(el)) continue;
    const r = el.getBoundingClientRect();
    const tag = el.tagName;
    const interactive = tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || tag === 'INPUT' || tag === 'SELECT' || el.getAttribute('role') === 'button' || el.getAttribute('role') === 'tab';
    if (r.right > vw + 1 && r.left < vw) { el.setAttribute('data-dbg-flag', 'overflow'); out.push({ kind: 'overflow', label: label(el), detail: `reaches ${Math.round(r.right)}px` }); }
    else if (interactive && (r.width < 40 || r.height < 40)) { el.setAttribute('data-dbg-flag', 'tap'); out.push({ kind: 'tap', label: label(el), detail: `${Math.round(r.width)}×${Math.round(r.height)}px` }); }
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 11.5 && [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim())) { if (!el.hasAttribute('data-dbg-flag')) el.setAttribute('data-dbg-flag', 'text'); out.push({ kind: 'text', label: label(el), detail: `${fs.toFixed(1)}px` }); }
  }
  return out;
}
export const clearScan = () => document.querySelectorAll('[data-dbg-flag]').forEach((el) => el.removeAttribute('data-dbg-flag'));

/** A paste-able description of where the player is: enough to reproduce a bug (the seed and rules reproduce the whole run). */
export function bugReport(run: { seed: string; rules?: number; phase: string; mode: string; step?: string }, scenario?: string): string {
  return JSON.stringify({
    scenario: scenario ?? null, phase: run.phase, step: run.step ?? null, mode: run.mode, seed: run.seed, rules: run.rules ?? null,
    url: location.href, viewport: `${innerWidth}×${innerHeight}`, dpr: devicePixelRatio, cores: navigator.hardwareConcurrency,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, ua: navigator.userAgent, at: new Date().toISOString(),
  }, null, 2);
}
