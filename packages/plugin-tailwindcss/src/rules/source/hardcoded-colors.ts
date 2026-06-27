/**
 * Source-level rule: detect hardcoded CSS colors in Tailwind class strings.
 *
 * Flags raw hex colors (#xxx, #xxxxxx), rgb()/rgba() functions, and named
 * CSS colors used as arbitrary values in class strings (e.g. text-[#333],
 * bg-[#ff0000], border-[red]).
 *
 * Skips CSS variable references (var(--...)) which are valid DS references.
 */

import type { Rule, RuleContext } from '@emdesign/dsr';

// Named CSS colors that should use tokens instead
const NAMED_CSS_COLORS = new Set([
  'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown',
  'black', 'white', 'gray', 'grey', 'navy', 'teal', 'cyan', 'magenta',
  'lime', 'olive', 'maroon', 'violet', 'indigo', 'coral', 'salmon',
  'gold', 'silver', 'beige', 'ivory', 'tan', 'khaki', 'plum', 'orchid',
]);

/** Regex to capture className attribute values in .tsx source. */
const CLASS_NAME_RE = /className\s*=\s*(?:{?["'`]([^"'`{}]*)["'`]}|{([^}]+)})/g;

/** Regex to detect arbitrary values containing hex colors. */
const HEX_IN_ARBITRARY = /\[(#[\da-f]{3,8})\]/i;

/** Regex to detect arbitrary values containing rgb/rgba. */
const RGB_IN_ARBITRARY = /\[(rgb[a]?\([\d,.\s%]+\))\]/i;

/** Regex to detect arbitrary values containing named CSS colors. */
const NAMED_COLOR_IN_ARBITRARY = /\[(red|blue|green|yellow|purple|orange|pink|brown|black|white|gray|grey|navy|teal|cyan|magenta|lime|olive|maroon|violet|indigo|coral|salmon|gold|silver)\]/i;

/** Patterns for color-affecting arbitrary value prefixes. */
const COLOR_UTILITY_RE = /\b(bg-|text-|border-|ring-|outline-|from-|via-|to-|accent-|caret-|fill-|stroke-)\[/;

export const hardcodedColorsRule: Rule = {
  id: 'tailwind-hardcoded-colors',
  severity: 'P1',
  scope: 'component',
  evaluate(ctx: RuleContext) {
    const findings: Array<Omit<import('@emdesign/dsr').Diagnostic, 'scope'>> = [];
    if (!ctx.source) return findings;

    let match: RegExpExecArray | null;
    CLASS_NAME_RE.lastIndex = 0;

    while ((match = CLASS_NAME_RE.exec(ctx.source)) !== null) {
      const classStr = match[1] ?? match[2] ?? '';
      if (!classStr) continue;

      // Check for arbitrary values containing colors
      const lines = classStr.split(/\s+/);
      for (const token of lines) {
        if (!token.includes('[')) continue;

        // Skip CSS variable references
        if (token.includes('var(--')) continue;

        // Check if this is a color-affecting utility
        if (!COLOR_UTILITY_RE.test(token)) continue;

        // Check for hex color
        const hexMatch = token.match(HEX_IN_ARBITRARY);
        if (hexMatch) {
          findings.push({
            ruleId: 'tailwind-hardcoded-colors',
            severity: 'P1',
            message: `Hardcoded hex color "${hexMatch[1]}" in "${token}" — use a --color-* token class instead`,
            fix: `Replace "${token}" with a token-bound utility. See DESIGN.md for available color tokens.`,
            snippet: token,
          });
          continue;
        }

        // Check for rgb/rgba
        const rgbMatch = token.match(RGB_IN_ARBITRARY);
        if (rgbMatch) {
          findings.push({
            ruleId: 'tailwind-hardcoded-colors',
            severity: 'P1',
            message: `Hardcoded rgb color "${rgbMatch[1]}" in "${token}" — use a --color-* token class instead`,
            fix: `Replace "${token}" with a token-bound utility. Use bg-surface, text-accent, etc.`,
            snippet: token,
          });
          continue;
        }

        // Check for named CSS colors
        const namedMatch = token.match(NAMED_COLOR_IN_ARBITRARY);
        if (namedMatch) {
          findings.push({
            ruleId: 'tailwind-hardcoded-colors',
            severity: 'P1',
            message: `Named CSS color "${namedMatch[1]}" in "${token}" — use a --color-* token class instead`,
            fix: `Replace "${token}" with a token-bound utility. Check DESIGN.md for the available color palette.`,
            snippet: token,
          });
        }
      }
    }

    return findings;
  },
};
