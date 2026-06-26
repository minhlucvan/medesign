/**
 * @medesign/workspace — the abstract workspace core: the opt-in installer (init/attach), the
 * framework registry, and the canonical `.claude/` template. Concrete stacks (e.g.
 * @medesign/workspace-react) provide the Storybook scaffold + a server adapter.
 */
export { attach, init } from './install.js';
export type { InstallResult } from './install.js';
export { update } from './update.js';
export type { UpdateOptions, UpdateResult, UpdateEntry } from './update.js';
export { FRAMEWORKS, listFrameworks, detectFramework } from './registry.js';
export type { FrameworkEntry } from './registry.js';
