/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Everything, React included, is inlined into one self-contained dist/index.html that works offline
// (only the Google Fonts stylesheet is external, and the game falls back to system fonts without it).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  test: { include: ['src/**/*.test.ts'] },
});
