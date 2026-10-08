// Vite plugin for everything that depends on where the game is hosted: link-preview tags, icons, the web app
// manifest, robots.txt and sitemap.xml. All of it comes from site.config.json, so moving to a custom domain is a
// one-line change there (see DOMAIN.md). Environment variables override the file, which suits hosts like
// Cloudflare Pages: SITE_URL, ANALYTICS_PROVIDER, ANALYTICS_SITE_ID, ANALYTICS_HOST, SENTRY_LOADER, SUPPORT_URL, ADS_ENABLED (1 or true).
import fs from 'node:fs';
import type { HtmlTagDescriptor, Plugin } from 'vite';

export interface SiteConfig {
  url: string; name: string; shortName: string; title: string; description: string; themeColor: string; accent: string;
  analytics: { provider: string; siteId: string; host: string };
  sentryLoader: string;
  /** Optional "support the project" link (Ko-fi, GitHub Sponsors). Empty url hides it. */
  support: { url: string; label: string };
  /** The ad slot is off unless enabled. With no sponsor creative it shows a "your ad here" placeholder. */
  ads: { enabled: boolean; imageUrl: string; linkUrl: string; alt: string };
}

export function loadSite(env = process.env): SiteConfig {
  const site: SiteConfig = JSON.parse(fs.readFileSync('site.config.json', 'utf8'));
  const url = env.SITE_URL || site.url;
  return {
    ...site,
    url: url.endsWith('/') ? url : `${url}/`,
    analytics: {
      provider: env.ANALYTICS_PROVIDER ?? site.analytics.provider,
      siteId: env.ANALYTICS_SITE_ID ?? site.analytics.siteId,
      host: env.ANALYTICS_HOST ?? site.analytics.host,
    },
    sentryLoader: env.SENTRY_LOADER ?? site.sentryLoader,
    support: { ...site.support, url: env.SUPPORT_URL ?? site.support?.url ?? '' },
    ads: { ...site.ads, enabled: env.ADS_ENABLED !== undefined ? /^(1|true)$/i.test(env.ADS_ENABLED) : site.ads.enabled },
  };
}

/** The part of the config the game itself reads at runtime (analytics, error reporting, support link and ad slot). */
export const runtimeSite = (s: SiteConfig) => ({ url: s.url, analytics: s.analytics, sentryLoader: s.sentryLoader, support: s.support, ads: s.ads });

export function sitePlugin(site = loadSite()): Plugin {
  const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({ tag: 'meta', attrs, injectTo: 'head' });
  const link = (attrs: Record<string, string>): HtmlTagDescriptor => ({ tag: 'link', attrs, injectTo: 'head' });
  const image = `${site.url}og.png`;
  return {
    name: 'major-mayhem-site',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => ({
        html: html.replace(/<title>.*?<\/title>/, `<title>${site.title}</title>`),
        tags: [
          meta({ name: 'description', content: site.description }),
          meta({ name: 'theme-color', content: site.themeColor }),
          link({ rel: 'canonical', href: site.url }),
          // Relative icon paths keep working under a sub-path (GitHub Pages) and on a custom domain.
          link({ rel: 'icon', href: 'favicon.svg', type: 'image/svg+xml' }),
          link({ rel: 'icon', href: 'favicon-32.png', type: 'image/png', sizes: '32x32' }),
          link({ rel: 'apple-touch-icon', href: 'apple-touch-icon.png' }),
          link({ rel: 'manifest', href: 'manifest.webmanifest' }),
          // Open Graph (Discord, WhatsApp, Facebook, Reddit, Slack) and X. Preview URLs must be absolute.
          meta({ property: 'og:type', content: 'website' }),
          meta({ property: 'og:site_name', content: site.name }),
          meta({ property: 'og:title', content: site.title }),
          meta({ property: 'og:description', content: site.description }),
          meta({ property: 'og:url', content: site.url }),
          meta({ property: 'og:image', content: image }),
          meta({ property: 'og:image:width', content: '1200' }),
          meta({ property: 'og:image:height', content: '630' }),
          meta({ property: 'og:image:alt', content: `${site.name}: draft five Counter-Strike pros, one per role, and win the Major` }),
          meta({ name: 'twitter:card', content: 'summary_large_image' }),
          meta({ name: 'twitter:title', content: site.title }),
          meta({ name: 'twitter:description', content: site.description }),
          meta({ name: 'twitter:image', content: image }),
        ],
      }),
    },
    generateBundle() {
      const emit = (fileName: string, source: string) => this.emitFile({ type: 'asset', fileName, source });
      emit('manifest.webmanifest', JSON.stringify({
        name: site.name, short_name: site.shortName, description: site.description,
        start_url: './', scope: './', display: 'standalone', orientation: 'any',
        background_color: site.themeColor, theme_color: site.themeColor,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      }, null, 2));
      // robots.txt only takes effect at the root of a domain; on a GitHub Pages sub-path it's harmless.
      emit('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${site.url}sitemap.xml\n`);
      emit('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${site.url}</loc><changefreq>daily</changefreq></url>\n</urlset>\n`);
    },
  };
}
