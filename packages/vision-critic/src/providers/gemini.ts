import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { VisionProvider, VisionContext, VisionCritiqueResult, VisionCompareResult } from '../types.js';
import { buildVisionPrompt } from '../prompt/builder.js';
import { STANDARD_CRITIQUE_SYSTEM, REFERENCE_COMPARISON_SYSTEM } from '../prompt/templates.js';
import { guessMimeFromPath, resizeImageIfNeeded } from '../image/processing.js';

const API_KEY_ENV = 'GEMINI_API_KEY';
const DEFAULT_MODEL = 'gemini-2.5-pro-exp-03-25';

/**
 * Gemini vision provider — uses Google Generative AI SDK with native JSON output mode.
 * Gemini supports response_schema for guaranteed structured output.
 */
export const geminiProvider: VisionProvider = {
  id: 'gemini',
  name: 'Gemini 2.5 Pro',

  available(): boolean {
    return !!process.env[API_KEY_ENV];
  },

  async critique(imageBuffer: Buffer, imageMime: string, ctx: VisionContext): Promise<VisionCritiqueResult> {
    const modelName = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
    const apiKey = process.env[API_KEY_ENV];
    if (!apiKey) {
      return {
        provider: 'gemini',
        axes: {},
        visionScore: 0,
        findings: [{ severity: 'P0', region: 'system', issue: `Gemini API key not set (${API_KEY_ENV})`, fix: `Set ${API_KEY_ENV} in your environment.` }],
        modelUsed: modelName,
      };
    }

    const { buffer: resized } = await resizeImageIfNeeded(imageBuffer, 'gemini');
    const { user } = buildVisionPrompt(ctx, 'standard');

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              axes: {
                type: SchemaType.OBJECT,
                properties: {
                  hierarchy: { type: SchemaType.NUMBER },
                  balance: { type: SchemaType.NUMBER },
                  spacingRhythm: { type: SchemaType.NUMBER },
                  onBrand: { type: SchemaType.NUMBER },
                  polish: { type: SchemaType.NUMBER },
                },
                required: ['hierarchy', 'balance', 'spacingRhythm', 'onBrand', 'polish'],
              },
              visionScore: { type: SchemaType.NUMBER },
              findings: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    severity: { type: SchemaType.STRING },
                    region: { type: SchemaType.STRING },
                    issue: { type: SchemaType.STRING },
                    fix: { type: SchemaType.STRING },
                  },
                  required: ['severity', 'region', 'issue', 'fix'],
                },
              },
            },
            required: ['axes', 'visionScore', 'findings'],
          },
        },
        systemInstruction: STANDARD_CRITIQUE_SYSTEM,
      });

      const result = await model.generateContent([
        { text: user },
        {
          inlineData: {
            mimeType: imageMime,
            data: resized.toString('base64'),
          },
        },
      ]);

      const raw = result.response.text();
      return parseGeminiResponse(raw, modelName);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        provider: 'gemini',
        axes: {},
        visionScore: 0,
        findings: [{ severity: 'P0', region: 'system', issue: `Gemini API error: ${message}`, fix: 'Check API key, network, and model availability.' }],
        modelUsed: modelName,
        raw: message,
      };
    }
  },

  async compare(referenceImage: Buffer, actualImage: Buffer, ctx: VisionContext): Promise<VisionCompareResult> {
    const modelName = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
    const apiKey = process.env[API_KEY_ENV];
    if (!apiKey) {
      return {
        provider: 'gemini',
        fidelityScore: 0,
        differences: [],
        findings: [{ severity: 'P0', region: 'system', issue: `Gemini API key not set (${API_KEY_ENV})`, fix: `Set ${API_KEY_ENV} in your environment.` }],
        modelUsed: modelName,
      };
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              fidelityScore: { type: SchemaType.NUMBER },
              differences: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    region: { type: SchemaType.STRING },
                    type: { type: SchemaType.STRING },
                    description: { type: SchemaType.STRING },
                  },
                  required: ['region', 'type', 'description'],
                },
              },
              findings: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    severity: { type: SchemaType.STRING },
                    region: { type: SchemaType.STRING },
                    issue: { type: SchemaType.STRING },
                    fix: { type: SchemaType.STRING },
                  },
                  required: ['severity', 'region', 'issue', 'fix'],
                },
              },
            },
            required: ['fidelityScore', 'differences', 'findings'],
          },
        },
        systemInstruction: REFERENCE_COMPARISON_SYSTEM,
      });

      const result = await model.generateContent([
        { text: 'Reference (intended design):' },
        { inlineData: { mimeType: 'image/png', data: referenceImage.toString('base64') } },
        { text: 'Actual (rendered component):' },
        { inlineData: { mimeType: 'image/png', data: actualImage.toString('base64') } },
      ]);

      const raw = result.response.text();
      return parseGeminiCompareResponse(raw, modelName);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        provider: 'gemini',
        fidelityScore: 0,
        differences: [],
        findings: [{ severity: 'P0', region: 'system', issue: `Gemini API error: ${message}`, fix: 'Check API key and network.' }],
        modelUsed: modelName,
      };
    }
  },
};

function parseGeminiResponse(raw: string, model: string): VisionCritiqueResult {
  try {
    const data = JSON.parse(raw);
    return {
      provider: 'gemini',
      axes: {
        hierarchy: clamp(data.axes?.hierarchy),
        balance: clamp(data.axes?.balance),
        spacingRhythm: clamp(data.axes?.spacingRhythm),
        onBrand: clamp(data.axes?.onBrand),
        polish: clamp(data.axes?.polish),
      },
      visionScore: clamp(data.visionScore ?? 0),
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
      provider: 'gemini',
      axes: {},
      visionScore: 0,
      findings: [{ severity: 'P2', region: 'parse', issue: 'Could not parse Gemini response as JSON', fix: '' }],
      modelUsed: model,
      raw,
    };
  }
}

function parseGeminiCompareResponse(raw: string, model: string): VisionCompareResult {
  try {
    const data = JSON.parse(raw);
    return {
      provider: 'gemini',
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
      provider: 'gemini',
      fidelityScore: 0,
      differences: [],
      findings: [{ severity: 'P2', region: 'parse', issue: 'Could not parse Gemini response as JSON', fix: '' }],
      modelUsed: model,
    };
  }
}

function clamp(n: unknown, lo = 0, hi = 1): number {
  const v = Number(n);
  return isNaN(v) ? 0 : Math.max(lo, Math.min(hi, v));
}
