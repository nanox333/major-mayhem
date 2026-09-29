/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { loadSite, runtimeSite, sitePlugin } from './scripts/site-plugin';

// Everything, React and the fonts included, is inlined into one self-contained dist/index.html that works offline.
// Icons, the link-preview image, the manifest, robots.txt and sitemap.xml sit next to it (see scripts/site-plugin.ts).
const site = loadSite();
export default defineConfig({
  plugins: [react(), viteSingleFile(), sitePlugin(site)],
  define: { __SITE__: JSON.stringify(runtimeSite(site)) },
  test: { include: ['src/**/*.test.ts'] },
});
