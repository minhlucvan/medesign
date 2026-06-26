import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import type { VisionProvider, VisionContext, VisionCritiqueResult, VisionCompareResult } from '../types.js';
import { buildVisionPrompt } from '../prompt/builder.js';
import { guessMimeFromPath, resizeImageIfNeeded } from '../image/processing.js';

const API_KEY_ENV = 'ANTHROPIC_API_KEY';
const FALLBACK_KEY_ENV = 'ANTHROPIC_AUTH_TOKEN';
const BASE_URL_ENV = 'ANTHROPIC_BASE_URL';
const MODEL_ENV = 'ANTHROPIC_MODEL';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/**
 * Claude vision provider — uses Anthropic Messages API with image content blocks.
 *
 * Also supports Minimax's Anthropic-compatible endpoint (MiniMax-M3) via
 * ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN env vars.
 *
 * Note: MiniMax-2.x models do NOT support vision — use MiniMax-M3 or
 * the native minimax provider (MiniMax-VL-01) instead.
 */
export const claudeProvider: VisionProvider = {
  id: 'claude',
  name: 'Claude Sonnet 4',

  available(): boolean {
    return !!(process.env[API_KEY_ENV] || process.env[FALLBACK_KEY_ENV]);
  },

  async critique(imageBuffer: Buffer, imageMime: string, ctx: VisionContext): Promise<VisionCritiqueResult> {
    const apiKey = process.env[API_KEY_ENV] || process.env[FALLBACK_KEY_ENV];
    const baseURL = process.env[BASE_URL_ENV] || undefined;
    let model = process.env[MODEL_ENV] || process.env.CLAUDE_MODEL || DEFAULT_MODEL;

    if (!apiKey) {
      return {
        provider: 'claude',
        axes: {},
        visionScore: 0,
        findings: [{ severity: 'P0', region: 'system', issue: `Claude API key not set (${API_KEY_ENV} or ${FALLBACK_KEY_ENV})`, fix: `Set ${API_KEY_ENV} in your environment.` }],
        modelUsed: model,
      };
    }

    // Auto-upgrade MiniMax-2.x models to M3 for vision (2.x doesn't support images).
    if (/^MiniMax-2\./i.test(model)) {
      const upgraded = model.replace(/^MiniMax-2\.[\d.]+/i, 'MiniMax-M3');
      console.error(`[vision-critic] Model ${model} does not support vision; upgrading to ${upgraded}`);
      model = upgraded;
    }

    const { buffer: resized } = await resizeImageIfNeeded(imageBuffer, 'claude');
    const { system, user } = buildVisionPrompt(ctx, 'standard');

    try {
      const anthropic = new Anthropic({ apiKey, baseURL });

      const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: [{ type: 'text', text: system }],
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: user },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: imageMime as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
                  data: resized.toString('base64'),
                },
              },
            ],
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      const raw = textBlock?.text ?? '';
      return parseClaudeResponse(raw, model);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        provider: 'claude',
        axes: {},
        visionScore: 0,
        findings: [{ severity: 'P0', region: 'system', issue: `Claude API error: ${message}`, fix: 'Check API key, network, and model availability.' }],
        modelUsed: model,
        raw: message,
      };
    }
  },

  async compare(referenceImage: Buffer, actualImage: Buffer, ctx: VisionContext): Promise<VisionCompareResult> {
    const apiKey = process.env[API_KEY_ENV] || process.env[FALLBACK_KEY_ENV];
    const baseURL = process.env[BASE_URL_ENV] || undefined;
    let model = process.env[MODEL_ENV] || process.env.CLAUDE_MODEL || DEFAULT_MODEL;
    if (!apiKey) {
      return {
        provider: 'claude',
        fidelityScore: 0,
        differences: [],
        findings: [{ severity: 'P0', region: 'system', issue: `Claude API key not set (${API_KEY_ENV} or ${FALLBACK_KEY_ENV})`, fix: `Set ${API_KEY_ENV} in your environment.` }],
        modelUsed: model,
      };
    }
    // Auto-upgrade MiniMax-2.x models to M3 for vision.
    if (/^MiniMax-2\./i.test(model)) {
      const upgraded = model.replace(/^MiniMax-2\.[\d.]+/i, 'MiniMax-M3');
      console.error(`[vision-critic] Model ${model} does not support vision; upgrading to ${upgraded}`);
      model = upgraded;
    }

    const { system } = buildVisionPrompt({ ...ctx, screenshotPath: '' }, 'reference');

    try {
      const anthropic = new Anthropic({ apiKey, baseURL });

      const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: [{ type: 'text', text: system }],
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Reference (intended design):' },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: referenceImage.toString('base64'),
                },
              },
              { type: 'text', text: 'Actual (rendered component):' },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: actualImage.toString('base64'),
                },
              },
            ],
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      const raw = textBlock?.text ?? '';
      return parseClaudeCompareResponse(raw, model);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        provider: 'claude',
        fidelityScore: 0,
        differences: [],
        findings: [{ severity: 'P0', region: 'system', issue: `Claude API error: ${message}`, fix: 'Check API key and network.' }],
        modelUsed: model,
      };
    }
  },
};

/** Parse Claude's JSON response for a standard critique. */
function parseClaudeResponse(raw: string, model: string): VisionCritiqueResult {
  try {
    // Extract JSON from markdown code fences if present.
    const jsonStr = extractJson(raw);
    const data = JSON.parse(jsonStr);

    return {
      provider: 'claude',
      axes: {
        hierarchy: clamp(data.axes?.hierarchy),
        balance: clamp(data.axes?.balance),
        spacingRhythm: clamp(data.axes?.spacingRhythm),
        onBrand: clamp(data.axes?.onBrand),
        polish: clamp(data.axes?.polish),
      },
      visionScore: clamp(data.visionScore ?? data.vision ?? 0),
      findings: (data.findings ?? []).map((f: any) => ({
        severity: f.severity ?? 'P2',
        region: f.region ?? '',
        issue: f.issue ?? '',
        fix: f.fix ?? '',
      })),
      modelUsed: model,
      raw,
    };
  } catch {
    // Parsing failed — return raw text as a finding.
    return {
      provider: 'claude',
      axes: {},
      visionScore: 0,
      findings: [{ severity: 'P2', region: 'parse', issue: 'Could not parse Claude response as JSON', fix: '' }],
      modelUsed: model,
      raw,
    };
  }
}

/** Parse Claude's JSON response for a reference comparison. */
function parseClaudeCompareResponse(raw: string, model: string): VisionCompareResult {
  try {
    const jsonStr = extractJson(raw);
    const data = JSON.parse(jsonStr);

    return {
      provider: 'claude',
      fidelityScore: clamp(data.fidelityScore ?? 0),
      differences: (data.differences ?? []).map((d: any) => ({
        region: d.region ?? '',
        type: d.type ?? 'other',
        description: d.description ?? '',
      })),
      findings: (data.findings ?? []).map((f: any) => ({
        severity: f.severity ?? 'P2',
        region: f.region ?? '',
        issue: f.issue ?? '',
        fix: f.fix ?? '',
      })),
      modelUsed: model,
    };
  } catch {
    return {
      provider: 'claude',
      fidelityScore: 0,
      differences: [],
      findings: [{ severity: 'P2', region: 'parse', issue: 'Could not parse Claude response as JSON', fix: '' }],
      modelUsed: model,
    };
  }
}

/** Extract JSON from markdown code fences or raw text. */
function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  // No fences — try parsing the whole thing.
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

function clamp(n: unknown, lo = 0, hi = 1): number {
  const v = Number(n);
  return isNaN(v) ? 0 : Math.max(lo, Math.min(hi, v));
}
