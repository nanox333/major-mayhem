// Privacy-friendly analytics and error reporting. Off until site.config.json names a provider and a site ID,
// so a plain build sends nothing anywhere. Supported providers, all cookieless:
//   plausible  — pageviews + custom events (siteId = your domain in Plausible; host = self-hosted URL, optional)
//   umami      — pageviews + custom events (siteId = the website ID; host = self-hosted URL, optional)
//   cloudflare — pageviews only (siteId = the Web Analytics beacon token); custom events are dropped
// Errors go to the same provider as an `error` event, and to Sentry as well if `sentryLoader` is set
// (the project's Loader Script URL from Sentry's settings).
// Nothing is sent from local files, localhost, or browsers asking not to be tracked.

export type Props = Record<string, string | number | boolean>;
type Provider = 'plausible' | 'umami' | 'cloudflare';

declare global {
  interface Window {
    plausible?: ((event: string, opts?: { props?: Props }) => void) & { q?: unknown[] };
    umami?: { track: (event: string, data?: Props) => void };
    Sentry?: { captureException: (e: unknown, ctx?: unknown) => void };
  }
}

const cfg = typeof __SITE__ !== 'undefined' ? __SITE__ : { url: '', analytics: { provider: '', siteId: '', host: '' }, sentryLoader: '' };
let provider: Provider | null = null;
const queue: [string, Props][] = [];

const allowed = () =>
  typeof window !== 'undefined' && location.protocol.startsWith('http') && !/^(localhost|127\.|\[::1\])/.test(location.hostname)
  && navigator.doNotTrack !== '1';

function script(src: string, attrs: Record<string, string>, onload?: () => void) {
  const s = document.createElement('script');
  s.src = src; s.defer = true;
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  if (onload) s.onload = onload;
  document.head.appendChild(s);
}

const host = (fallback: string) => (cfg.analytics.host || fallback).replace(/\/$/, '');

/** Loads the configured provider and starts reporting errors. Safe to call when nothing is configured. */
export function initAnalytics() {
  if (!allowed()) return;
  const { provider: p, siteId } = cfg.analytics;
  if (siteId && (p === 'plausible' || p === 'umami' || p === 'cloudflare')) {
    provider = p;
    if (p === 'plausible') {
      // Plausible's own queue holds events until the script arrives.
      window.plausible = window.plausible || Object.assign((...a: unknown[]) => { (window.plausible!.q ||= []).push(a); }, {});
      script(`${host('https://plausible.io')}/js/script.js`, { 'data-domain': siteId });
    } else if (p === 'umami') {
      script(`${host('https://cloud.umami.is')}/script.js`, { 'data-website-id': siteId }, flush);
    } else {
      script('https://static.cloudflareinsights.com/beacon.min.js', { 'data-cf-beacon': JSON.stringify({ token: siteId }) });
    }
  }
  if (cfg.sentryLoader) script(cfg.sentryLoader, { crossorigin: 'anonymous' });
  window.addEventListener('error', (e) => reportError(e.error ?? e.message, 'window', e.filename ? `${e.filename.split('/').pop()}:${e.lineno}` : undefined));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'promise'));
}

function flush() {
  while (queue.length && window.umami) { const [e, p] = queue.shift()!; window.umami.track(e, p); }
}

/** Sends a custom event. A no-op when analytics is off. */
export function track(event: string, props: Props = {}) {
  if (!provider) return;
  if (provider === 'plausible') window.plausible?.(event, { props });
  else if (provider === 'umami') { queue.push([event, props]); flush(); }
}

const seen = new Set<string>();
/**
 * Reports a crash: as an `error` event to the analytics provider (at most five distinct errors per page load)
 * and to Sentry when it's loaded. `where` says which part of the game it came from.
 */
export function reportError(err: unknown, where: string, at?: string) {
  const message = (err instanceof Error ? `${err.name}: ${err.message}` : String(err)).slice(0, 180);
  if (window.Sentry && err instanceof Error) window.Sentry.captureException(err, { tags: { where } });
  if (seen.has(message) || seen.size >= 5) return;
  seen.add(message);
  const stack = err instanceof Error && err.stack ? err.stack.split('\n').slice(1, 3).map((l) => l.trim()).join(' | ').slice(0, 180) : '';
  track('error', { message, where, ...(at ? { at } : {}), ...(stack ? { stack } : {}) });
}
