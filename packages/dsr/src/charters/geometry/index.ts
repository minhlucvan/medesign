/**
 * Framework-Level Geometry Charters — shipped with the engine, always-on.
 *
 * These charters validate spatial/geometry properties of every rendered component
 * across ALL design systems. They complement DS-level Element Charters
 * (design-systems/<id>/charters/) by providing framework-level guarantees:
 *
 *  - geometry/no-overlap:          No sibling elements overlap
 *  - geometry/no-child-overflow:   No child element overflows its parent
 *  - geometry/minimum-gap:         Adjacent siblings have breathing room (≥8px)
 *  - geometry/z-index-collision:   Overlapping elements have explicit z-index
 *  - geometry/no-viewport-overflow: No element extends beyond viewport bounds
 *
 * Each charter produces structured findings with coordinate data and remediation
 * guidance suitable for AI agent consumption. See the individual files for details.
 *
 * Register these via loadFrameworkCharters() in the loader, or by importing
 * directly into the doctor pipeline that runs rendered artifact checks.
 */
import type { ElementCharter } from '../charter.js';
import { noOverlap } from './no-overlap.js';
import { noChildOverflow } from './no-child-overflow.js';
import { minimumGap } from './minimum-gap.js';
import { zIndexCollision } from './z-index-collision.js';
import { noViewportOverflow } from './no-viewport-overflow.js';

/**
 * All framework-level geometry charters.
 *
 * These are always registered by the engine regardless of which design system
 * is active. They run against every render snapshot produced by renderProbe.ts.
 */
export const FRAMEWORK_GEOMETRY_CHARTERS: ElementCharter[] = [
  noOverlap,
  noChildOverflow,
  minimumGap,
  zIndexCollision,
  noViewportOverflow,
];

export { noOverlap } from './no-overlap.js';
export { noChildOverflow } from './no-child-overflow.js';
export { minimumGap } from './minimum-gap.js';
export { zIndexCollision } from './z-index-collision.js';
export { noViewportOverflow } from './no-viewport-overflow.js';
