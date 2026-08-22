import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

/** Where API requests go in development (see apps/api/.env -> PORT). */
const API_TARGET = process.env['VITE_API_TARGET'] ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  /**
   * `@gameshelf/contracts` is a link to a sibling package in the monorepo, not an
   * immutable dependency from a registry. Without excluding it from pre-bundling,
   * Vite would freeze its build at startup and contract changes would not reach
   * the browser until the server restarted.
   *
   * File watching does not have to be configured: Vite resolves the symlink to
   * the real `packages/contracts/dist` path, which does not lie under
   * `node_modules` and therefore falls under ordinary change watching.
   */
  optimizeDeps: {
    exclude: ['@gameshelf/contracts'],
  },
  server: {
    port: 5173,
    /**
     * The proxy keeps development on a single origin, so the same httpOnly cookie
     * with the refresh token behaves exactly as it does in production, where one
     * process serves both the API and the frontend.
     */
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    /**
     * `hidden` maps are generated but the bundle does not reference them - so they
     * are not sent to anyone who merely opens the page. The whole `dist` is
     * copied to production, though, so with `sourcemap: true` the entire frontend
     * source code was publicly downloadable (and the map was five times bigger
     * than the bundle itself). For tracking an error down from a stack trace the
     * file is still on disk.
     */
    sourcemap: 'hidden',
  },
});
