import type { Conflict } from '../domain/values.js';
import { isSemanticToken } from '../domain/values.js';
import type { DesignSystem } from '../domain/designSystem.js';

/**
 * Detect conflicts in a design system — the "check for conflicts" capability. Complements the
 * rule engine's validation (missing roles / unresolved vars) with relational/structural issues.
 */
export function detectConflicts(ds: DesignSystem): Conflict[] {
  const out: Conflict[] = [];

  // 1. Duplicate role declarations in the :root contract (same --name declared twice).
  //    Only :root counts — re-declarations inside [data-theme] blocks are legitimate theme
  //    overrides (validated separately in check #3), not duplicates.
  const rootBlock = ds.assets.tokensCss.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? ds.assets.tokensCss;
  const counts = new Map<string, number>();
  for (const m of rootBlock.matchAll(/--([a-z0-9-]+)\s*:/gi)) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  for (const [name, n] of counts) {
    if (n > 1) out.push({ kind: 'duplicate-role', severity: 'P1', message: `Token role --${name} is declared ${n} times in tokens.css.`, subjects: [`--${name}`] });
  }

  // 2. Orphan tokens — declared but used by nothing (skip required foundational roles).
  for (const token of ds.tokens()) {
    if (isSemanticToken(token.role)) continue; // foundational roles may be referenced indirectly
    if (token.usages().length === 0) out.push({ kind: 'orphan-token', severity: 'P2', message: `Token ${token.name} is declared but unused.`, subjects: [token.node.id] });
  }

  // 3. Dangling theme overrides — an override targeting a token that isn't declared.
  const declared = new Set(ds.declaredTokens.map((t) => t.replace(/^--/, '')));
  for (const theme of ds.themes()) {
    for (const o of theme.overrides()) {
      const role = o.token.split('/--').pop()?.replace(/^--/, '') ?? o.token;
      if (!declared.has(role)) out.push({ kind: 'theme-override', severity: 'P1', message: `Theme ${theme.name} overrides --${role}, which is not declared.`, subjects: [theme.node.id, o.token] });
    }
  }

  return out;
}
