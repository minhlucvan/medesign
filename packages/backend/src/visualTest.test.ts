import { describe, expect, it } from 'vitest';
import { toStoryId, toVisualScore, checkStorybookHealth } from './visualTest.js';

describe('toStoryId', () => {
  it('converts single-word PascalCase', () => {
    expect(toStoryId('Button')).toBe('generated-button--default');
  });

  it('converts multi-word PascalCase with dash insertion', () => {
    expect(toStoryId('PricingTiers')).toBe('generated-pricing-tiers--default');
    expect(toStoryId('UserAvatar')).toBe('generated-user-avatar--default');
    expect(toStoryId('HeroBanner')).toBe('generated-hero-banner--default');
  });

  it('handles acronyms at the start', () => {
    expect(toStoryId('CTAAction')).toBe('generated-cta-action--default');
    expect(toStoryId('URLInput')).toBe('generated-url-input--default');
  });

  it('handles consecutive uppercase letters', () => {
    expect(toStoryId('ParseJSON')).toBe('generated-parse-json--default');
    expect(toStoryId('SVGRenderer')).toBe('generated-svg-renderer--default');
  });

  it('handles numbers in names', () => {
    // "Card3D": digit 3 → uppercase D, so "card-3-d". PlanV2: no uppercase→lowercase boundary after V, so "plan-v2".
    expect(toStoryId('Card3D')).toBe('generated-card3-d--default');
    expect(toStoryId('PlanV2')).toBe('generated-plan-v2--default');
  });

  it('uses custom story name and prefix', () => {
    expect(toStoryId('Button', 'primary', 'components')).toBe('components-button--primary');
    expect(toStoryId('PricingTiers', 'dark', 'generated')).toBe('generated-pricing-tiers--dark');
  });

  it('normalizes to lowercase', () => {
    expect(toStoryId('BUTTON')).toBe('generated-button--default');
  });
});

describe('toVisualScore', () => {
  it('returns 1.0 for pass', () => {
    expect(toVisualScore('pass')).toBe(1.0);
  });

  it('returns 1.0 for new', () => {
    expect(toVisualScore('new')).toBe(1.0);
  });

  it('returns 0.5 for changed', () => {
    expect(toVisualScore('changed')).toBe(0.5);
  });

  it('returns 0.0 for error', () => {
    expect(toVisualScore('error')).toBe(0.0);
  });
});

describe('checkStorybookHealth', () => {
  it('returns error message for unreachable URL', async () => {
    const result = await checkStorybookHealth('http://localhost:1', 500);
    expect(result).toBeTruthy();
    expect(result).toContain('unreachable');
  });
});
