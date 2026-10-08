/// <reference types="vite/client" />

/** Hosting config baked in at build time from site.config.json (see scripts/site-plugin.ts). */
declare const __SITE__: {
  url: string;
  analytics: { provider: string; siteId: string; host: string };
  sentryLoader: string;
  support: { url: string; label: string };
  ads: { enabled: boolean; imageUrl: string; linkUrl: string; alt: string; contactUrl: string };
};
