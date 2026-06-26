/**
 * @medesign/vision-critic — multi-model LLM vision critique for medesign.
 *
 * Use in three ways:
 *   1. Import critique functions directly (standardCritique, referenceCritique, …)
 *   2. Register providers + use via the registry
 *   3. Call via MCP tools (vision_critique, vision_compare) in backend/src/mcp.ts
 *
 * Providers are auto-registered lazily on first registry access (see registry.ts).
 */

// Types
export type {
  VisionProvider,
  VisionContext,
  VisionAxes,
  VisionFinding,
  VisionCritiqueResult,
  VisionCompareResult,
  CritiqueMode,
  EnsembleConfig,
  CritiqueOptions,
  VisionCritiqueOutput,
} from './types.js';

// Provider registry
export {
  registry,
  registerVisionProvider,
  resolveVisionProvider,
  listVisionProviders,
  availableVisionProviders,
} from './registry.js';

// Providers — re-export (auto-registration is handled lazily in registry.ts)
export { claudeProvider } from './providers/claude.js';
export { geminiProvider } from './providers/gemini.js';
export { minimaxProvider } from './providers/minimax.js';

// Context builder
export type { VisionContextInput } from './context/builder.js';
export { buildVisionContext } from './context/builder.js';

// Image utilities
export { encodeImageBase64, guessMimeFromPath, resizeImageIfNeeded, removeAlphaFromPNG } from './image/processing.js';

// Critique strategies
export { standardCritique } from './critique/standard.js';

// Score helpers
export { computeVisionScore, countP0Findings, VISION_AXIS_WEIGHTS } from './score.js';
