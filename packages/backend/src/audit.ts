import fs from 'node:fs';
import path from 'node:path';
import { SEMANTIC_TOKEN_ROLES, parseDeclaredTokens } from '@emdesign/dsr';
import type { RepoPaths } from './paths.js';
import { baseDetail } from './scaffold.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface AuditFinding {
  rule: string;
  dimension: 'tokens' | 'designMd' | 'taste' | 'lint' | 'preview';
  severity: 'P0' | 'P1' | 'P2';
  message: string;
  pass: boolean;
  fix?: string; // description of the auto-fix applied
}

export interface AuditReport {
  id: string;
  ok: boolean;
  findings: AuditFinding[];
  summary: {
    tokens: { pass: number; total: number };
    designMd: { pass: number; total: number };
    taste: { pass: number; total: number };
    lint: { pass: number; total: number };
    preview: { pass: number; total: number };
  };
  score: number; // 0-100
}

interface DsFiles {
  designMd: string;
  tokensCss: string;
  manifest: Record<string, any>;
  previewHtml: string;
  tasteSkill: string;
}

// ── Dimensions ────────────────────────────────────────────────────────

const REQUIRED_SECTIONS = [
  'Visual Theme', 'Color', 'Typography', 'Spacing', 'Layout',
  'Components', 'Motion', 'Voice', 'Anti-patterns',
];

const SLOP_PATTERNS = [
  { pattern: /#6366f1|#4f46e5|indigo-5\d{2}/i, name: 'AI-default indigo', severity: 'P0' as const },
  { pattern: /purple.*gradient|gradient.*purple|indigo.*gradient/i, name: 'AI-purple gradient', severity: 'P0' as const },
  { pattern: /lorem\s+ipsum/i, name: 'Filler lorem ipsum', severity: 'P0' as const },
  { pattern: /feature\s+(one|1|two|2|three|3)/i, name: 'Generic feature naming', severity: 'P1' as const },
  { pattern: /🚀|✨|💡|🎨/, name: 'Emoji as icon', severity: 'P1' as const },
];

// ── Helpers ───────────────────────────────────────────────────────────

function readFiles(paths: RepoPaths, id: string): DsFiles {
  const dsDir = path.join(paths.designSystemsDir, id);
  return {
    designMd: safeRead(path.join(dsDir, 'DESIGN.md')),
    tokensCss: safeRead(path.join(dsDir, 'tokens.css')),
    manifest: safeReadJson(path.join(dsDir, 'manifest.json')),
    previewHtml: safeRead(path.join(dsDir, 'reference-example.html')),
    tasteSkill: safeRead(path.join(dsDir, 'skills', 'taste', 'SKILL.md')),
  };
}

function safeRead(file: string): string {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

function safeReadJson(file: string): Record<string, any> {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function severityScore(s: 'P0' | 'P1' | 'P2'): number {
  return s === 'P0' ? 3 : s === 'P1' ? 2 : 1;
}

// ── Dimension Checks ──────────────────────────────────────────────────

/** A. Token Contract: all SEMANTIC_TOKEN_ROLES must be declared. */
function checkTokenContract(files: DsFiles): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const declared = parseDeclaredTokens(files.tokensCss);
  const declaredSet = new Set(declared);

  for (const role of SEMANTIC_TOKEN_ROLES) {
    if (!declaredSet.has(role)) {
      findings.push({
        rule: 'token-contract',
        dimension: 'tokens',
        severity: 'P0',
        message: `Missing required token: --${role}`,
        pass: false,
      });
    }
  }

  if (findings.length === 0) {
    findings.push({
      rule: 'token-contract',
      dimension: 'tokens',
      severity: 'P0',
      message: `All ${SEMANTIC_TOKEN_ROLES.length} required token roles declared`,
      pass: true,
    });
  }

  return findings;
}

/** B. DESIGN.md Quality: sections, type scale, color roles, components, depth, motion, anti-patterns. */
function checkDesignMdQuality(files: DsFiles): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const md = files.designMd;

  if (!md) {
    findings.push({ rule: 'design-md-exists', dimension: 'designMd', severity: 'P0', message: 'DESIGN.md file missing', pass: false });
    return findings;
  }

  // Check all 9 required sections by title
  const presentSections: string[] = [];
  for (const section of REQUIRED_SECTIONS) {
    const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`^###\\s+${escaped}`, 'm').test(md)) {
      presentSections.push(section);
    }
  }
  findings.push({
    rule: 'sections',
    dimension: 'designMd',
    severity: 'P1',
    message: `${presentSections.length}/${REQUIRED_SECTIONS.length} required sections present`,
    pass: presentSections.length >= 9,
  });

  // Check for >= 1300 words
  const wordCount = md.split(/\s+/).filter(Boolean).length;
  findings.push({
    rule: 'doc-depth',
    dimension: 'designMd',
    severity: 'P2',
    message: `${wordCount} words${wordCount >= 1300 ? '' : ' (need ≥1300)'}`,
    pass: wordCount >= 1300,
  });

  // Check for anti-patterns section naming lint codes (≥3)
  const antiSection = md.match(/###\s+Anti-patterns[\s\S]*?(?=###|$)/);
  if (antiSection) {
    const lintCodes = (antiSection[0].match(/`[a-z-]+`/g) || []).length;
    findings.push({
      rule: 'anti-slop',
      dimension: 'designMd',
      severity: 'P2',
      message: `${lintCodes} lint codes referenced in anti-patterns${lintCodes < 3 ? ' (need ≥3)' : ''}`,
      pass: lintCodes >= 3,
    });
  } else {
    findings.push({
      rule: 'anti-slop',
      dimension: 'designMd',
      severity: 'P2',
      message: 'No Anti-patterns section found',
      pass: false,
    });
  }

  return findings;
}

/** C. Taste Alignment: check token values against design-taste dials and anti-slop rules. */
function checkTasteAlignment(files: DsFiles): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const css = files.tokensCss;
  const taste = files.tasteSkill;

  // Extract dials from taste skill
  const vMatch = taste.match(/DESIGN_VARIANCE:\s*(\d+)/);
  const mMatch = taste.match(/MOTION_INTENSITY:\s*(\d+)/);
  const dMatch = taste.match(/VISUAL_DENSITY:\s*(\d+)/);
  const variance = vMatch ? parseInt(vMatch[1]) : null;
  const motion = mMatch ? parseInt(mMatch[1]) : null;
  const density = dMatch ? parseInt(dMatch[1]) : null;

  if (variance || motion || density) {
    findings.push({
      rule: 'taste-dials',
      dimension: 'taste',
      severity: 'P2',
      message: `Taste dials: V${variance ?? '?'} / M${motion ?? '?'} / D${density ?? '?'}`,
      pass: true,
    });
  } else {
    findings.push({
      rule: 'taste-dials',
      dimension: 'taste',
      severity: 'P2',
      message: 'No taste dials configured (run ds-taste-profile first)',
      pass: false,
    });
  }

  // Check for slop patterns in tokens.css
  for (const slop of SLOP_PATTERNS) {
    if (slop.pattern.test(css)) {
      findings.push({
        rule: 'anti-slop',
        dimension: 'taste',
        severity: slop.severity,
        message: `Potential slop detected: ${slop.name}`,
        pass: false,
      });
    }
  }

  // Check font pairing has intentional contrast
  const fontDisplay = css.match(/--font-display:\s*"([^"]+)"/);
  const fontSans = css.match(/--font-sans:\s*"([^"]+)"/);
  if (fontDisplay && fontSans && fontDisplay[1] === fontSans[1]) {
    findings.push({
      rule: 'font-pairing',
      dimension: 'taste',
      severity: 'P2',
      message: `Display and body fonts are identical ("${fontDisplay[1]}") — no intentional contrast`,
      pass: false,
    });
  }

  // Check for spacing / density alignment
  const spaceUnit = css.match(/--space-unit:\s*(\d+)px/);
  if (spaceUnit && density !== null) {
    const unit = parseInt(spaceUnit[1]);
    const densityOk = (density <= 3 && unit >= 8) || (density >= 4 && density <= 6 && unit >= 4 && unit <= 6) || (density >= 7 && unit <= 4);
    if (!densityOk) {
      findings.push({
        rule: 'density-spacing',
        dimension: 'taste',
        severity: 'P2',
        message: `Density dial (${density}) but spacing unit is ${unit}px — mismatch`,
        pass: false,
      });
    }
  }

  if (findings.length === 0) {
    findings.push({
      rule: 'taste-clean',
      dimension: 'taste',
      severity: 'P2',
      message: 'No taste issues detected',
      pass: true,
    });
  }

  return findings;
}

/** D. Lint Rules: check active preset and manifest configuration. */
function checkLintRules(files: DsFiles): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const manifest = files.manifest;
  const craft = manifest.craft ?? {};
  const applies: string[] = craft.applies ?? [];
  const exemptions: string[] = craft.exemptions ?? [];

  findings.push({
    rule: 'lint-active',
    dimension: 'lint',
    severity: 'P2',
    message: `${applies.length} active lint rules, ${exemptions.length} exemptions`,
    pass: applies.length >= 3,
  });

  return findings;
}

/** E. Preview Quality: check reference-example.html exists and has content. */
function checkPreviewQuality(files: DsFiles): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const html = files.previewHtml;

  if (!html) {
    findings.push({
      rule: 'preview-exists',
      dimension: 'preview',
      severity: 'P1',
      message: 'No reference-example.html found (run ds-generate-preview or ds-author-decompose)',
      pass: false,
    });
    return findings;
  }

  const size = Buffer.byteLength(html, 'utf8');
  findings.push({
    rule: 'preview-size',
    dimension: 'preview',
    severity: 'P2',
    message: `reference-example.html: ${(size / 1024).toFixed(1)}KB`,
    pass: size > 500,
  });

  // Check it references the design system's tokens
  if (html.includes('color-accent') || html.includes('color-surface') || html.includes('var(--')) {
    findings.push({
      rule: 'preview-tokens',
      dimension: 'preview',
      severity: 'P2',
      message: 'Preview references design system tokens',
      pass: true,
    });
  } else {
    findings.push({
      rule: 'preview-tokens',
      dimension: 'preview',
      severity: 'P2',
      message: 'Preview does not appear to reference design system tokens',
      pass: false,
    });
  }

  return findings;
}

// ── Fix Logic ─────────────────────────────────────────────────────────

function autoFix(findings: AuditFinding[], paths: RepoPaths, id: string, files: DsFiles): boolean {
  const dsDir = path.join(paths.designSystemsDir, id);
  const tokensCssPath = path.join(dsDir, 'tokens.css');
  let changed = false;

  // Fix missing tokens
  const missingRoles = findings.filter(f => f.rule === 'token-contract' && !f.pass);
  if (missingRoles.length > 0 && files.tokensCss) {
    let css = files.tokensCss;
    // Add missing required roles with defaults
    const defaults: Record<string, string> = {
      'color-surface-raised': '  --color-surface-raised: #ffffff;  /* Raised surface — cards, modals */',
      'color-text-muted': '  --color-text-muted: #6a6a6a;  /* Secondary/muted text */',
      'color-accent-hover': '  --color-accent-hover: #1d4ed8;  /* Accent hover state */',
      'shadow-raised': '  --shadow-raised: 0 1px 3px rgba(0,0,0,0.1);  /* Raised element shadow */',
    };
    for (const f of missingRoles) {
      const role = f.message.replace('Missing required token: --', '');
      if (defaults[role]) {
        css = css.replace('}', defaults[role] + '\n}');
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(tokensCssPath, css);
  }

  return changed;
}

// ── Main Audit Function ──────────────────────────────────────────────

/**
 * Run a full audit of a design system against all quality dimensions.
 * Call from CLI via `emdesign ds audit <id>`.
 */
export function auditDesignSystem(paths: RepoPaths, id: string, opts?: { fix?: boolean }): AuditReport {
  const files = readFiles(paths, id);

  const allFindings: AuditFinding[] = [
    ...checkTokenContract(files),
    ...checkDesignMdQuality(files),
    ...checkTasteAlignment(files),
    ...checkLintRules(files),
    ...checkPreviewQuality(files),
  ];

  // If --fix, apply fixes and re-check
  if (opts?.fix) {
    const issues = allFindings.filter(f => !f.pass);
    if (issues.length > 0) {
      const fixed = autoFix(issues, paths, id, files);
      if (fixed) {
        // Re-read and re-audit
        const newFiles = readFiles(paths, id);
        const newFindings = [
          ...checkTokenContract(newFiles),
          ...checkDesignMdQuality(newFiles),
          ...checkTasteAlignment(newFiles),
          ...checkLintRules(newFiles),
          ...checkPreviewQuality(newFiles),
        ];
        // Mark fixed items
        for (const nf of newFindings) {
          const old = allFindings.find(f => f.rule === nf.rule && f.dimension === nf.dimension);
          if (old && !old.pass && nf.pass) {
            old.pass = true;
            old.fix = 'Auto-fixed';
            old.message = nf.message;
          }
        }
      }
    }
  }

  // Compute summary per dimension
  const dimensions = ['tokens', 'design-md', 'taste', 'lint', 'preview'] as const;
  const summary: AuditReport['summary'] = { tokens: { pass: 0, total: 0 }, designMd: { pass: 0, total: 0 }, taste: { pass: 0, total: 0 }, lint: { pass: 0, total: 0 }, preview: { pass: 0, total: 0 } };

  for (const f of allFindings) {
    const dim = f.dimension === 'designMd' ? 'designMd' : f.dimension;
    summary[dim].total++;
    if (f.pass) { const dim = f.dimension === 'designMd' ? 'designMd' : f.dimension; summary[dim].pass++; }
  }

  // Score: weighted by severity
  let totalScore = 0;
  let maxScore = 0;
  for (const f of allFindings) {
    const s = severityScore(f.severity);
    maxScore += s;
    if (f.pass) totalScore += s;
  }
  const score = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  const failedP0 = allFindings.some(f => !f.pass && f.severity === 'P0');

  return {
    id,
    ok: !failedP0 && score >= 60,
    findings: allFindings,
    summary,
    score,
  };
}
