/**
 * Framework Charter: geometry/aspect-ratio
 *
 * "As a media element (img, video), I want my rendered aspect ratio to match
 *  my natural or declared aspect ratio so I don't appear stretched or squished."
 *
 * Layer: dom
 * Category: geometry
 *
 * Checks media elements in the render snapshot for aspect ratio consistency.
 * Flags images and other media elements whose width:height ratio deviates
 * from expected values (e.g., 16:9, 4:3, 1:1, 2:3) — an indicator that
 * they may be missing width/height attributes or object-fit styling.
 */
import type { ElementCharter, EcDomContext, EcFinding } from '../charter.js';

/** Common aspect ratios as [w, h] tuples with labels. */
const COMMON_ASPECT_RATIOS: Array<{ w: number; h: number; label: string }> = [
  { w: 16, h: 9, label: '16:9' },
  { w: 4, h: 3, label: '4:3' },
  { w: 3, h: 2, label: '3:2' },
  { w: 1, h: 1, label: '1:1 (square)' },
  { w: 2, h: 3, label: '2:3' },
  { w: 9, h: 16, label: '9:16' },
  { w: 21, h: 9, label: '21:9' },
];

/** Maximum findings per run. */
const MAX_FINDINGS = 10;

/** Check if an aspect ratio matches a known ratio within tolerance. */
function matchesKnownRatio(w: number, h: number): boolean {
  if (w === 0 || h === 0) return true;
  const ratio = w / h;
  for (const known of COMMON_ASPECT_RATIOS) {
    const knownRatio = known.w / known.h;
    if (Math.abs(ratio - knownRatio) < 0.05) return true;
  }
  return false;
}

/** Get the nearest known aspect ratio label. */
function nearestKnownRatio(w: number, h: number): string {
  if (w === 0 || h === 0) return 'n/a';
  const ratio = w / h;
  let best = `${Math.round(w)}×${Math.round(h)}`;
  let bestDiff = Infinity;
  for (const known of COMMON_ASPECT_RATIOS) {
    const knownRatio = known.w / known.h;
    const diff = Math.abs(ratio - knownRatio);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = known.label;
    }
  }
  return best;
}

export const aspectRatio: ElementCharter = {
  name: 'geometry/aspect-ratio',
  description:
    'As a media element, I want my rendered aspect ratio to match a standard ratio so I do not appear stretched.',
  severity: 'P2',
  matcher: { type: 'dom-selector', selector: 'img, video, iframe, canvas' },
  run(ctx: EcDomContext): EcFinding[] {
    const findings: EcFinding[] = [];

    for (const el of ctx.matchedElements) {
      if (findings.length >= MAX_FINDINGS) break;

      const { width, height } = el.node.box;
      if (width === 0 || height === 0) continue;

      // Skip very small elements (likely icons or spacers)
      if (width < 24 && height < 24) continue;

      if (!matchesKnownRatio(width, height)) {
        const nearest = nearestKnownRatio(width, height);
        findings.push({
          id: `geometry/aspect-ratio/${el.node.selector}`,
          severity: 'P2',
          message:
            `"${el.node.selector}" has non-standard aspect ratio ` +
            `${Math.round(width)}×${Math.round(height)} (≈${(width / height).toFixed(2)}:1). ` +
            `Nearest standard: ${nearest}.`,
          target: el.node.selector,
          remediation:
            'Set explicit width and height attributes on the media element, ' +
            'or use `aspect-` utility classes (aspect-video, aspect-square) ' +
            'and `object-fit: cover` to prevent distortion.',
        });
      }
    }

    return findings;
  },
};

export default aspectRatio;
