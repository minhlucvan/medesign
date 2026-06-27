/**
 * Source-level rule: detect !important modifier usage in Tailwind classes.
 *
 * The `!` prefix (e.g. !m-0, !flex, !hidden) is an escape hatch that
 * indicates specificity issues in the component's CSS architecture.
 * This rule flags it as an advisory to restructure rather than override.
 */

import type { Rule, RuleContext } from '@emdesign/dsr';

/** Regex to capture className attribute values. */
const CLASS_NAME_RE = /className\s*=\s*(?:{?["'`]([^"'`{}]*)["'`]}|{([^}]+)})/g;

/** Regex to detect !important modifier prefix. */
const IMPORTANT_MODIFIER_RE = /!-?[a-z][\w-]*/g;

export const importantModifierRule: Rule = {
  id: 'tailwind-important-modifier',
  severity: 'P2',
  scope: 'component',
  evaluate(ctx: RuleContext) {
    const findings: Array<Omit<import('@emdesign/dsr').Diagnostic, 'scope'>> = [];
    if (!ctx.source) return findings;

    let match: RegExpExecArray | null;
    CLASS_NAME_RE.lastIndex = 0;

    while ((match = CLASS_NAME_RE.exec(ctx.source)) !== null) {
      const classStr = match[1] ?? match[2] ?? '';
      if (!classStr) continue;

      let impMatch: RegExpExecArray | null;
      IMPORTANT_MODIFIER_RE.lastIndex = 0;

      while ((impMatch = IMPORTANT_MODIFIER_RE.exec(classStr)) !== null) {
        const [token] = impMatch;

        findings.push({
          ruleId: 'tailwind-important-modifier',
          severity: 'P2',
          message: `!important modifier "${token}" indicates specificity issues — avoid overriding Tailwind utilities with !important`,
          fix: `Remove "${token}" and restructure the component. Use higher specificity selectors or component composition instead of !important.`,
          snippet: token,
        });
      }
    }

    return findings;
  },
};
