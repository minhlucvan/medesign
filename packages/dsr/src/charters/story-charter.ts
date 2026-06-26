/**
 * Story Charters — component/story-level validation for Storybook.
 *
 * A lighter-weight sibling of the DS-level `ElementCharter` (see ./charter.ts).
 * Story charters are defined inline in CSF files and assert structural properties
 * of the rendered DOM: presence of elements, ARIA roles, text content, layout
 * relationships, and token usage.
 *
 * Three tiers:
 * 1. **Component charters** — `meta.charters`, run against every story of the component
 * 2. **Story charters** — `MyStory.charters`, run against that specific story
 * 3. **Inline charters** — one-off assertions expressed inline in a story definition
 */

import type { RenderSnapshot, RenderNode } from '../rules/rendered.js';
import type { Severity } from '../domain/values.js';

// ---------------------------------------------------------------------------
// StoryCharter
// ---------------------------------------------------------------------------

/**
 * A charter defined at the story or component level in CSF.
 *
 * Compared to the DS-level `ElementCharter`:
 * - Simpler: no matcher needed — the charter always runs against the story root
 * - Throw-to-fail: `run()` throws on failure, returns normally on pass
 * - DOM-native: access the live rendered DOM, not just RenderSnapshot
 * - No `target` field needed — the story root is implicit
 */
export interface StoryCharter {
  /** Unique name within the component namespace, e.g. "title-visible" */
  name: string;
  /** Human-readable description of the assertion */
  description: string;
  /** Default severity when the assertion fails */
  severity: Severity;
  /**
   * Optional CSS selector to identify the target element for display in the UI.
   * If omitted, the story root is assumed.
   */
  target?: string;
  /**
   * The validation function.
   *
   * Receives a `StoryCharterContext` with DOM query helpers scoped to the story root.
   * Throw to record a failure; return to pass. Can be async.
   *
   * @example
   * ```ts
   * async run({ getByRole }) {
   *   const heading = await getByRole('heading', { level: 3 });
   *   if (!heading) throw new Error('Card must render an h3 heading');
   * }
   * ```
   */
  run(ctx: StoryCharterContext): Promise<void> | void;
}

// ---------------------------------------------------------------------------
// StoryCharterContext
// ---------------------------------------------------------------------------

/**
 * The context passed to a StoryCharter's `run()` function.
 *
 * Provides DOM query helpers scoped to the story root (`#storybook-root`).
 * All queries are relative to the story container.
 */
export interface StoryCharterContext {
  /** The story-root DOM element (the `#storybook-root` container) */
  container: HTMLElement;
  /** The render-probe snapshot data for this story (computed styles, layout) */
  snapshot?: RenderSnapshot;
  /**
   * Find an element by its exact text content.
   * @param text The text to search for
   * @param exact When true (default), matches exact text content
   */
  getByText(text: string, exact?: boolean): HTMLElement | null;
  /**
   * Asynchronously find an element by its ARIA role.
   * Supports waiting for the element to appear (for async rendering).
   */
  getByRole(role: string, options?: { level?: number; timeout?: number }): Promise<HTMLElement | null>;
  /** Query an element by CSS selector relative to the story root */
  querySelector(selector: string): HTMLElement | null;
  /** Query all matching elements by CSS selector relative to the story root */
  querySelectorAll(selector: string): HTMLElement[];
}

// ---------------------------------------------------------------------------
// Finding
// ---------------------------------------------------------------------------

/**
 * A finding produced by evaluating a StoryCharter.
 * Mirrors the shape of `EcFinding` from the DS-level charter system so findings
 * can be merged into the same diagnostic pipeline.
 */
export interface StoryCharterFinding {
  /** Machine-readable id, e.g. "charter/card/title-visible" */
  id: string;
  /** The component name this finding applies to */
  component: string;
  /** The story name this finding applies to */
  story: string;
  /** The charter name that produced this finding */
  charterName: string;
  severity: Severity;
  /** Whether the charter assertion passed */
  pass: boolean;
  /** Human-readable message (the error message if failed) */
  message: string;
  /** Optional target selector for UI display */
  target?: string;
  /** Optional remediation hint */
  fix?: string;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/** Aggregated result of evaluating a set of charters for a component/story. */
export interface StoryCharterResult {
  /** The component name */
  component: string;
  /** The story name */
  story: string;
  /** All findings (pass + fail) */
  findings: StoryCharterFinding[];
  /** Number of passing charters */
  passed: number;
  /** Number of failing charters */
  failed: number;
  /** True if all charters pass */
  allPass: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fully-populated StoryCharterResult from an array of findings. */
export function buildResult(component: string, story: string, findings: StoryCharterFinding[]): StoryCharterResult {
  const passed = findings.filter((f) => f.pass).length;
  const failed = findings.length - passed;
  return { component, story, findings, passed, failed, allPass: failed === 0 };
}
