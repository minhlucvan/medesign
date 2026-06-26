import path from 'node:path';
import { createRuntime, type DesignSystemRuntime } from '@medesign/dsr';
import type { RepoPaths } from './paths.js';
import { effectiveAdapter } from './adapters/index.js';

/**
 * Construct a DesignSystemRuntime targeting the active project — the domain interface the backend
 * uses for design-system operations (validate, conflicts, references, history, rule evaluation).
 * Framework parse mode comes from the active adapter.
 */
export function runtimeFor(paths: RepoPaths): DesignSystemRuntime {
  const adapter = effectiveAdapter(paths);
  return createRuntime({
    designSystemsDir: paths.designSystemsDir,
    skillsDir: path.join(paths.root, 'skills'),
    parseCode: adapter.parsesCode,
    componentExt: adapter.fileExt,
    parsers: adapter.graphParsers(),
    classRoles: adapter.classRoles(),
  });
}
