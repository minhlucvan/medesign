/**
 * Element Charters — filesystem loader.
 *
 * Discovers and loads Element Charters from a design system's charters/ directory.
 * Supports dynamic import of pre-compiled .js files, with fallback to directory scan.
 *
 * Also provides loadFrameworkCharters() — the always-on, engine-shipped charters
 * (geometry rules, spacing validation, etc.) that apply regardless of design system.
 */

import { type ElementCharter } from './charter.js';
import { FRAMEWORK_GEOMETRY_CHARTERS } from './geometry/index.js';

export interface EcLoaderOptions {
  /** Absolute path to the charters/ directory, e.g. "/repo/design-systems/atelier/charters" */
  chartersDir: string;
}

/**
 * Load the framework-level, always-on charters.
 *
 * These ship with the engine and validate spatial/geometry invariants across ALL
 * design systems and components. They complement DS-level charters
 * (loaded via loadElementCharters) by providing universal guarantees:
 *
 *  - geometry/no-overlap:         No sibling elements overlap
 *  - geometry/no-child-overflow:  No child element overflows its parent
 *
 * Returns a fresh array each call (immutable list of charter instances).
 */
export function loadFrameworkCharters(): ElementCharter[] {
  return [...FRAMEWORK_GEOMETRY_CHARTERS];
}

/**
 * Load all Element Charters from a design system's charters/ directory.
 *
 * Discovery strategy:
 * 1. If `index.js` exists, import it and use its default export (preferred)
 * 2. Otherwise, scan for individual .js files
 *
 * Returns an empty array if no charters directory or no charters found.
 */
export async function loadElementCharters(
  opts: EcLoaderOptions,
): Promise<ElementCharter[]> {
  const fs = await import('node:fs');
  const path = await import('node:path');

  if (!fs.existsSync(opts.chartersDir)) {
    return [];
  }

  // Strategy 1: index.js aggregator
  const indexPath = path.join(opts.chartersDir, 'index.js');
  const indexTsPath = path.join(opts.chartersDir, 'index.ts');
  const indexExists = fs.existsSync(indexPath) || fs.existsSync(indexTsPath);

  if (indexExists) {
    try {
      const resolvedPath = fs.existsSync(indexPath) ? indexPath : indexTsPath;
      const mod = await import(resolvedPath);
      const charters = mod.default ?? [];
      if (Array.isArray(charters)) {
        return validateCharters(charters);
      }
      console.warn(`[ec] ${resolvedPath}: default export is not an array, falling back to scan`);
    } catch (err) {
      console.warn(`[ec] Failed to load index from ${opts.chartersDir}:`, err);
      // Fall through to strategy 2
    }
  }

  // Strategy 2: scan for individual .js / .ts files
  try {
    const files = fs.readdirSync(opts.chartersDir);
    const charterFiles = files.filter(
      (f: string) =>
        /\.(js|ts)$/.test(f) &&
        f !== 'index.ts' &&
        f !== 'index.js' &&
        !f.endsWith('.d.ts'),
    );

    const charters: ElementCharter[] = [];
    for (const file of charterFiles) {
      try {
        const mod = await import(path.join(opts.chartersDir, file));
        // Accept named exports or default export
        if (mod.default) {
          if (Array.isArray(mod.default)) {
            charters.push(...mod.default);
          } else {
            charters.push(mod.default);
          }
        } else {
          // Named exports: look for anything implementing ElementCharter
          for (const key of Object.keys(mod)) {
            const val = mod[key];
            if (val && typeof val === 'object' && val.name && val.matcher && val.run) {
              charters.push(val);
            }
          }
        }
      } catch (err) {
        console.warn(`[ec] Failed to load ${file}:`, err);
      }
    }

    return validateCharters(charters);
  } catch {
    return [];
  }
}

/**
 * Validate that all loaded charters have the required fields.
 */
function validateCharters(charters: ElementCharter[]): ElementCharter[] {
  return charters.filter((c) => {
    if (!c.name || typeof c.name !== 'string') {
      console.warn(`[ec] Skipping charter: missing or invalid 'name'`);
      return false;
    }
    if (!c.matcher) {
      console.warn(`[ec] Skipping charter "${c.name}": missing 'matcher'`);
      return false;
    }
    if (typeof c.run !== 'function') {
      console.warn(`[ec] Skipping charter "${c.name}": missing or invalid 'run' function`);
      return false;
    }
    return true;
  });
}
