import type { VisionProvider, VisionContext, VisionCritiqueResult, VisionCompareResult } from '../src/types.js';

/** A mock provider that returns predetermined results — useful for testing downstream logic. */
export function createMockProvider(overrides?: Partial<VisionProvider>): VisionProvider {
  return {
    id: 'mock',
    name: 'Mock Provider',
    available: () => true,
    critique: async () => ({
      provider: 'mock',
      axes: { hierarchy: 0.8, balance: 0.7, spacingRhythm: 0.6, onBrand: 0.9, polish: 0.75 },
      visionScore: 0.77,
      findings: [
        { severity: 'P0', region: 'header', issue: 'CTA too prominent', fix: 'Reduce font weight' },
        { severity: 'P1', region: 'sidebar', issue: 'Inconsistent spacing', fix: 'Use --space-4' },
      ],
      modelUsed: 'mock-model',
    }),
    compare: async () => ({
      provider: 'mock',
      fidelityScore: 0.85,
      differences: [{ region: 'button', type: 'wrong-color', description: 'CTA is blue, reference is green' }],
      findings: [],
      modelUsed: 'mock-model',
    }),
    ...overrides,
  };
}

/** A default VisionContext for tests. */
export function testContext(overrides?: Partial<VisionContext>): VisionContext {
  return {
    component: 'TestComponent',
    screenshotPath: '/tmp/test-screenshot.png',
    designContext: 'A minimal test design system.',
    ...overrides,
  };
}

/** A minimal 1×1 PNG for testing image processing. */
export function minimalPngBuffer(): Buffer {
  // 1x1 red pixel PNG (iVBOR...)
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';
  return Buffer.from(b64, 'base64');
}
