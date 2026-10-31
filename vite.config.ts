import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` -> normal multi-file build in dist/ (served by server/index.mjs)
// `npm run build:single` -> one self-contained HTML file in dist-single/ (easy to share/open)
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  base: './',
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 4000,
  },
  server: {
    proxy: { '/api': 'http://localhost:8787' },
  },
  test: {
    environment: 'node',
  },
}));
