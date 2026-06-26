import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, type RepoPaths } from './paths.js';

/** Evidence store for a design change: per-round scores + screenshots, under design/changes/<slug>/evidence/. */
export function evidenceDir(paths: RepoPaths, slug: string): string {
  return path.join(paths.root, 'design', 'changes', slug, 'evidence');
}

export interface EvidenceRound {
  round: number;
  scores: Record<string, number>;
  mustFix: number;
  composite: number;
  decision: string;
  notes?: string;
}

/** Append a round's scores as JSON and copy the current screenshot as proof. */
export function recordEvidence(paths: RepoPaths, slug: string, round: EvidenceRound, component?: string): string {
  const dir = evidenceDir(paths, slug);
  ensureDir(dir);
  const file = path.join(dir, `round-${round.round}.json`);
  fs.writeFileSync(file, JSON.stringify(round, null, 2));

  if (component) {
    const shot = path.join(paths.screenshotsDir, `${component}.actual.png`);
    if (fs.existsSync(shot)) fs.copyFileSync(shot, path.join(dir, `round-${round.round}.png`));
  }
  return file;
}
