/**
 * @medesign/plugin-core — universal, always-on design-system rules.
 *
 * Provides two rule categories:
 *  1. `doctorRules()` — stack-agnostic **logical** DS rules (spacing scale, palette coherence,
 *     naming convention, etc.). Always aggregated into every doctor run.
 *  2. `renderedDoctorRules()` — **geometry/contrast** rules that run against render-probe DOM
 *     snapshots (overlap, overflow, off-scale spacing, WCAG contrast, tap-target size,
 *     type-scale sprawl). Always-on for any project with a running Storybook.
 */
import type { MedesignPlugin, DesignReviewRule, ReviewContext, RenderedReviewRule, RenderedReviewContext } from '@medesign/plugin-api';
import type { ReviewFinding, RenderSnapshot, RenderNode } from '@medesign/plugin-api';

// =========================================================================
// Helper utilities
// =========================================================================

/** Parse a CSS px value like "16px" → 16. Returns 0 for invalid/non-px. */
function parsePx(v: string): number {
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v.trim());
  return m ? Number(m[1]) : 0;
}

/** Check if a value is a nonzero px measurement. */
function isPx(v: string): boolean {
  return /^-?\d+(?:\.\d+)?px$/.test(v.trim());
}

/** Parse a hex color (#xxx, #xxxxxx) or rgb/rgba function → [r, g, b] or null. */
function parseColor(v: string): [number, number, number] | null {
  const s = v.trim().toLowerCase();

  // rgb(255, 0, 128) or rgba(255, 0, 128, 0.5)
  const rgbMatch = /^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
  }

  // #xxx or #xxxxxx
  let h = s;
  if (!h.startsWith('#')) return null;
  h = h.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length < 6) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** sRGB luminance (WCAG relative luminance). */
function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG contrast ratio between two colors. */
function contrastRatio(a: string, b: string): number | null {
  const ha = parseColor(a), hb = parseColor(b);
  if (!ha || !hb) return null;
  const la = luminance(ha), lb = luminance(hb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Is this resolved color transparent or near-transparent? */
function isTransparent(v: string): boolean {
  const t = v.trim().toLowerCase().replace(/\s/g, '');
  if (t === 'transparent' || t === 'rgba(0,0,0,0)') return true;
  // Catch bare rgb(0,0,0) used as transparent by some design systems
  if (/^rgba?\(0,0,0(,\s*0(\.\d+)?)?\)$/.test(t.replace(/\s/g, ''))) return true;
  return false;
}

/** Resolve the effective background color for a text node by walking ancestors. */
function resolveBackground(node: RenderNode, allNodes: RenderNode[]): string {
  if (!isTransparent(node.styles.backgroundColor)) {
    return node.styles.backgroundColor;
  }
  // Walk up by matching parentSelector
  const parent = allNodes.find((n) => n.selector === node.parentSelector);
  if (parent) return resolveBackground(parent, allNodes);
  return '#ffffff'; // fallback to white
}

/** Does the node look interactive? */
function isInteractive(node: RenderNode): boolean {
  const tag = node.tag.toLowerCase();
  if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea') return true;
  if (node.classes && /\b(btn|button|clickable|interactive)\b/i.test(node.classes)) return true;
  return false;
}

/** Extract --space-unit value from the design system (defaults to 8px). */
function spaceUnit(ds: RenderedReviewContext['ds']): number {
  const spaceToken = ds.tokens().find((t) => t.role === 'space-unit' || t.name === '--space-unit');
  if (spaceToken) {
    const px = parsePx(spaceToken.value);
    if (px > 0) return px;
  }
  return 8; // sensible default
}

/** Count distinct fontSize values in a render snapshot. */
function distinctFontSizes(snapshot: RenderSnapshot): number {
  const sizes = new Set<string>();
  for (const n of snapshot.nodes) {
    const px = n.styles.fontSize;
    if (px) sizes.add(px);
  }
  return sizes.size;
}

// =========================================================================
// Universal doctor rules (logical DS checks, stack-agnostic)
// =========================================================================

const spacingScaleDefined: DesignReviewRule = {
  id: 'core-spacing-scale', category: 'contract', title: 'Spacing scale token defined', severity: 'P2', target: '--space-unit declared',
  check: ({ ds }: ReviewContext) => {
    const has = ds.tokens().some((t) => t.role === 'space-unit' || t.name === '--space-unit');
    return { pass: has, detail: has ? '--space-unit found' : 'no --space-unit token', fix: 'Declare --space-unit in tokens.css (e.g. 8px).' };
  },
};

const singleAccent: DesignReviewRule = {
  id: 'core-single-accent', category: 'contract', title: 'Palette has a single accent color', severity: 'P2', target: '1 accent color role',
  check: ({ ds }: ReviewContext) => {
    const colors = ds.tokens().filter((t) => t.kind === 'color');
    const accents = colors.filter((t) => /accent/i.test(t.role) || /--color-accent/.test(t.name));
    return { pass: accents.length <= 1, detail: accents.length ? `${accents.length} accent roles found` : 'no accent defined', fix: 'Consolidate to a single --color-accent role; use hue-shifts (--color-accent-hover, --color-accent-muted) rather than multiple accent tokens.' };
  },
};

const namingConsistent: DesignReviewRule = {
  id: 'core-naming-consistent', category: 'contract', title: 'Token naming convention (kebab-case)', severity: 'P2', target: 'all token names kebab-case',
  check: ({ ds }: ReviewContext) => {
    const bad = ds.tokens().filter((t) => /[A-Z_]/.test(t.name.replace(/^--/, '')));
    return { pass: bad.length === 0, detail: bad.length ? `${bad.length} non-kebab tokens` : 'all kebab-case', fix: bad.length ? `Rename: ${bad.slice(0, 5).map((t) => t.name).join(', ')}${bad.length > 5 ? ` +${bad.length - 5} more` : ''} to kebab-case.` : undefined };
  },
};

const fontStackComplete: DesignReviewRule = {
  id: 'core-font-stack', category: 'contract', title: 'Body + headline font declared', severity: 'P1', target: '--font-body + --font-headline',
  check: ({ ds }: ReviewContext) => {
    const names = new Set(ds.tokens().map((t) => t.role));
    const missing = ['font-body', 'font-headline'].filter((r) => ![...names].some((n) => n === r || n.endsWith(`-${r}`) || n === `--${r}`));
    return { pass: missing.length === 0, detail: missing.length ? `missing: ${missing.join(', ')}` : 'complete', fix: 'Declare --font-body and --font-headline in tokens.css referencing real typeface names.' };
  },
};

const motionTokens: DesignReviewRule = {
  id: 'core-motion-tokens', category: 'contract', title: 'Motion tokens present', severity: 'P2', target: '--motion-* or --ease-*',
  check: ({ ds }: ReviewContext) => {
    const has = ds.tokens().some((t) => /motion|ease-/.test(t.role));
    return { pass: has, detail: has ? 'motion tokens found' : 'no motion/ease tokens', fix: 'Add --motion-* (duration) and --ease-* (timing) tokens for interaction feedback.' };
  },
};

export const CORE_DOCTOR_RULES: DesignReviewRule[] = [
  spacingScaleDefined,
  singleAccent,
  namingConsistent,
  fontStackComplete,
  motionTokens,
];

// =========================================================================
// Rendered doctor rules (geometry/contrast — run against render snapshots)
// =========================================================================

// ---- overlap ----
const overlapRule: RenderedReviewRule = {
  id: 'core-overlap', category: 'geometry', title: 'No unintended element overlap', severity: 'P2', target: '0 overlapping pairs',
  check: ({ renders }: RenderedReviewContext) => {
    const findings: string[] = [];
    for (const snap of renders) {
      const visible = snap.nodes.filter((n) => n.box.width > 0 && n.box.height > 0 && n.styles.position !== 'absolute' && n.styles.position !== 'fixed');
      for (let i = 0; i < visible.length; i++) {
        for (let j = i + 1; j < visible.length; j++) {
          const a = visible[i], b = visible[j];
          // Bounding-box intersection (allow 1px epsilon for sub-pixel rendering)
          const overlapX = Math.max(0, Math.min(a.box.x + a.box.width, b.box.x + b.box.width) - Math.max(a.box.x, b.box.x));
          const overlapY = Math.max(0, Math.min(a.box.y + a.box.height, b.box.y + b.box.height) - Math.max(a.box.y, b.box.y));
          if (overlapX > 1 && overlapY > 1) {
            findings.push(`${a.selector} overlaps ${b.selector} (${overlapX}×${overlapY}px)`);
          }
        }
      }
    }
    // Cap output to avoid flooding
    const top = findings.slice(0, 10);
    return { pass: findings.length === 0, detail: findings.length ? `${findings.length} overlaps (showing ${top.length})` : 'no overlaps', fix: top.length ? `Fix: ${top.join('; ')}` : undefined };
  },
};

// ---- overflow-clip ----
const overflowClipRule: RenderedReviewRule = {
  id: 'core-overflow-clip', category: 'geometry', title: 'No content clipped or escaping parent', severity: 'P2', target: '0 clipped children',
  check: ({ renders }: RenderedReviewContext) => {
    const findings: string[] = [];
    for (const snap of renders) {
      for (const n of snap.nodes) {
        if (!n.parentSelector) continue;
        const parent = snap.nodes.find((p) => p.selector === n.parentSelector);
        if (!parent) continue;
        // Only flag if parent overflow is visible/clip/hidden (content cut off or escaping)
        const ov = parent.styles.overflow.toLowerCase();
        if (ov === 'visible' || ov === 'clip' || ov === 'hidden') {
          const childRight = n.box.x + n.box.width;
          const parentRight = parent.box.x + parent.box.width;
          const childBottom = n.box.y + n.box.height;
          const parentBottom = parent.box.y + parent.box.height;
          if (childRight > parentRight + 1 || childBottom > parentBottom + 1) {
            findings.push(`${n.selector} (${n.tag}) extends beyond parent ${parent.selector} — right: ${Math.round(childRight - parentRight)}px, bottom: ${Math.round(childBottom - parentBottom)}px`);
          }
        }
      }
    }
    const top = findings.slice(0, 10);
    return { pass: findings.length === 0, detail: findings.length ? `${findings.length} overflow(s)` : 'no overflow', fix: top.length ? top.join('; ') : undefined };
  },
};

// ---- viewport-overflow ----
const viewportOverflowRule: RenderedReviewRule = {
  id: 'core-viewport-overflow', category: 'geometry', title: 'No horizontal scroll outside root', severity: 'P1', target: '0 elements beyond root width',
  check: ({ renders }: RenderedReviewContext) => {
    const findings: string[] = [];
    for (const snap of renders) {
      const rootRight = snap.root.width;
      for (const n of snap.nodes) {
        const right = n.box.x + n.box.width;
        if (right > rootRight + 1) {
          findings.push(`${n.selector} (${n.tag}) extends ${Math.round(right - rootRight)}px beyond viewport (right=${Math.round(right)} > ${Math.round(rootRight)})`);
        }
      }
    }
    const top = findings.slice(0, 10);
    return { pass: findings.length === 0, detail: findings.length ? `${findings.length} element(s) overflow viewport` : 'clean', fix: top.length ? top.join('; ') : undefined };
  },
};

// ---- off-scale-spacing ----
const offScaleSpacingRule: RenderedReviewRule = {
  id: 'core-off-scale-spacing', category: 'spacing', title: 'Spacing values aligned to --space-unit', severity: 'P2', target: 'all margins/padding/gap multiples of space-unit',
  check: ({ ds, renders }: RenderedReviewContext) => {
    const unit = spaceUnit(ds);
    const findings: string[] = [];
    for (const snap of renders) {
      for (const n of snap.nodes) {
        const props = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'gap'] as const;
        for (const prop of props) {
          const raw = n.styles[prop];
          if (!isPx(raw)) continue;
          const px = parsePx(raw);
          if (px === 0) continue;
          const ratio = px / unit;
          const nearest = Math.round(ratio);
          if (Math.abs(ratio - nearest) * unit > 1) {
            findings.push(`${n.selector} ${prop}=${raw} (not a multiple of ${unit}px, nearest=${nearest * unit}px)`);
          }
        }
      }
    }
    const top = findings.slice(0, 10);
    return { pass: findings.length === 0, detail: findings.length ? `${findings.length} off-scale values` : 'all on-scale', fix: top.length ? top.join('; ') : undefined };
  },
};

// ---- contrast-aa ----
const contrastAARule: RenderedReviewRule = {
  id: 'core-contrast-aa', category: 'a11y', title: 'Text-background contrast meets WCAG AA', severity: 'P1', target: '≥4.5:1 (body), ≥3:1 (large text)',
  check: ({ renders }: RenderedReviewContext) => {
    const findings: string[] = [];
    for (const snap of renders) {
      for (const n of snap.nodes) {
        const fg = n.styles.color;
        if (!fg || isTransparent(fg)) continue;
        const bg = resolveBackground(n, snap.nodes);
        if (!bg || isTransparent(bg)) continue;
        const ratio = contrastRatio(fg, bg);
        if (ratio == null) continue;
        const fontSizePx = parsePx(n.styles.fontSize);
        const fontWeight = parseInt(n.styles.fontWeight) || 400;
        const isLargeText = fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
        const threshold = isLargeText ? 3 : 4.5;
        if (ratio < threshold) {
          findings.push(`${n.selector} text "${n.text.slice(0, 30)}" fg=${fg} on bg=${bg} = ${ratio.toFixed(2)}:1 (need ≥${threshold})`);
        }
      }
    }
    const top = findings.slice(0, 10);
    return { pass: findings.length === 0, detail: findings.length ? `${findings.length} contrast failures` : 'all pass AA', fix: top.length ? top.join('; ') : undefined };
  },
};

// ---- tap-target ----
const tapTargetRule: RenderedReviewRule = {
  id: 'core-tap-target', category: 'a11y', title: 'Interactive elements meet minimum tap target size', severity: 'P2', target: '≥44×44px (mobile-friendly)',
  check: ({ renders }: RenderedReviewContext) => {
    const small: string[] = [];
    const tiny: string[] = [];
    for (const snap of renders) {
      for (const n of snap.nodes) {
        if (!isInteractive(n)) continue;
        if (n.box.width < 24 || n.box.height < 24) {
          tiny.push(`${n.selector} (${Math.round(n.box.width)}×${Math.round(n.box.height)}px)`);
        } else if (n.box.width < 44 || n.box.height < 44) {
          small.push(`${n.selector} (${Math.round(n.box.width)}×${Math.round(n.box.height)}px)`);
        }
      }
    }
    const findings: string[] = [];
    if (tiny.length) findings.push(`${tiny.length} target(s) < 24px: ${tiny.slice(0, 5).join('; ')}`);
    if (small.length) findings.push(`${small.length} target(s) < 44px`);
    return { pass: tiny.length === 0, detail: findings.length ? findings.join(' | ') : 'all ≥ 44px', fix: findings.length ? 'Increase tap target to ≥44×44px.' : undefined };
  },
};

// ---- type-scale-sprawl ----
const typeScaleSprawlRule: RenderedReviewRule = {
  id: 'core-type-scale-sprawl', category: 'typography', title: 'Typography scale is controlled (not sprawled)', severity: 'P2', target: '≤ 8 distinct font-size values',
  check: ({ renders }: RenderedReviewContext) => {
    const maxDistinct = 8;
    const issues: string[] = [];
    for (const snap of renders) {
      const count = distinctFontSizes(snap);
      if (count > maxDistinct) {
        issues.push(`${snap.theme}: ${count} distinct font-sizes`);
      }
    }
    return { pass: issues.length === 0, detail: issues.length ? issues.join('; ') : 'scale is controlled', fix: issues.length ? `Reduce distinct font-size values to ≤ ${maxDistinct}. Consolidate variants into the type-scale table.` : undefined };
  },
};

export const CORE_RENDERED_RULES: RenderedReviewRule[] = [
  overlapRule,
  overflowClipRule,
  viewportOverflowRule,
  offScaleSpacingRule,
  contrastAARule,
  tapTargetRule,
  typeScaleSprawlRule,
];

// =========================================================================
// Plugin export
// =========================================================================

export const corePlugin: MedesignPlugin = {
  id: 'core',
  kind: 'styling',
  doctorRules: () => CORE_DOCTOR_RULES,
  renderedDoctorRules: () => CORE_RENDERED_RULES,
};

export default corePlugin;
