import type { StorybookConfig } from '@storybook/react-vite';

/**
 * medesign Studio = Storybook as the front end.
 * Generated components land in `src/generated/**` as CSF stories and render here;
 * captured (reusable) components live in `src/components/**`.
 * The medesign addon panel (chat · capture · visual-diff) is registered via `@medesign/addon`.
 */
const config: StorybookConfig = {
  stories: [
    '../src/components/**/*.stories.@(ts|tsx)',
    '../src/generated/**/*.stories.@(ts|tsx)',
    // The active design system's own primitive showcase.
    '../../../design-systems/*/code/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    '@storybook/addon-essentials',
    '@medesign/addon',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  // `@ds` always resolves to the ACTIVE design system's primitives. Generated and captured
  // components import from `@ds`, so swapping the design system re-skins everything.
  viteFinal: async (vite) => {
    const path = await import('node:path');
    const fs = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const here = path.dirname(fileURLToPath(import.meta.url));
    // Resolve `@ds` to the ACTIVE design system (written by `apply_design_system` → .medesign/active-ds).
    const activeFile = path.resolve(here, '../.medesign/active-ds');
    const active = fs.existsSync(activeFile) ? fs.readFileSync(activeFile, 'utf8').trim() : 'atelier';
    vite.resolve = vite.resolve ?? {};
    vite.resolve.alias = {
      ...(vite.resolve.alias ?? {}),
      '@ds': path.resolve(here, `../../../design-systems/${active}/code`),
    };
    return vite;
  },
};

export default config;
