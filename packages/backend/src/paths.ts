import path from 'node:path';
import fs from 'node:fs';

/**
 * medesign config (medesign.config.json at the project root). Lets the server target ANY
 * project — the dogfood workspace (apps/workspace-react) or an attached existing Storybook repo.
 * All dir fields are relative to the project root (where this config lives).
 */
export interface MedesignConfig {
  framework: string;
  /** Ordered plugin stack, e.g. ["react","tailwind","shadcn"]. If absent, derived from `framework`. */
  plugins?: string[];
  storybookUrl: string;
  generatedDir: string;
  componentsDir: string;
  designSystemsDir: string;
  screenshotsDir: string;
}

/** Map a legacy single `framework` id to a plugin stack (back-compat). */
export function frameworkToStack(framework: string): string[] {
  if (framework === 'react-tailwind') return ['react', 'css', 'tailwind'];
  return [framework];
}

const DEFAULT_CONFIG: MedesignConfig = {
  framework: 'react-tailwind',
  storybookUrl: 'http://localhost:6006',
  generatedDir: 'src/generated',
  componentsDir: 'src/components',
  designSystemsDir: 'design-systems',
  screenshotsDir: '__screenshots__',
};

export function readConfig(root: string): MedesignConfig {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(path.join(root, 'medesign.config.json'), 'utf8')) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Resolves the well-known locations medesign reads/writes inside a project. Everything is
 * code-first and lives in the project — no proprietary store. Driven by medesign.config.json.
 */
export interface RepoPaths {
  root: string;
  framework: string;
  /** Resolved ordered plugin stack (from config.plugins, else derived from framework). */
  plugins: string[];
  storybookUrl: string;
  /** Where the medesign state store + run artifacts live. */
  medesignDir: string;
  stateFile: string;
  /** design-systems/<name>/ (DESIGN.md + tokens.css + code/). */
  designSystemsDir: string;
  /** The Storybook host root (holds .storybook/). For a project, this is the root itself. */
  studioDir: string;
  /** Generated (work-in-progress) components + stories. */
  generatedDir: string;
  /** Captured, reusable components. */
  componentsDir: string;
  /** Visual-test baselines + actual/diff images. */
  screenshotsDir: string;
}

export function resolveRepoPaths(root = process.cwd()): RepoPaths {
  const cfg = readConfig(root);
  const abs = (p: string) => path.resolve(root, p);
  const medesignDir = path.join(root, '.medesign');
  return {
    root,
    framework: cfg.framework,
    plugins: cfg.plugins?.length ? cfg.plugins : frameworkToStack(cfg.framework),
    storybookUrl: cfg.storybookUrl,
    medesignDir,
    stateFile: path.join(medesignDir, 'state.json'),
    designSystemsDir: abs(cfg.designSystemsDir),
    studioDir: root,
    generatedDir: abs(cfg.generatedDir),
    componentsDir: abs(cfg.componentsDir),
    screenshotsDir: abs(cfg.screenshotsDir),
  };
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Map a design-system reference to its path (relative to designSystemsDir). A plain id stays as-is;
 * the vendored-base shorthand `open-design/<id>` (and the canonical `_vendor/open-design/<id>`) both
 * resolve under `_vendor/open-design/`. Vendored bases live under a `_`-prefixed dir so they're
 * excluded from the active-system scan (listDesignSystems) yet still cloneable as import sources.
 */
export function normalizeDsRef(ref: string): string {
  const r = ref.replace(/^\.?\/+/, '').replace(/\\/g, '/');
  if (r.startsWith('_vendor/')) return r;
  const m = /^open-design\/(.+)$/.exec(r);
  return m ? `_vendor/open-design/${m[1]}` : r;
}
