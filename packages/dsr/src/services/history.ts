import fs from 'node:fs';
import path from 'node:path';
import type { DesignSystem } from '../domain/designSystem.js';

/** A point-in-time fingerprint of a design system (committed under .history/). */
export interface Snapshot {
  id: string;
  at: string; // ISO timestamp
  tokens: Record<string, string>; // role → value
  sections: string[];
  components: string[];
  rulesExempted: string[];
}

export interface HistoryDiff {
  from: string;
  to: string;
  tokens: { added: string[]; removed: string[]; changed: Array<{ role: string; from: string; to: string }> };
  components: { added: string[]; removed: string[] };
  sections: { added: string[]; removed: string[] };
}

function historyDir(ds: DesignSystem, designSystemsDir: string): string {
  return path.join(designSystemsDir, ds.id, '.history');
}

function fingerprintOf(ds: DesignSystem): Omit<Snapshot, 'at'> {
  const tokens: Record<string, string> = {};
  for (const t of ds.tokens()) tokens[t.role] = t.value;
  return {
    id: ds.id,
    tokens,
    sections: ds.sections().map((s) => s.title),
    components: ds.components().map((c) => c.name).sort(),
    rulesExempted: ds.exemptions,
  };
}

/** Write a committed snapshot under design-systems/<id>/.history/<ISO>.json. */
export function snapshot(ds: DesignSystem, designSystemsDir: string, at = new Date().toISOString()): string {
  const dir = historyDir(ds, designSystemsDir);
  fs.mkdirSync(dir, { recursive: true });
  const snap: Snapshot = { at, ...fingerprintOf(ds) };
  const file = path.join(dir, `${at.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(snap, null, 2));
  return file;
}

export function listSnapshots(ds: DesignSystem, designSystemsDir: string): Snapshot[] {
  const dir = historyDir(ds, designSystemsDir);
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
      .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Snapshot);
  } catch { return []; }
}

/** Structured diff between two snapshots. */
export function diffSnapshots(a: Snapshot, b: Snapshot): HistoryDiff {
  const aRoles = new Set(Object.keys(a.tokens));
  const bRoles = new Set(Object.keys(b.tokens));
  const changed: HistoryDiff['tokens']['changed'] = [];
  for (const r of bRoles) if (aRoles.has(r) && a.tokens[r] !== b.tokens[r]) changed.push({ role: r, from: a.tokens[r], to: b.tokens[r] });
  const setDiff = (from: string[], to: string[]) => ({ added: to.filter((x) => !from.includes(x)), removed: from.filter((x) => !to.includes(x)) });
  return {
    from: a.at,
    to: b.at,
    tokens: { added: [...bRoles].filter((r) => !aRoles.has(r)), removed: [...aRoles].filter((r) => !bRoles.has(r)), changed },
    components: setDiff(a.components, b.components),
    sections: setDiff(a.sections, b.sections),
  };
}

/** Diff the current state of `ds` against its latest committed snapshot. */
export function diffAgainstLatest(ds: DesignSystem, designSystemsDir: string): HistoryDiff | null {
  const snaps = listSnapshots(ds, designSystemsDir);
  if (snaps.length === 0) return null;
  const current: Snapshot = { at: 'working', ...fingerprintOf(ds) };
  return diffSnapshots(snaps[snaps.length - 1], current);
}
