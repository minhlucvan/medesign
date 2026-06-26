import { describe, expect, it } from 'vitest';
import { toStoryId, toVisualScore, checkStorybookHealth } from './visualTest.js';

describe('toStoryId', () => {
  it('converts single-word PascalCase', () => {
    expect(toStoryId('Button')).toBe('generated-button--default');
  });

  it('converts multi-word PascalCase by lowercasing only (matches Storybook 8 behavior)', () => {
    expect(toStoryId('PricingTiers')).toBe('generated-pricingtiers--default');
    expect(toStoryId('UserAvatar')).toBe('generated-useravatar--default');
    expect(toStoryId('HeroBanner')).toBe('generated-herobanner--default');
  });

  it('handles acronyms by lowercasing only', () => {
    expect(toStoryId('CTAAction')).toBe('generated-ctaaction--default');
    expect(toStoryId('URLInput')).toBe('generated-urlinput--default');
  });

  it('handles consecutive uppercase letters', () => {
    expect(toStoryId('ParseJSON')).toBe('generated-parsejson--default');
    expect(toStoryId('SVGRenderer')).toBe('generated-svgrenderer--default');
  });

  it('handles numbers in names', () => {
    expect(toStoryId('Card3D')).toBe('generated-card3d--default');
    expect(toStoryId('PlanV2')).toBe('generated-planv2--default');
  });

  it('uses custom story name and prefix', () => {
    expect(toStoryId('Button', 'primary', 'components')).toBe('components-button--primary');
    expect(toStoryId('PricingTiers', 'dark', 'generated')).toBe('generated-pricingtiers--dark');
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
