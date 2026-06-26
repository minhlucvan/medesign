/**
 * Framework registry — maps a framework id to its concrete workspace provider (which supplies the
 * Storybook scaffold for `init`) and the server adapter id. Detection maps a Storybook framework
 * package (from an existing `.storybook/main.*`) to a medesign framework id for `attach`.
 */
export interface FrameworkEntry {
  id: string;
  /** npm package of the concrete workspace (its `templates/storybook` is laid down by init). */
  providerPackage: string;
  /** Monorepo-relative path to the provider's storybook templates (dev fallback when not installed). */
  providerTemplatesPath: string;
  implemented: boolean;
}

export const FRAMEWORKS: Record<string, FrameworkEntry> = {
  'react-tailwind': {
    id: 'react-tailwind',
    providerPackage: '@medesign/workspace-react',
    providerTemplatesPath: '../../workspace-react/templates/storybook',
    implemented: true,
  },
  vue: { id: 'vue', providerPackage: '@medesign/workspace-vue', providerTemplatesPath: '../../workspace-vue/templates/storybook', implemented: false },
  svelte: { id: 'svelte', providerPackage: '@medesign/workspace-svelte', providerTemplatesPath: '../../workspace-svelte/templates/storybook', implemented: false },
  'web-components': { id: 'web-components', providerPackage: '@medesign/workspace-web-components', providerTemplatesPath: '../../workspace-web-components/templates/storybook', implemented: false },
  angular: { id: 'angular', providerPackage: '@medesign/workspace-angular', providerTemplatesPath: '../../workspace-angular/templates/storybook', implemented: false },
};

/** Map a Storybook framework package (in .storybook/main) → a medesign framework id. */
export function detectFramework(storybookFramework: string): string {
  if (/react/.test(storybookFramework)) return 'react-tailwind';
  if (/vue/.test(storybookFramework)) return 'vue';
  if (/svelte/.test(storybookFramework)) return 'svelte';
  if (/web-components|html/.test(storybookFramework)) return 'web-components';
  if (/angular/.test(storybookFramework)) return 'angular';
  return 'react-tailwind';
}

export function listFrameworks(): string[] {
  return Object.keys(FRAMEWORKS);
}
