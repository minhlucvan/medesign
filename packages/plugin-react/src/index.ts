import type { MedesignPlugin, PluginDesignSystem, DesignReviewRule } from '@medesign/plugin-api';

/** React renderer review rules. */
const hasStories: DesignReviewRule = {
  id: 'react-stories', category: 'react', title: 'Primitives have Storybook stories', severity: 'P2', target: '>= 1 story',
  check: ({ stats }) => { const n = stats['node:story'] ?? 0; return { pass: n >= 1, detail: `${n} stories`, fix: 'Add a Showcase.stories.tsx (and per-primitive stories) so the renderer is visually testable.' }; },
};
const exposesVariants: DesignReviewRule = {
  id: 'react-variants', category: 'react', title: 'Primitives expose variants/states', severity: 'P2', target: 'variants present',
  check: ({ stats }) => { const v = (stats['node:variant'] ?? 0) + (stats['node:state'] ?? 0); return { pass: v >= 1, detail: `${v} variant/state nodes`, fix: 'Give interactive primitives (Button, Badge) typed variants + interaction states.' }; },
};

/** The React renderer (framework plugin) — TypeScript .tsx + CSF stories, code-parseable. */
export const reactPlugin: MedesignPlugin = {
  id: 'react',
  kind: 'framework',
  fileExt: '.tsx',
  storyExt: '.stories.tsx',
  primitiveImport: '@ds',
  parsesCode: true,

  codegenInstructions(ds: PluginDesignSystem): string {
    return [
      'STACK: React (TypeScript .tsx).',
      `- Compose the design-system primitives, imported from "@ds": ${ds.primitives.join(', ') || '(none)'}.`,
      '- Headings use the display font; obey the DESIGN.md Anti-patterns. No emoji icons, invented metrics, or filler copy.',
      '- Emit a CSF story (title "Generated/<Name>", a "Default" export) so it renders in Storybook.',
    ].join('\n');
  },

  storyTemplate(name: string): string {
    return [
      `import type { Meta, StoryObj } from '@storybook/react';`,
      `import { ${name} } from './${name}';`,
      ``,
      `const meta: Meta<typeof ${name}> = { title: 'Generated/${name}', component: ${name} };`,
      `export default meta;`,
      `export const Default: StoryObj<typeof ${name}> = {};`,
      ``,
    ].join('\n');
  },

  doctorRules: () => [hasStories, exposesVariants],
};

export default reactPlugin;
