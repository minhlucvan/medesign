import { SEMANTIC_TOKEN_ROLES, tokenReferenceLint, type DesignReviewRule, type ReviewContext } from '@medesign/dsr';

const LINT_CODES = ['off-token', 'ai-default-indigo', 'purple-gradient', 'trust-gradient', 'emoji-icon', 'invented-metric', 'filler-copy', 'external-image', 'accent-overuse', 'left-accent-card', 'sans-display'];

/** Slice the body of the DESIGN.md section whose heading matches `re`. */
function sectionBody(designMd: string, re: RegExp): string {
  const heads = [...designMd.matchAll(/^##\s+(.+?)\s*$/gm)];
  for (let i = 0; i < heads.length; i++) {
    const title = heads[i][1].replace(/^\d+\.\s*/, '');
    if (re.test(title)) {
      const start = heads[i].index! + heads[i][0].length;
      const end = i + 1 < heads.length ? heads[i + 1].index! : designMd.length;
      return designMd.slice(start, end);
    }
  }
  return '';
}

/**
 * The built-in production-readiness ruleset (open-design grade). Each rule queries the rich data
 * model (the DesignSystem aggregate + graph stats + conflicts) and returns a finding with a fix.
 * Plugins (css/react/tailwind) contribute more via `doctorRules()`.
 */
export const CORE_RULES: DesignReviewRule[] = [
  {
    id: 'token-contract', category: 'contract', title: 'All required token roles declared', severity: 'P0', target: 'all 11 roles + var() resolves',
    check: ({ ds }: ReviewContext) => {
      const declared = new Set(ds.declaredTokens.map((t) => t.replace(/^--/, '')));
      const missing = SEMANTIC_TOKEN_ROLES.filter((r) => !declared.has(r));
      const unresolved = tokenReferenceLint(ds.assets.tokensCss, ds.declaredTokens);
      const pass = missing.length === 0 && unresolved.length === 0;
      return { pass, detail: pass ? 'complete' : `${missing.length} missing, ${unresolved.length} unresolved`, fix: missing.length ? `Declare: ${missing.map((r) => '--' + r).join(', ')}` : 'Resolve the dangling var() references.' };
    },
  },
  {
    id: 'sections', category: 'depth', title: 'DESIGN.md has all 9 sections', severity: 'P1', target: '>= 9',
    check: ({ ds }) => { const n = ds.sections().length; return { pass: n >= 9, detail: `${n} sections`, fix: 'Author all 9 contract sections (see docs/spec.md).' }; },
  },
  {
    id: 'type-scale', category: 'depth', title: 'Typography type-scale table', severity: 'P1', target: '>= 14 rows',
    check: ({ ds }) => { const n = ds.section(/typograph/i)?.tableRows ?? 0; return { pass: n >= 14, detail: `${n} rows`, fix: 'Expand §3 to a full type-scale table (Role · Family · Size · Weight · Line-height · Tracking).' }; },
  },
  {
    id: 'color-roles', category: 'depth', title: 'Color role table', severity: 'P2', target: '>= 10 rows',
    check: ({ ds }) => { const n = ds.section(/color/i)?.tableRows ?? 0; return { pass: n >= 10, detail: `${n} rows`, fix: 'Enumerate every color role (surfaces, text tiers, accent, border, status) in §2.' }; },
  },
  {
    id: 'components-specced', category: 'depth', title: 'Components specced with states', severity: 'P1', target: '>= 7 + states',
    check: ({ ds }) => { const s = ds.section(/component/i); const n = s?.bulletCount ?? 0; const states = !!s?.namesStates; return { pass: n >= 7 && states, detail: `${n} components${states ? ' + states' : ', no states'}`, fix: 'Spec ≥7 components in §6, each with hover/focus/active/disabled bound to tokens.' }; },
  },
  {
    id: 'token-richness', category: 'depth', title: 'Token richness', severity: 'P2', target: '>= 26',
    check: ({ stats }) => { const n = stats['node:token'] ?? 0; return { pass: n >= 26, detail: `${n} tokens`, fix: 'Add tokens for shape/shadow tiers, focus-ring, motion, layout.' }; },
  },
  {
    id: 'theming', category: 'theming', title: 'Theme(s) present', severity: 'P2', target: '>= 1 [data-theme]',
    check: ({ stats }) => { const n = stats['node:theme'] ?? 0; return { pass: n >= 1, detail: `${n} themes`, fix: 'Add a [data-theme="dark"] override block re-declaring the color roles.' }; },
  },
  {
    id: 'doc-depth', category: 'depth', title: 'DESIGN.md depth', severity: 'P2', target: '>= 1300 words',
    check: ({ ds }) => { const n = ds.wordCount(); return { pass: n >= 1300, detail: `${n} words`, fix: 'Deepen the contract: rationale, exact values, states, anti-patterns.' }; },
  },
  {
    id: 'motion', category: 'depth', title: 'Motion wired to tokens', severity: 'P2', target: 'uses --motion-*',
    check: ({ ds }) => { const ok = /--motion-|--ease-/.test(ds.assets.tokensCss) || /--motion-/.test(sectionBody(ds.assets.designMd, /motion|interaction/i)); return { pass: ok, detail: ok ? 'token-bound' : 'no motion tokens', fix: 'Define --motion-* / --ease-* tokens and reference them in §7.' }; },
  },
  {
    id: 'craft-contract', category: 'contract', title: 'Craft lint codes enabled', severity: 'P2', target: '>= 7',
    check: ({ ds }) => { const n = ds.craftApplies().length; return { pass: n >= 7, detail: `${n} codes`, fix: 'Enable more craft.applies lint codes in manifest.json.' }; },
  },
  {
    id: 'conflicts', category: 'integrity', title: 'No blocking conflicts', severity: 'P1', target: '0 P0/P1',
    check: ({ conflicts }) => { const blocking = conflicts.filter((c) => c.severity === 'P0' || c.severity === 'P1').length; const p2 = conflicts.filter((c) => c.severity === 'P2').length; return { pass: blocking === 0, detail: `${blocking} P0/P1, ${p2} P2`, fix: 'Resolve duplicate roles / dangling theme overrides.' }; },
  },
  {
    id: 'anti-slop', category: 'contract', title: 'Anti-patterns name lint codes', severity: 'P2', target: 'names codes',
    check: ({ ds }) => { const body = sectionBody(ds.assets.designMd, /anti-pattern/i); const hits = LINT_CODES.filter((c) => body.includes(c)).length; return { pass: hits >= 3, detail: `${hits} codes named`, fix: 'In §9, name the concrete lint codes each Do/Don\'t maps to.' }; },
  },
  {
    id: 'primitives', category: 'code', title: 'Primitive components', severity: 'P1', target: '>= 7',
    check: ({ stats }) => { const n = stats['node:primitive'] ?? 0; return { pass: n >= 7, detail: `${n} primitives`, fix: 'Ship the core primitives (Button, Card, Input, Badge, Heading, Stack, …) in code/.' }; },
  },
];
