import type { StorybookConfig } from '@storybook/react-vite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/** emdesign React/Tailwind workspace — Storybook host. `@emdesign/addon` adds the design panel. */
const here = path.dirname(fileURLToPath(import.meta.url));
const activeFile = path.resolve(here, '../.emdesign/active-ds');
const activeDs = fs.existsSync(activeFile) ? fs.readFileSync(activeFile, 'utf8').trim() : 'atelier';

const config: StorybookConfig = {
  stories: [
    '../src/components/**/*.stories.@(ts|tsx)',
    '../src/generated/**/*.stories.@(ts|tsx)',
    '../design-systems/*/code/**/*.stories.@(ts|tsx)',
  ],
  addons: ['@storybook/addon-essentials', '@emdesign/addon'],
  framework: { name: '@storybook/react-vite', options: {} },
  viteFinal: async (vite) => {
    vite.resolve = vite.resolve ?? {};
    vite.resolve.alias = {
      ...(vite.resolve.alias ?? {}),
      '@ds': path.resolve(here, `../design-systems/${activeDs}/code`),
    };
    vite.server = vite.server ?? {};
    vite.server.watch = vite.server.watch ?? {};
    const existing = Array.isArray(vite.server.watch.ignored) ? vite.server.watch.ignored : [];
    if (!existing.includes('**/design-systems/**')) existing.push('**/design-systems/**');
    vite.server.watch.ignored = existing;
    return vite;
  },
};
export default config;
