/**
 * Story Charters — preview iframe integration.
 *
 * This module runs inside the Storybook preview iframe. It:
 * 1. Defines a global decorator that extracts charters from every story
 * 2. Evaluates them against the live DOM after each render
 * 3. Sends findings to the manager addon panel via the Storybook channel
 *
 * Usage: import this decorator in your .storybook/preview.ts:
 *   export { decorators } from '@emdesign/addon/charters/preview';
 *   // or merge with existing decorators:
 *   import { charterDecorator } from '@emdesign/addon/charters/preview';
 *   export const decorators = [otherDecorator, charterDecorator];
 */

import React, { useEffect, useRef } from 'react';
import { addons } from '@storybook/preview-api';
import { evaluateAllCharters } from '@emdesign/dsr/charters/runner';
import type { StoryCharter } from '@emdesign/dsr/charters/story-charter';
import type { StoryCharterResult } from '@emdesign/dsr/charters/story-charter';
import { EVT_CHARTER_RESULT } from './channel';

// ---------------------------------------------------------------------------
// Globals — set by the addon manager to signal the active story
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __EMDESIGN_CHARTERS__?: {
      /** The most recent story charter evaluation result */
      lastResult?: StoryCharterResult;
    };
  }
}

// ---------------------------------------------------------------------------
// Extract charters from a story context
// ---------------------------------------------------------------------------

/**
 * Extract charters from a story context.
 * Looks for `charters` on the story parameters, the component, or the meta.
 *
 * Storybook 8 stores parameters on the story context:
 * - `context.parameters.charters` — if set via `parameters: { charters: [...] }`
 * - `context.component?.charters` — component-level charters (less common)
 * - The rendered story's CSF source
 *
 * For simplicity, this reads from a global registry set by the stories themselves.
 * Stories expose charters via their CSF export, and we read them from the
 * `window.__STORYBOOK_STORY__` or similar.
 */
function extractCharters(context: any): {
  componentCharters: StoryCharter[];
  storyCharters: StoryCharter[];
} {
  // Try parameters first (most explicit)
  const params = context?.parameters?.charters;
  const storyCharters: StoryCharter[] = Array.isArray(params) ? params : [];

  // Try the component (meta-level charters)
  const comp = context?.component;
  const componentCharters: StoryCharter[] = Array.isArray((comp as any)?.charters)
    ? (comp as any).charters
    : [];

  return { componentCharters, storyCharters };
}

// ---------------------------------------------------------------------------
// Charter evaluation component
// ---------------------------------------------------------------------------

/**
 * Renders inside the story iframe, runs charters after each render,
 * and sends results to the manager via the Storybook channel.
 */
function CharterRunner({ context }: { context: any }) {
  const evaluatedRef = useRef<string | null>(null);

  useEffect(() => {
    const id = context?.id;
    if (!id) return;

    // Debounce: only re-run when the story actually changes
    if (evaluatedRef.current === id) return;
    evaluatedRef.current = id;

    const container = document.getElementById('storybook-root');
    if (!container) return;

    const { componentCharters, storyCharters } = extractCharters(context);
    const totalCharters = componentCharters.length + storyCharters.length;
    if (totalCharters === 0) {
      // No charters defined — still emit an empty result to clear the UI
      const result: StoryCharterResult = {
        component: context.title?.split('/').pop() ?? 'Unknown',
        story: context.name ?? 'default',
        findings: [],
        passed: 0,
        failed: 0,
        allPass: true,
      };
      window.__EMDESIGN_CHARTERS__ = { lastResult: result };
      addons.getChannel().emit(EVT_CHARTER_RESULT, result);
      return;
    }

    // Evaluate on the next tick to let the DOM settle
    const timer = setTimeout(async () => {
      const component = context.title?.split('/').pop() ?? 'Unknown';
      const story = context.name ?? 'default';

      const result = await evaluateAllCharters(
        componentCharters,
        storyCharters,
        component,
        story,
        container,
      );

      // Store globally for the doctor pipeline and debugging
      window.__EMDESIGN_CHARTERS__ = { lastResult: result };

      // Send to the manager panel via Storybook's channel
      addons.getChannel().emit(EVT_CHARTER_RESULT, result);
    }, 100);

    return () => clearTimeout(timer);
  }, [context?.id, context?.title, context?.name]);

  return null;
}

// ---------------------------------------------------------------------------
// Decorator
// ---------------------------------------------------------------------------

/**
 * Storybook decorator that evaluates charters after every story render.
 *
 * Use as a global decorator:
 * ```ts
 * // .storybook/preview.ts
 * export { decorators } from '@emdesign/addon/charters/preview';
 * ```
 */
export const charterDecorator = (
  Story: React.ComponentType,
  context: any,
) => (
  <>
    <Story />
    <CharterRunner context={context} />
  </>
);

export const decorators = [charterDecorator];
