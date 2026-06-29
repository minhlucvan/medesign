import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Resolve workspace deps to their TypeScript source (not the gitignored, possibly
// stale `dist/`) so the MCP tools exercise the current backend/graph/critic code.
const src = (pkg: string) =>
  fileURLToPath(new URL(`../${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@emdesign/backend': src('backend'),
      '@emdesign/graph': src('graph'),
      '@emdesign/vision-critic': src('vision-critic'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
