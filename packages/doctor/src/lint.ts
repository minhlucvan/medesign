import type { DesignReviewRule, ReviewContext, Severity } from '@medesign/dsr';
import { CORE_RULES } from './rules.js';

export interface DoctorFinding {
  ruleId: string;
  category: string;
  title: string;
  severity: Severity;
  pass: boolean;
  detail: string;
  target: string;
  fix?: string;
}

export interface DoctorReport {
  id: string;
  passed: number;
  total: number;
  ratio: number;        // passed / total
  grade: string;        // A..F from ratio — intentionally secondary to the findings
  findings: DoctorFinding[];          // failing checks, severity-ordered (where to improve)
  passes: DoctorFinding[];            // passing checks
  byCategory: Record<string, { passed: number; total: number }>;
}

const RANK: Record<Severity, number> = { P0: 0, P1: 1, P2: 2 };
function letter(r: number): string { return r >= 0.9 ? 'A' : r >= 0.8 ? 'B' : r >= 0.7 ? 'C' : r >= 0.6 ? 'D' : 'F'; }

/**
 * Run the rule-based design-system review. The grade is just `passed/total`; the FINDINGS (severity
 * + concrete fix + where) are the product — they point out exactly where to improve to be production-ready.
 */
export function lintDesignSystem(id: string, ctx: ReviewContext, pluginRules: DesignReviewRule[] = []): DoctorReport {
  const rules = [...CORE_RULES, ...pluginRules];
  const all: DoctorFinding[] = rules.map((r) => {
    const res = r.check(ctx);
    return { ruleId: r.id, category: r.category, title: r.title, severity: r.severity, pass: res.pass, detail: res.detail, target: r.target, fix: res.pass ? undefined : res.fix };
  });
  const findings = all.filter((f) => !f.pass).sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  const passes = all.filter((f) => f.pass);
  const byCategory: Record<string, { passed: number; total: number }> = {};
  for (const f of all) { const c = (byCategory[f.category] ??= { passed: 0, total: 0 }); c.total++; if (f.pass) c.passed++; }
  const passed = passes.length, total = all.length, ratio = total ? passed / total : 0;
  return { id, passed, total, ratio, grade: letter(ratio), findings, passes, byCategory };
}
