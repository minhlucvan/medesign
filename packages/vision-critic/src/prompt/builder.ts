import type { VisionContext, CritiqueMode } from '../types.js';
import {
  STANDARD_CRITIQUE_SYSTEM,
  REFERENCE_COMPARISON_SYSTEM,
  REGRESSION_CRITIQUE_SYSTEM,
} from './templates.js';

/** Build system + user prompts for a given critique mode and context. */
export function buildVisionPrompt(
  ctx: VisionContext,
  mode: CritiqueMode,
): { system: string; user: string } {
  let system: string;
  switch (mode) {
    case 'reference':
      system = REFERENCE_COMPARISON_SYSTEM;
      break;
    case 'regression':
      system = REGRESSION_CRITIQUE_SYSTEM;
      break;
    default:
      system = STANDARD_CRITIQUE_SYSTEM;
  }

  const parts: string[] = [
    `Component: ${ctx.component}`,
  ];

  if (ctx.designContext) {
    parts.push('', '=== DESIGN SYSTEM CONTEXT ===', ctx.designContext);
  }

  if (ctx.renderSnapshot) {
    parts.push('', '=== RENDERED DOM SNAPSHOT (computed styles + geometry) ===', ctx.renderSnapshot);
  }

  if (ctx.staticFindings) {
    parts.push('', '=== DETERMINISTIC ANALYSIS FINDINGS ===', ctx.staticFindings);
  }

  if (ctx.previousCritique) {
    parts.push(
      '',
      '=== PREVIOUS CRITIQUE ===',
      `Vision score: ${ctx.previousCritique.visionScore}`,
      `Axes: ${JSON.stringify(ctx.previousCritique.axes)}`,
      `Findings: ${JSON.stringify(ctx.previousCritique.findings)}`,
    );
  }

  parts.push('', 'Critique the screenshot at the provided path. Be specific, visual, and honest.');

  return { system, user: parts.join('\n') };
}
