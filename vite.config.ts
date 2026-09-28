import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// React and ReactDOM load from cdnjs (see index.html) and are treated as globals,
// so the built game is one small self-contained HTML file.
export default defineConfig({
  plugins: [react({ jsxRuntime: 'classic' }), viteSingleFile()],
  build: {
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client'],
      output: { format: 'iife', globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' } },
    },
  },
});
