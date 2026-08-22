import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/**
 * Tests of the frontend's pure logic.
 *
 * Vitest, because it shares the resolver with Vite - the `~` alias and the
 * contracts package therefore work exactly as they do in the application and do
 * not have to be configured a second time.
 *
 * The environment is `node`: what is tested is the filter translation, the form
 * resolver, formatting and pagination - things that do not need a DOM.
 */
export default defineConfig({
  resolve: {
    alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
