/**
 * Consistency lint — now a thin compatibility shim over `@medesign/dsr`'s rule
 * engine (the single source of truth for rules). Existing call sites (adapters, mcp, http, cli,
 * graph) keep this API; the predicates live in the domain layer.
 */
import { componentLint, tokenReferenceLint, type Diagnostic } from '@medesign/dsr';

export type Severity = 'P0' | 'P1' | 'P2';

export interface Finding {
  severity: Severity;
  id: string;
  message: string;
  fix?: string;
  snippet?: string;
}

export interface LintOptions {
  declaredTokens?: string[];
  exemptions?: string[];
  bindsDisplayFace?: boolean;
}

const toFinding = (d: Omit<Diagnostic, 'scope'>): Finding => ({
  severity: d.severity,
  id: d.ruleId,
  message: d.message,
  fix: d.fix,
  snippet: d.snippet,
});

export function lintComponent(source: string, opts: LintOptions = {}): Finding[] {
  return componentLint(source, opts).map(toFinding);
}

export function lintTokenReferences(source: string, declaredTokens: string[]): Finding[] {
  return tokenReferenceLint(source, declaredTokens).map(toFinding);
}

const order: Record<Severity, number> = { P0: 0, P1: 1, P2: 2 };

export function renderFindingsForAgent(findings: Finding[]): string {
  if (findings.length === 0) return 'Consistency lint: PASS — no findings.';
  const sorted = [...findings].sort((a, b) => order[a.severity] - order[b.severity]);
  const blocking = sorted.filter((f) => f.severity === 'P0').length;
  const lines = sorted.map((f) => `- [${f.severity}] ${f.id}: ${f.message}${f.fix ? `\n    fix: ${f.fix}` : ''}${f.snippet ? `\n    at: ${f.snippet}` : ''}`);
  return `Consistency lint: ${blocking} blocking (P0), ${findings.length - blocking} advisory.\n${lines.join('\n')}`;
}

export function countMustFix(findings: Finding[]): number {
  return findings.filter((f) => f.severity === 'P0').length;
}

export function tokenScore(findings: Finding[]): number {
  const penalty = findings.reduce((s, f) => s + (f.severity === 'P0' ? 0.34 : f.severity === 'P1' ? 0.12 : 0.04), 0);
  return Math.max(0, 1 - penalty);
}
