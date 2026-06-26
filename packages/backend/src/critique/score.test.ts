import { describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { scoreComponent } from './score.js';
import type { RepoPaths } from '../paths.js';

/** Create a minimal RepoPaths pointing at a temp dir for baseline I/O tests. */
function tmpPaths(): RepoPaths {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'emdesign-test-'));
  return {
    root,
    framework: 'react-tailwind',
    plugins: ['react', 'css', 'tailwind'],
    storybookUrl: 'http://localhost:6006',
    emdesignDir: path.join(root, '.emdesign'),
    stateFile: path.join(root, '.emdesign', 'state.json'),
    designSystemsDir: path.join(root, 'design-systems'),
    studioDir: root,
    generatedDir: path.join(root, 'src', 'generated'),
    componentsDir: path.join(root, 'src', 'components'),
    screenshotsDir: path.join(root, '__screenshots__'),
  };
}

function cleanup(paths: RepoPaths): void {
  fs.rmSync(paths.root, { recursive: true, force: true });
}

describe('scoreComponent', () => {
  describe('basic scoring', () => {
    it('ships when all scores perfect and mustFix 0', () => {
      const result = scoreComponent(tmpPaths(), {
        scores: { tokens: 1, visual: 1, vision: 1, llm: 1, a11y: 1 },
        mustFix: 0,
      });
      expect(result.decision).toBe('ship');
      expect(result.composite).toBeCloseTo(1.0, 3);
      expect(result.unsatisfiedConditions).toHaveLength(0);
    });

    it('revises when mustFix > 0', () => {
      const result = scoreComponent(tmpPaths(), {
        scores: { tokens: 0.95, visual: 0.95, vision: 0.95, llm: 0.95 },
        mustFix: 1,
      });
      expect(result.decision).toBe('revise');
      expect(result.unsatisfiedConditions).toContainEqual(expect.stringContaining('mustFix'));
    });

    it('revises when composite below threshold', () => {
      const result = scoreComponent(tmpPaths(), {
        scores: { tokens: 0.3, visual: 0.3 },
        mustFix: 0,
      });
      expect(result.decision).toBe('revise');
      expect(result.unsatisfiedConditions).toContainEqual(expect.stringContaining('below threshold'));
    });

    it('revises when source score below floor', () => {
      const result = scoreComponent(tmpPaths(), {
        scores: { tokens: 1, visual: 0.2 }, // visual 0.2 < 0.85 floor
        mustFix: 0,
      });
      expect(result.decision).toBe('revise');
      expect(result.unsatisfiedConditions).toContainEqual(expect.stringContaining('below floor'));
    });
  });

  describe('per-source baseline ratchet', () => {
    it('stores baseline on ship and enforces non-regression on composite', () => {
      const paths = tmpPaths();
      try {
        // First ship: no baseline exists, should pass and create one
        const r1 = scoreComponent(paths, {
          scores: { tokens: 0.9, visual: 0.9, vision: 0.9 },
          mustFix: 0,
          component: 'TestComp',
        });
        expect(r1.decision).toBe('ship');
        expect(r1.ratchetPass).toBe(true);

        // Regression: lower composite should fail ratchet
        const r2 = scoreComponent(paths, {
          scores: { tokens: 0.5, visual: 0.5, vision: 0.5 },
          mustFix: 0,
          component: 'TestComp',
        });
        expect(r2.decision).toBe('revise');
        expect(r2.ratchetPass).toBe(false);
        expect(r2.unsatisfiedConditions).toContainEqual(expect.stringContaining('below stored baseline'));
      } finally {
        cleanup(paths);
      }
    });

    it('enforces per-source non-regression even when composite is higher', () => {
      const paths = tmpPaths();
      try {
        // First baseline: all scores above default floors
        const r1 = scoreComponent(paths, {
          scores: { tokens: 0.9, visual: 0.9, vision: 0.9 },
          mustFix: 0,
          component: 'PerSourceComp',
        });
        expect(r1.decision).toBe('ship');

        // Higher composite but tokens regressed (0.7 < 0.9 baseline)
        const r2 = scoreComponent(paths, {
          scores: { tokens: 0.7, visual: 0.95, vision: 0.95 },
          mustFix: 0,
          component: 'PerSourceComp',
        });
        expect(r2.ratchetPass).toBe(false);
      } finally {
        cleanup(paths);
      }
    });

    it('passes baseline check for a new component (no prior baseline)', () => {
      const paths = tmpPaths();
      try {
        const result = scoreComponent(paths, {
          scores: { tokens: 0.85 },
          mustFix: 0,
          component: 'NewComponent',
        });
        expect(result.decision).toBe('ship');
        expect(result.baseline).toBeNull();
      } finally {
        cleanup(paths);
      }
    });

    it('does not regress baseline on a lower score', () => {
      const paths = tmpPaths();
      try {
        const r1 = scoreComponent(paths, {
          scores: { tokens: 0.9, visual: 0.9 },
          mustFix: 0,
          component: 'NoRegress',
        });
        expect(r1.decision).toBe('ship');

        // tokens lower than baseline but visual higher → ratchet should fail on per-source
        const r2 = scoreComponent(paths, {
          scores: { tokens: 0.85, visual: 0.95 },
          mustFix: 0,
          component: 'NoRegress',
        });
        expect(r2.decision).toBe('revise');
      } finally {
        cleanup(paths);
      }
    });
  });

  describe('per-source floor checks', () => {
    it('uses default floors when not specified', () => {
      const result = scoreComponent(tmpPaths(), {
        scores: { vision: 0.5, tokens: 0.9, visual: 0.9 },
        mustFix: 0,
      });
      expect(result.unsatisfiedConditions).toContainEqual(expect.stringContaining('below floor'));
    });

    it('uses custom floors when provided', () => {
      const result = scoreComponent(tmpPaths(), {
        scores: { tokens: 0.75 },
        mustFix: 0,
        sourceFloors: { tokens: 0.8 },
      });
      expect(result.unsatisfiedConditions).toContainEqual(expect.stringContaining('below floor'));
    });
  });

  describe('backward-compatible baseline format', () => {
    it('handles old-format baselines (just a number)', () => {
      const paths = tmpPaths();
      try {
        // Manually write an old-format baseline
        fs.mkdirSync(paths.emdesignDir, { recursive: true });
        fs.writeFileSync(
          path.join(paths.emdesignDir, 'baselines.json'),
          JSON.stringify({ OldFormat: 0.85 }),
        );

        const result = scoreComponent(paths, {
          scores: { tokens: 0.9, visual: 0.9 },
          mustFix: 0,
          component: 'OldFormat',
        });
        // Composite (0.9) >= baseline (0.85) → ship
        expect(result.decision).toBe('ship');
        expect(result.baseline).toBe(0.85);
      } finally {
        cleanup(paths);
      }
    });
  });
});
