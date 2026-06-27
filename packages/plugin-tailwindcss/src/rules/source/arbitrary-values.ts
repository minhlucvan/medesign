/**
 * Source-level rule: detect arbitrary value overuse where DS tokens exist.
 *
 * Flags Tailwind arbitrary value expressions (w-[…], p-[…], m-[…], etc.)
 * when a design-system token alternative exists for the same CSS property.
 *
 * Skips CSS variable references (var(--...)) which are the preferred pattern
 * for non-utility-mapped tokens like custom shadows and duration.
 */

import type { Rule, RuleContext } from '@emdesign/dsr';
import { isTokenMappedProperty } from '../../resolve-token.js';

/** Regex to capture className attribute values. */
const CLASS_NAME_RE = /className\s*=\s*(?:{?["'`]([^"'`{}]*)["'`]}|{([^}]+)})/g;

/** Regex to match arbitrary value tokens: prop-[value]. */
const ARBITRARY_VALUE_RE = /\b([a-z-]+(?::[a-z-]+)?)-\[([^\]]+)\]/g;

export const arbitraryValuesRule: Rule = {
  id: 'tailwind-arbitrary-values',
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

      let arbMatch: RegExpExecArray | null;
      ARBITRARY_VALUE_RE.lastIndex = 0;

      while ((arbMatch = ARBITRARY_VALUE_RE.exec(classStr)) !== null) {
        const [fullToken, prefix, value] = arbMatch;

        // Skip CSS variable references
        if (value.startsWith('var(')) continue;

        // Only flag token-mapped properties
        const baseProp = prefix.split(':').pop() ?? prefix;
        if (!isTokenMappedProperty(baseProp)) continue;

        // Strip responsive prefix for cleaner messages
        const displayPrefix = prefix.includes(':') ? prefix.split(':').pop()! : prefix;

        findings.push({
          ruleId: 'tailwind-arbitrary-values',
          severity: 'P2',
          message: `Arbitrary value "${value}" in "${fullToken}" — use a token-bound utility if available`,
          fix: `Replace "${fullToken}" with a token-bound class. For ${displayPrefix}, use the matching --${displayPrefix === 'bg' ? 'color-surface' : displayPrefix === 'text' ? 'color-text' : displayPrefix === 'rounded' ? 'radius' : displayPrefix === 'shadow' ? 'shadow-raised' : `color-${displayPrefix}`} token.`,
          snippet: fullToken,
        });
      }
    }

    return findings;
  },
};
