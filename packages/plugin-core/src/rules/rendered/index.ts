/**
 * Core rendered rules — deterministic DOM geometry/contrast checks.
 *
 * These run against render-probe snapshots (live DOM captured via Playwright),
 * checking element overlap, overflow, spacing scale, WCAG contrast, tap-target
 * size, and type-scale consistency.
 *
 * Each rule produces text findings with fix guidance. The framework charters
 * in @emdesign/dsr/charters/geometry/ are the structured successor to these
 * rules; these remain for backward compatibility and as the "flat text" path.
 */
import type { RenderedReviewRule, RenderedReviewContext } from '@emdesign/plugin-api';
import { parsePx, isPx, resolveBackground, contrastRatio, isTransparent, isInteractive, spaceUnit, distinctFontSizes } from '../../helpers/index.js';

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
          const overlapX = Math.max(0, Math.min(a.box.x + a.box.width, b.box.x + b.box.width) - Math.max(a.box.x, b.box.x));
          const overlapY = Math.max(0, Math.min(a.box.y + a.box.height, b.box.y + b.box.height) - Math.max(a.box.y, b.box.y));
          if (overlapX > 1 && overlapY > 1) {
            findings.push(`${a.selector} overlaps ${b.selector} (${overlapX}×${overlapY}px)`);
          }
        }
      }
    }
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

/** All core rendered rules, always-on for any project with a running Storybook. */
export const CORE_RENDERED_RULES: RenderedReviewRule[] = [
  overlapRule,
  overflowClipRule,
  viewportOverflowRule,
  offScaleSpacingRule,
  contrastAARule,
  tapTargetRule,
  typeScaleSprawlRule,
];
