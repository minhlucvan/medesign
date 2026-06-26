import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ensureDir, type RepoPaths } from './paths.js';
import { effectiveAdapter } from './adapters/index.js';

const pexecFile = promisify(execFile);

/**
 * Promotes a generated (work-in-progress) component into a reusable, documented component.
 *
 * Phase 0: moves `src/generated/<Name>.tsx` + `<Name>.stories.tsx` into `src/components/`,
 * prepends a doc header, and `git add`s the result. This is the "reusable-by-default capture"
 * pillar — generated UI becomes a real, versioned component, never a one-off snippet.
 */
export async function captureComponent(paths: RepoPaths, name: string): Promise<string> {
  const safe = sanitize(name);
  const a = effectiveAdapter(paths);
  const fromComp = path.join(paths.generatedDir, `${safe}${a.fileExt}`);
  const fromStory = path.join(paths.generatedDir, `${safe}${a.storyExt}`);
  if (!fs.existsSync(fromComp)) {
    throw new Error(`No generated component at ${fromComp}. Generate it first.`);
  }

  const destDir = path.join(paths.componentsDir, safe);
  ensureDir(destDir);

  const header =
    `/**\n * ${safe} — captured by medesign.\n * Reusable, design-system-bound component. Edit freely; re-capture to update.\n */\n`;
  const compSrc = fs.readFileSync(fromComp, 'utf8');
  fs.writeFileSync(path.join(destDir, `${safe}${a.fileExt}`), header + compSrc);

  if (fs.existsSync(fromStory)) {
    fs.writeFileSync(path.join(destDir, `${safe}${a.storyExt}`), fs.readFileSync(fromStory, 'utf8'));
  }

  // Best-effort git add (repo may not be initialized yet in Phase 0).
  try {
    await pexecFile('git', ['add', destDir], { cwd: paths.root });
  } catch {
    /* not a git repo yet — capture still succeeded on disk */
  }

  return destDir;
}

function sanitize(name: string): string {
  const base = name.replace(/[^A-Za-z0-9]/g, '');
  if (!base) throw new Error(`Invalid component name: ${name}`);
  return base[0].toUpperCase() + base.slice(1);
}
