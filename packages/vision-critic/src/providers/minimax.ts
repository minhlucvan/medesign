import type { VisionProvider, VisionContext, VisionCritiqueResult, VisionCompareResult } from '../types.js';
import { buildVisionPrompt } from '../prompt/builder.js';
import { STANDARD_CRITIQUE_SYSTEM, REFERENCE_COMPARISON_SYSTEM } from '../prompt/templates.js';
import { resizeImageIfNeeded, removeAlphaFromPNG } from '../image/processing.js';

/**
 * Minimax vision provider.
 *
 * Minimax offers two API paths:
 *   1. Anthropic-compatible gateway (api.minimax.io/anthropic) — uses x-api-key auth,
 *      MiniMax-M3 supports vision via the standard Anthropic image content blocks.
 *   2. Native chat API (api.minimaxi.com) — uses Bearer token auth,
 *      MiniMax-VL-01 supports vision via OpenAI-compatible image_url blocks.
 *
 * This provider tries #1 first (Anthropic-compatible, with x-api-key from ANTHROPIC_AUTH_TOKEN),
 * then falls back to #2 (native, with Bearer from MINIMAX_API_KEY).
 * The provider ID is always "minimax" regardless of which path is used.
 */

const ANTHROPIC_COMPAT_KEY_ENV = 'ANTHROPIC_AUTH_TOKEN';
const ANTHROPIC_COMPAT_URL = 'https://api.minimax.io/anthropic/v1/messages';
const ANTHROPIC_COMPAT_MODEL = 'MiniMax-M3';

const NATIVE_KEY_ENV = 'MINIMAX_API_KEY';
const NATIVE_BASE_URL_ENV = 'MINIMAX_BASE_URL';
const NATIVE_MODEL_ENV = 'MINIMAX_MODEL';
const NATIVE_DEFAULT_BASE = 'https://api.minimaxi.com';
const NATIVE_DEFAULT_MODEL = 'MiniMax-VL-01';

function nativeKey(): string | undefined {
  return process.env[NATIVE_KEY_ENV];
}

function anthropicCompatKey(): string | undefined {
  return process.env[ANTHROPIC_COMPAT_KEY_ENV];
}

function hasAnyKey(): boolean {
  return !!(nativeKey() || anthropicCompatKey());
}

export const minimaxProvider: VisionProvider = {
  id: 'minimax',
  name: 'MiniMax (M3 / VL-01)',

  available(): boolean {
    return hasAnyKey();
  },

  async critique(imageBuffer: Buffer, imageMime: string, ctx: VisionContext): Promise<VisionCritiqueResult> {
    // Try anthropic-compatible path first (MiniMax-M3 supports vision via x-api-key).
    const compatKey = anthropicCompatKey();
    if (compatKey) {
      return critiqueViaAnthropicCompat(compatKey, imageBuffer, imageMime, ctx);
    }

    // Fallback to native path (MiniMax-VL-01 via Bearer token).
    const key = nativeKey();
    if (key) {
      return critiqueViaNative(key, imageBuffer, imageMime, ctx);
    }

    return {
      provider: 'minimax',
      axes: {},
      visionScore: 0,
      findings: [{
        severity: 'P0', region: 'system',
        issue: `No Minimax API key found. Set ${ANTHROPIC_COMPAT_KEY_ENV} or ${NATIVE_KEY_ENV}.`,
        fix: `Run: export ${ANTHROPIC_COMPAT_KEY_ENV}="your-key"`,
      }],
      modelUsed: ANTHROPIC_COMPAT_MODEL,
    };
  },

  async compare(referenceImage: Buffer, actualImage: Buffer, ctx: VisionContext): Promise<VisionCompareResult> {
    const compatKey = anthropicCompatKey();
    if (compatKey) {
      return compareViaAnthropicCompat(compatKey, referenceImage, actualImage, ctx);
    }
    return {
      provider: 'minimax',
      fidelityScore: 0,
      differences: [],
      findings: [{ severity: 'P0', region: 'system', issue: 'No Minimax API key found.', fix: `Set ${ANTHROPIC_COMPAT_KEY_ENV}.` }],
      modelUsed: ANTHROPIC_COMPAT_MODEL,
    };
  },
};

// ---- Anthropic-compatible path (api.minimax.io/anthropic, x-api-key auth) ----

async function critiqueViaAnthropicCompat(
  key: string, imageBuffer: Buffer, imageMime: string, ctx: VisionContext,
): Promise<VisionCritiqueResult> {
  const { buffer: processed } = await resizeImageIfNeeded(imageBuffer, 'claude');
  const finalBuffer = await removeAlphaFromPNG(processed);
  const { system, user } = buildVisionPrompt(ctx, 'standard');

  try {
    const body = {
      model: ANTHROPIC_COMPAT_MODEL,
      max_tokens: 4096,
      system: [{ type: 'text', text: system }],
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: user },
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: finalBuffer.toString('base64') },
          },
        ],
      }],
    };

    const resp = await fetch(ANTHROPIC_COMPAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const raw = await resp.text();
    if (!resp.ok) {
      return {
        provider: 'minimax',
        axes: {},
        visionScore: 0,
        findings: [{ severity: 'P0', region: 'system', issue: `Minimax API returned ${resp.status}: ${raw.slice(0, 300)}`, fix: 'Check your API key.' }],
        modelUsed: ANTHROPIC_COMPAT_MODEL,
        raw,
      };
    }

    const data = JSON.parse(raw);
    const textContent = data?.content?.find((b: any) => b.type === 'text')?.text ?? '';
    return parseMinimaxResponse(textContent, ANTHROPIC_COMPAT_MODEL);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      provider: 'minimax',
      axes: {},
      visionScore: 0,
      findings: [{ severity: 'P0', region: 'system', issue: `Minimax API error: ${msg}`, fix: 'Check network and API endpoint.' }],
      modelUsed: ANTHROPIC_COMPAT_MODEL,
      raw: msg,
    };
  }
}

async function compareViaAnthropicCompat(
  key: string, referenceImage: Buffer, actualImage: Buffer, ctx: VisionContext,
): Promise<VisionCompareResult> {
  try {
    const refB64 = (await removeAlphaFromPNG(referenceImage)).toString('base64');
    const actB64 = (await removeAlphaFromPNG(actualImage)).toString('base64');
    const body = {
      model: ANTHROPIC_COMPAT_MODEL,
      max_tokens: 4096,
      system: [{ type: 'text', text: REFERENCE_COMPARISON_SYSTEM }],
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Reference (intended design):' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: refB64 } },
          { type: 'text', text: 'Actual (rendered component):' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: actB64 } },
        ],
      }],
    };

    const resp = await fetch(ANTHROPIC_COMPAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const raw = await resp.text();
    if (!resp.ok) {
      return { provider: 'minimax', fidelityScore: 0, differences: [], findings: [], modelUsed: ANTHROPIC_COMPAT_MODEL };
    }

    const data = JSON.parse(raw);
    const textContent = data?.content?.find((b: any) => b.type === 'text')?.text ?? '';
    return parseMinimaxCompareResponse(textContent, ANTHROPIC_COMPAT_MODEL);
  } catch (err) {
    return { provider: 'minimax', fidelityScore: 0, differences: [], findings: [], modelUsed: ANTHROPIC_COMPAT_MODEL };
  }
}

// ---- Native path (api.minimaxi.com, Bearer auth) ----

async function critiqueViaNative(
  key: string, imageBuffer: Buffer, imageMime: string, ctx: VisionContext,
): Promise<VisionCritiqueResult> {
  const { buffer: resized } = await resizeImageIfNeeded(imageBuffer, 'minimax');
  const { system, user } = buildVisionPrompt(ctx, 'standard');

  const baseUrl = process.env[NATIVE_BASE_URL_ENV] || NATIVE_DEFAULT_BASE;
  const model = process.env[NATIVE_MODEL_ENV] || NATIVE_DEFAULT_MODEL;

  try {
    const body = {
      model,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: user },
            { type: 'image_url', image_url: { url: `data:${imageMime};base64,${resized.toString('base64')}` } },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.3,
    };

    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });

    const raw = await resp.text();
    if (!resp.ok) {
      return {
        provider: 'minimax', axes: {}, visionScore: 0,
        findings: [{ severity: 'P0', region: 'system', issue: `Minimax native API returned ${resp.status}: ${raw.slice(0, 300)}`, fix: 'Check MINIMAX_API_KEY.' }],
        modelUsed: model, raw,
      };
    }

    const data = JSON.parse(raw);
    const textContent = data?.choices?.[0]?.message?.content ?? '';
    return parseMinimaxResponse(textContent, model);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      provider: 'minimax', axes: {}, visionScore: 0,
      findings: [{ severity: 'P0', region: 'system', issue: `Minimax native API error: ${msg}`, fix: 'Check network.' }],
      modelUsed: model, raw: msg,
    };
  }
}

// ---- Parsing (shared) ----

function parseMinimaxResponse(raw: string, model: string): VisionCritiqueResult {
  try {
    const jsonStr = extractJson(raw);
    const data = JSON.parse(jsonStr);
    return {
      provider: 'minimax',
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
    return {
      provider: 'minimax',
      axes: {},
      visionScore: 0,
      findings: [{ severity: 'P2', region: 'parse', issue: 'Could not parse Minimax response as structured JSON.', fix: 'The raw response is in the raw field.' }],
      modelUsed: model,
      raw,
    };
  }
}

function parseMinimaxCompareResponse(raw: string, model: string): VisionCompareResult {
  try {
    const jsonStr = extractJson(raw);
    const data = JSON.parse(jsonStr);
    return {
      provider: 'minimax',
      fidelityScore: clamp(data.fidelityScore ?? 0),
      differences: (data.differences ?? []).map((d: any) => ({
        region: d.region ?? '',
        type: d.type ?? 'other',
        description: d.description ?? '',
      })),
      findings: (data.findings ?? []).map((f: any) => ({
        severity: f.severity ?? 'P2', region: f.region ?? '', issue: f.issue ?? '', fix: f.fix ?? '',
      })),
      modelUsed: model,
    };
  } catch {
    return { provider: 'minimax', fidelityScore: 0, differences: [], findings: [], modelUsed: model };
  }
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) return text.slice(firstBrace, lastBrace + 1);
  return text;
}

function clamp(n: unknown, lo = 0, hi = 1): number {
  const v = Number(n);
  return isNaN(v) ? 0 : Math.max(lo, Math.min(hi, v));
}
