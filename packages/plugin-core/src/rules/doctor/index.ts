/**
 * Core doctor rules — production-readiness checks for design system metadata.
 *
 * These are "logical" DS rules that validate token contracts, naming conventions,
 * and system completeness. They run against the DesignSystem data model, not
 * against rendered DOM.
 */
import type { DesignReviewRule, ReviewContext } from '@emdesign/plugin-api';

/** --space-unit token must be declared. */
const spacingScaleDefined: DesignReviewRule = {
  id: 'core-spacing-scale', category: 'contract', title: 'Spacing scale token defined', severity: 'P2', target: '--space-unit declared',
  check: ({ ds }: ReviewContext) => {
    const has = ds.tokens().some((t) => t.role === 'space-unit' || t.name === '--space-unit');
    return { pass: has, detail: has ? '--space-unit found' : 'no --space-unit token', fix: 'Declare --space-unit in tokens.css (e.g. 8px).' };
  },
};

/** Palette must have exactly one accent color. */
const singleAccent: DesignReviewRule = {
  id: 'core-single-accent', category: 'contract', title: 'Palette has a single accent color', severity: 'P2', target: '1 accent color role',
  check: ({ ds }: ReviewContext) => {
    const colors = ds.tokens().filter((t) => t.kind === 'color');
    const accents = colors.filter((t) => /accent/i.test(t.role) || /--color-accent/.test(t.name));
    return { pass: accents.length <= 1, detail: accents.length ? `${accents.length} accent roles found` : 'no accent defined', fix: 'Consolidate to a single --color-accent role; use hue-shifts (--color-accent-hover, --color-accent-muted) rather than multiple accent tokens.' };
  },
};

/** All token names must be kebab-case. */
const namingConsistent: DesignReviewRule = {
  id: 'core-naming-consistent', category: 'contract', title: 'Token naming convention (kebab-case)', severity: 'P2', target: 'all token names kebab-case',
  check: ({ ds }: ReviewContext) => {
    const bad = ds.tokens().filter((t) => /[A-Z_]/.test(t.name.replace(/^--/, '')));
    return { pass: bad.length === 0, detail: bad.length ? `${bad.length} non-kebab tokens` : 'all kebab-case', fix: bad.length ? `Rename: ${bad.slice(0, 5).map((t) => t.name).join(', ')}${bad.length > 5 ? ` +${bad.length - 5} more` : ''} to kebab-case.` : undefined };
  },
};

/** Body + headline font tokens must be declared. */
const fontStackComplete: DesignReviewRule = {
  id: 'core-font-stack', category: 'contract', title: 'Body + headline font declared', severity: 'P1', target: '--font-body + --font-headline',
  check: ({ ds }: ReviewContext) => {
    const names = new Set(ds.tokens().map((t) => t.role));
    const missing = ['font-body', 'font-headline'].filter((r) => ![...names].some((n) => n === r || n.endsWith(`-${r}`) || n === `--${r}`));
    return { pass: missing.length === 0, detail: missing.length ? `missing: ${missing.join(', ')}` : 'complete', fix: 'Declare --font-body and --font-headline in tokens.css referencing real typeface names.' };
  },
};

/** Motion/easing tokens must be present. */
const motionTokens: DesignReviewRule = {
  id: 'core-motion-tokens', category: 'contract', title: 'Motion tokens present', severity: 'P2', target: '--motion-* or --ease-*',
  check: ({ ds }: ReviewContext) => {
    const has = ds.tokens().some((t) => /motion|ease-/.test(t.role));
    return { pass: has, detail: has ? 'motion tokens found' : 'no motion/ease tokens', fix: 'Add --motion-* (duration) and --ease-* (timing) tokens for interaction feedback.' };
  },
};

/** All core doctor rules, always-on for every project. */
export const CORE_DOCTOR_RULES: DesignReviewRule[] = [
  spacingScaleDefined,
  singleAccent,
  namingConsistent,
  fontStackComplete,
  motionTokens,
];
