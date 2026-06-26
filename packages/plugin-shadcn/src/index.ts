import type { MedesignPlugin, Rule } from '@medesign/plugin-api';

const CATALOG = ['Button', 'Card', 'Input', 'Badge', 'Dialog', 'Tabs', 'Tooltip', 'Select'];

/** A component-scope rule registered via the dsr RuleEngine — proves the plugin lint seam works. */
const noInlineStyle: Rule = {
  id: 'shadcn-no-inline-style',
  severity: 'P2',
  scope: 'component',
  framework: 'shadcn',
  evaluate({ source }) {
    return /style=\{\{/.test(source ?? '')
      ? [{ ruleId: 'shadcn-no-inline-style', severity: 'P2', message: 'Inline style object found; prefer Tailwind classes / cn() with shadcn primitives.', fix: 'Move styling to className via cn().' }]
      : [];
  },
};

/**
 * shadcn/ui (library plugin, thin). Adds component-catalog codegen guidance + a lint rule on top of
 * the framework + styling plugins — demonstrating a stacked library layer (react + tailwind + shadcn).
 */
export const shadcnPlugin: MedesignPlugin = {
  id: 'shadcn',
  kind: 'library',
  codegenInstructions(): string {
    return [
      'LIBRARY: shadcn/ui.',
      `- Prefer composing the shadcn primitives (${CATALOG.join(', ')}) over hand-rolled elements.`,
      '- Merge classes with the cn() utility; respect each primitive\'s variants/sizes and data-slot attributes.',
      '- Keep shadcn primitives on-system: pass token-role Tailwind classes, never raw colors.',
    ].join('\n');
  },
  lintRules() {
    return [noInlineStyle];
  },
};

export default shadcnPlugin;
