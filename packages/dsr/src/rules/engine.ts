import type { Diagnostic, RuleScope, Severity } from '../domain/values.js';
import { SEMANTIC_TOKEN_ROLES } from '../domain/values.js';
import type { DesignSystem } from '../domain/designSystem.js';
import { componentLint, tokenReferenceLint, type ComponentLintOptions } from './lint.js';

export interface RuleContext {
  source?: string;
  ds?: DesignSystem;
  declaredTokens?: string[];
  bindsDisplayFace?: boolean;
  exemptions?: string[];
  framework?: string;
  target?: string;
}

/** A first-class, testable rule. Built-ins live in lint.ts/system checks; adapters register more. */
export interface Rule {
  id: string;
  severity: Severity;
  scope: RuleScope;
  framework?: string;
  evaluate(ctx: RuleContext): Array<Omit<Diagnostic, 'scope'>>;
}

/**
 * The single source of truth for evaluating design-system + component rules. The backend's
 * `adapter.lint()` and `validate_design_system` both delegate here.
 */
export class RuleEngine {
  private registered: Rule[] = [];

  register(rule: Rule): void {
    this.registered.push(rule);
  }

  /** Component-scope evaluation (anti-slop + token contract on source). */
  evaluateComponent(source: string, opts: ComponentLintOptions & { framework?: string } = {}): Diagnostic[] {
    const exempt = new Set(opts.exemptions ?? []);
    const findings = [
      ...componentLint(source, opts),
      ...tokenReferenceLint(source, opts.declaredTokens ?? []),
    ];
    for (const r of this.registered) {
      if (r.scope !== 'component') continue;
      if (opts.framework && r.framework && r.framework !== opts.framework) continue;
      findings.push(...r.evaluate({ source, ...opts }).map((f) => ({ ...f })));
    }
    return findings.filter((f) => !exempt.has(f.ruleId)).map((f) => ({ ...f, scope: 'component' as const }));
  }

  /** System-scope evaluation (structural invariants over the whole design system). */
  evaluateSystem(ds: DesignSystem): Diagnostic[] {
    const out: Diagnostic[] = [];
    const declared = new Set(ds.declaredTokens.map((t) => t.replace(/^--/, '')));
    for (const role of SEMANTIC_TOKEN_ROLES) {
      if (!declared.has(role)) out.push({ ruleId: 'missing-role', severity: 'P0', scope: 'system', message: `Required token role --${role} is not declared in tokens.css.`, fix: `Add --${role} to tokens.css.`, target: ds.id });
    }
    const sectionCount = ds.sections().length;
    if (sectionCount < 9) out.push({ ruleId: 'incomplete-spec', severity: 'P1', scope: 'system', message: `DESIGN.md has ${sectionCount}/9 sections.`, fix: 'Author all 9 sections (see docs/spec.md).', target: ds.id });
    for (const f of tokenReferenceLint(ds.assets.tokensCss, ds.declaredTokens)) out.push({ ...f, scope: 'system', target: ds.id });
    const exempt = new Set(ds.exemptions);
    out.push(...this.registered.filter((r) => r.scope === 'system').flatMap((r) => r.evaluate({ ds }).map((f) => ({ ...f, scope: 'system' as const }))));
    return out.filter((d) => !exempt.has(d.ruleId));
  }
}

const order: Record<Severity, number> = { P0: 0, P1: 1, P2: 2 };

/** P0-first agent-facing render of diagnostics. */
export function renderDiagnostics(diags: Diagnostic[]): string {
  if (diags.length === 0) return 'No findings.';
  const sorted = [...diags].sort((a, b) => order[a.severity] - order[b.severity]);
  const blocking = sorted.filter((d) => d.severity === 'P0').length;
  const lines = sorted.map((d) => `- [${d.severity}] ${d.ruleId}: ${d.message}${d.fix ? `\n    fix: ${d.fix}` : ''}${d.snippet ? `\n    at: ${d.snippet}` : ''}`);
  return `${blocking} blocking (P0), ${diags.length - blocking} advisory.\n${lines.join('\n')}`;
}

export function countMustFix(diags: Diagnostic[]): number {
  return diags.filter((d) => d.severity === 'P0').length;
}

/** 0..1 quality score from diagnostics (P0 heavier). */
export function diagnosticsScore(diags: Diagnostic[]): number {
  const penalty = diags.reduce((s, d) => s + (d.severity === 'P0' ? 0.34 : d.severity === 'P1' ? 0.12 : 0.04), 0);
  return Math.max(0, 1 - penalty);
}
