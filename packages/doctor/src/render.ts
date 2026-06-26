import type { DoctorReport } from './lint.js';

/** A human-readable scorecard: the headline ratio, then the findings (where to improve) first. */
export function renderReport(r: DoctorReport): string {
  const lines: string[] = [];
  lines.push(`Design system: ${r.id}`);
  lines.push(`Rules passed: ${r.passed}/${r.total}  ·  grade ${r.grade}`);
  if (r.findings.length) {
    lines.push('', 'Improve to be production-ready:');
    for (const f of r.findings) lines.push(`  ✗ [${f.severity}] ${f.title} — ${f.detail} (target ${f.target})\n      → ${f.fix ?? ''}`);
  } else {
    lines.push('', '✓ all checks pass — production-ready.');
  }
  if (r.passes.length) {
    lines.push('', 'Passing:');
    for (const f of r.passes) lines.push(`  ✓ ${f.title} — ${f.detail}`);
  }
  return lines.join('\n');
}
