/**
 * Shared token-resolution helper for plugin-tailwindcss rules.
 *
 * Maps Tailwind utility suffixes to design-system token roles, validates
 * spacing against --space-unit multiples, and checks breakpoint usage
 * against the DS contract. Used across source/doctor/rendered rules.
 */

/** The 7 semantic color suffixes mapped in the existing classRoles() map. */
const COLOR_SUFFIXES = ['surface', 'surface-raised', 'text', 'text-muted', 'accent', 'accent-hover', 'border'] as const;

/** Properties whose arbitrary values should be checked against the token scale. */
const TOKEN_PROPERTIES = new Set([
  'text', 'bg', 'border', 'ring', 'outline', 'from', 'via', 'to',
  'p', 'm', 'mt', 'mr', 'mb', 'ml', 'mx', 'my', 'pt', 'pr', 'pb', 'pl', 'px', 'py',
  'gap', 'gap-x', 'gap-y', 'space-x', 'space-y',
  'w', 'h', 'min-w', 'min-h', 'max-w', 'max-h',
  'rounded', 'shadow',
]);

/** Known Tailwind responsive breakpoint prefixes. */
const NAMED_BREAKPOINTS = ['sm', 'md', 'lg', 'xl', '2xl'] as const;

/**
 * Map a Tailwind utility suffix to its --color-* token role.
 * Returns null if no token mapping exists.
 */
export function classToToken(suffix: string): string | null {
  if (suffix === 'rounded') return 'radius';
  if (suffix === 'shadow') return 'shadow-raised';
  if ((COLOR_SUFFIXES as readonly string[]).includes(suffix)) return `color-${suffix}`;
  return null;
}

/**
 * Check if a pixel value aligns to the --space-unit scale.
 * Returns the nearest scale step and whether it's an exact match.
 */
export function spacingToScale(px: number, unit: number): { nearest: number; mismatch: boolean } {
  if (px === 0 || unit <= 0) return { nearest: 0, mismatch: false };
  const ratio = px / unit;
  const nearest = Math.round(ratio);
  const mismatch = Math.abs(ratio - nearest) > 0.125; // within 12.5% tolerance
  return { nearest, mismatch };
}

/**
 * Validate a breakpoint prefix against the DS breakpoint contract.
 * Returns whether the prefix is valid and a suggestion (if applicable).
 */
export function validateBreakpoint(
  prefix: string,
  breakpoints: Record<string, string>,
): { valid: boolean; suggestion?: string } {
  // Named breakpoints are always valid
  if ((NAMED_BREAKPOINTS as readonly string[]).includes(prefix as any)) {
    return { valid: true };
  }

  // max-* prefixes are non-standard
  if (prefix.startsWith('max-')) {
    const base = prefix.slice(4);
    if ((NAMED_BREAKPOINTS as readonly string[]).includes(base as any)) {
      return { valid: false, suggestion: `Use a container query or different layout approach instead of ${prefix}` };
    }
    return { valid: false, suggestion: `max-* breakpoints are non-standard. Consider using container queries.` };
  }

  // min-[...] arbitrary breakpoints — check if value matches a named DS breakpoint
  if (prefix.startsWith('min-')) {
    const value = prefix.slice(4);
    // Check if this arbitrary value matches a named DS breakpoint
    for (const [name, bp] of Object.entries(breakpoints)) {
      if (value.includes(bp) || bp.includes(value)) {
        return { valid: false, suggestion: `Use named breakpoint ${name}: instead of ${prefix}` };
      }
    }
    // Unknown breakpoint — flag if we have a contract
    if (Object.keys(breakpoints).length > 0) {
      return { valid: false, suggestion: `Breakpoint ${prefix} is not in the DS contract (${Object.keys(breakpoints).join(', ')}). Add it or use an existing one.` };
    }
    return { valid: true }; // No contract — can't validate
  }

  // Unknown prefix, let it through
  return { valid: true };
}

/**
 * Check if a CSS property category matches a token-mapped category.
 */
export function isTokenMappedProperty(tailwindProperty: string): boolean {
  // Extract the base property from "text-[...]" or "bg-[...]"
  const base = tailwindProperty.split('-')[0];
  if (base === 'text' || base === 'bg' || base === 'border' || base === 'ring' || base === 'outline') return true;
  if (base === 'p' || base === 'm' || base === 'gap' || base === 'space') return true;
  if (base === 'w' || base === 'h') return true;
  if (tailwindProperty === 'rounded' || tailwindProperty === 'shadow') return true;
  return false;
}

/**
 * Check if a class string contains a color-affecting utility (bg-*, text-*, border-*, ring-*).
 */
export function hasColorUtilities(classes: string): boolean {
  return /\b(bg-|text-|border-|ring-|outline-|from-|via-|to-|accent-|caret-|fill-|stroke-)/.test(classes);
}

/**
 * Check if an element is interactive (button, a, input, select, textarea, or has interactive class).
 */
export function isInteractiveTag(tag: string, classes: string): boolean {
  const t = tag.toLowerCase();
  if (t === 'button' || t === 'a' || t === 'input' || t === 'select' || t === 'textarea') return true;
  return /\b(btn|button|clickable|interactive|cursor-pointer)\b/i.test(classes);
}

/**
 * Check if an element is disabled.
 */
export function isDisabled(classes: string): boolean {
  return /\b(disabled|pointer-events-none)\b/.test(classes);
}
