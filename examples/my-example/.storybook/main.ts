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
      // `@ds` → the ACTIVE design system's primitives (set by `emdesign use <id>` → .emdesign/active-ds).
      '@ds': path.resolve(here, `../design-systems/${activeDs}/code`),
    };
    return vite;
  },
};
export default config;
