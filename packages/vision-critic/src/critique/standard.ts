import fs from 'node:fs';
import type { VisionContextInput } from '../context/builder.js';
import { buildVisionContext } from '../context/builder.js';
import type { VisionProvider, CritiqueOptions, VisionCritiqueOutput } from '../types.js';
import { resolveVisionProvider, availableVisionProviders } from '../registry.js';
import { computeVisionScore, countP0Findings, sortFindings } from '../score.js';
import { guessMimeFromPath } from '../image/processing.js';

/**
 * Run a standard vision critique: take a component screenshot + design system context,
 * send to the chosen provider, and return structured output ready for the critique gate.
 *
 * This is the primary entry point — called by MCP tools, CLI, and HTTP.
 */
export async function standardCritique(
  input: VisionContextInput,
  options: CritiqueOptions,
): Promise<VisionCritiqueOutput> {
  const component = options.component;

  // Resolve provider
  const provider = await resolveProvider(options.provider);
  if (!provider) {
    const available = await availableVisionProviders();
    const hint = available.length > 0
      ? `Available: ${available.map((p) => p.id).join(', ')}`
      : 'No vision provider available. Set MINIMAX_API_KEY, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_API_KEY, or GEMINI_API_KEY.';
    return {
      component,
      mode: options.mode ?? 'standard',
      provider: options.provider ?? 'none',
      axes: {},
      visionScore: 0,
      mustFix: 0,
      findings: [{ severity: 'P0', region: 'system', issue: `Vision provider '${options.provider ?? 'default'}' not available. ${hint}`, fix: hint }],
      error: `Provider unavailable: ${hint}`,
    };
  }

  // Build context
  const ctx = buildVisionContext(input, component, options);

  // Read screenshot
  let imageBuffer: Buffer;
  try {
    imageBuffer = fs.readFileSync(ctx.screenshotPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      component,
      mode: options.mode ?? 'standard',
      provider: provider.id,
      axes: {},
      visionScore: 0,
      mustFix: 0,
      findings: [{ severity: 'P0', region: 'system', issue: `Screenshot not found: ${ctx.screenshotPath} (${msg})`, fix: 'Run run_visual_test first to capture a screenshot.' }],
      error: `Screenshot not found: ${ctx.screenshotPath}`,
    };
  }

  const mime = guessMimeFromPath(ctx.screenshotPath);

  // Run critique
  const result = await provider.critique(imageBuffer, mime, ctx);

  // Compute output
  const visionScore = result.visionScore ?? computeVisionScore(result.axes);
  const findings = sortFindings(result.findings ?? []);
  const mustFix = countP0Findings(findings);

  return {
    component,
    mode: options.mode ?? 'standard',
    provider: provider.id,
    axes: result.axes,
    visionScore,
    mustFix,
    findings,
    raw: result.raw,
  };
}

async function resolveProvider(providerId?: string): Promise<VisionProvider | undefined> {
  if (providerId) return resolveVisionProvider(providerId);

  // Prefer minimax when any Minimax-compatible key is set.
  const avail = await availableVisionProviders();
  const hasMinimaxKey = !!(process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  if (hasMinimaxKey) {
    const minimax = avail.find((p) => p.id === 'minimax');
    if (minimax) return minimax;
  }

  // Fallback to claude when ANTHROPIC_API_KEY is set.
  const claude = avail.find((p) => p.id === 'claude');
  if (claude) return claude;

  // Anything else (gemini, custom).
  return avail[0];
}
