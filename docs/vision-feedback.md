# Vision feedback — LLM-powered visual critique

Vision feedback is the **subjective "how does it look?"** layer of the four-source critique gate.
An LLM with vision capabilities (Minimax, Claude, Gemini) reads a screenshot of the rendered component
and scores it across five visual axes — hierarchy, balance, spacing rhythm, on-brand fit, and polish —
then returns concrete, region-tied findings the agent can act on.

**Opt-in.** Vision requires an API key for one of the supported providers. The design loop runs fine
without it — the `vision` scorer is simply absent from the composite, and its weight is redistributed
to the other scorers.

```bash
# Pick one:
export ANTHROPIC_AUTH_TOKEN="sk-..."   # Minimax Anthropic-compat gateway (MiniMax-M3)
export MINIMAX_API_KEY="sk-..."         # Minimax native API (MiniMax-VL-01)
export ANTHROPIC_API_KEY="sk-..."       # Claude
export GEMINI_API_KEY="..."              # Gemini
```

---

## The five axes

Each axis is scored 0–1 by the vision model:

| Axis | What it measures |
|------|------------------|
| `hierarchy` | Is the eye led to the right thing first? Is the primary action clear? |
| `balance` | Weight/whitespace distribution, alignment, optical centering. |
| `spacingRhythm` | Consistent spacing scale; no cramped or arbitrary gaps. |
| `onBrand` | Matches the design system's vibe (calm/editorial/etc.). |
| `polish` | Contrast, radii consistency, no orphaned elements, no AI-generic look. |

The overall `visionScore` (0–1) is a weighted mean: hierarchy 0.25, balance 0.20,
spacingRhythm 0.20, onBrand 0.15, polish 0.20.

Each finding has a `severity` (P0/P1/P2), a `region` (CSS selector or element description),
an `issue`, and an **actionable fix** — specific enough for the agent to apply directly
(e.g. "Switch CTA label to near-black (#0a0a0a), bump to semibold").

---

## How it's scored

```
   standardCritique()               scoreboard.ts
     │                                   │
     ▼                                   ▼
  VisionCritiqueOutput ──▶ scores.vision ──▶ computeComposite()
  { visionScore: 0.78,        0.78          (weight 0.25, redistributed
    findings: [...],                       if vision absent)
    mustFix: 1 }
             │                                   │
             ▼                                   ▼
       record_evidence                    critique_score gate
       (saved to evidence/)              (ship if composite ≥ threshold
                                          AND mustFix === 0
                                          AND no regression)
```

When vision is absent (no API key), `scores.vision` is `undefined`, and the composite
weight is redistributed proportionally to the present scorers (tokens, visual, llm).

---

## Ways to use it

### 1. Inside the design loop (automatic)

`/mds:craft:component` and `/mds:craft:view` run `vision_critique` as part of the four-source
critique phase. If a vision provider is configured, the score and findings feed into the gate.
If not, vision is simply omitted.

### 2. Standalone critique

```bash
/ mds:vision Button
```

Calls `vision_critique` MCP tool, returns the per-axis scores and findings. Useful to
sanity-check how a component looks before/after a change.

### 3. CLI

```bash
medesign vision-critique Button
medesign vision-compare Button /path/to/reference.png
```

### 4. MCP tools (for agent use)

| Tool | What it does |
|------|-------------|
| `vision_critique` | Capture screenshot + run visual critique. Returns `{axes, visionScore, mustFix, findings}`. |
| `vision_compare` | Compare rendered component against a reference image. Returns `{fidelityScore, differences, findings}`. |
| `vision_upload_reference` | Copy a reference image into the screenshot directory for comparison. |

### 5. HTTP API

```
POST /api/vision-critique  { component: "Button" }
POST /api/vision-compare   { component: "Button", referenceImagePath: "/path/to/reference.png" }
```

---

## Provider-specific notes

### Minimax (Anthropic-compatible gateway) — recommended path

- **Key:** `ANTHROPIC_AUTH_TOKEN`
- **Model:** `MiniMax-M3` (supports vision via standard Anthropic image content blocks)
- **Endpoint:** `https://api.minimax.io/anthropic/v1/messages`
- **Auth:** `x-api-key` header
- **RGBA images:** MiniMax-M3 only accepts RGB — alpha is stripped automatically by `removeAlphaFromPNG()`.

### Minimax (native API)

- **Key:** `MINIMAX_API_KEY`
- **Model:** `MiniMax-VL-01` (vision-language model)
- **Endpoint:** `https://api.minimaxi.com/v1/chat/completions`
- **Auth:** `Bearer` token
- Requires a different key format than the Anthropic-compatible gateway.

### Claude

- **Key:** `ANTHROPIC_API_KEY`
- **Model:** `claude-sonnet-4-20250514` (configurable via `ANTHROPIC_MODEL`)
- Also supports `ANTHROPIC_BASE_URL` for proxies and `ANTHROPIC_AUTH_TOKEN` fallback.

### Gemini

- **Key:** `GEMINI_API_KEY`
- **Model:** `gemini-2.5-pro-exp-03-25` (configurable via `GEMINI_MODEL`)
- Native JSON schema enforcement ensures structured output.

---

## Output quality

A real evaluation on a 116 KB Hero screenshot produced:

```
Score: 0.78  │  Findings: 8  │  All 9 quality checks passed
```

- Every finding had a **specific fix** (color hex, pixel value, element region)
- Findings referenced the **design system's accent** (lime-green #a3e635)
- Severity was meaningful: P0 (structural: empty half of canvas), P1 (CTA contrast, spacing),
  P2 (polish: eyebrow label, scroll cue)

Example finding:
```
P1  │  primary CTA 'Bắt đầu dự án'
     issue: "Lime-green button text is white — fights the accent, reduces legibility"
     fix:   "Switch CTA label to near-black (#0a0a0a), bump to semibold"
```

This is actionable enough for the agent to apply directly in the component code.

---

## Package structure

```
packages/vision-critic/
  src/
    types.ts              — VisionProvider, VisionContext, VisionCritiqueResult, etc.
    registry.ts           — Lazy auto-registration of providers (claude, gemini, minimax)
    providers/
      minimax.ts          — Minimax (Anthropic-compat + native). Tries compat first.
      claude.ts            — Claude + Minimax/Anthropic-compat gateway
      gemini.ts           — Gemini with JSON schema enforcement
    critique/
      standard.ts         — standardCritique() — resolve provider, build context, call, return
    prompt/
      templates.ts        — System prompts for standard, reference, and regression critique
      builder.ts          — Assemble prompts from VisionContext (DS context, static findings, DOM)
    image/
      processing.ts       — Base64 encode, resize alpha removal (RGBA → RGB for Minimax)
    context/
      builder.ts          — Build VisionContext from repo paths + design system
    score.ts              — computeVisionScore() + countP0Findings()
```

---

## Adding a custom provider

Implement the `VisionProvider` interface (from `types.ts`) and register it:

```typescript
import { registerVisionProvider, type VisionProvider } from '@medesign/vision-critic';

const myProvider: VisionProvider = {
  id: 'my-vision',
  name: 'My Vision Model',
  available: () => !!process.env.MY_KEY,
  critique: async (image, mime, ctx) => {
    // Call your API, parse response, return VisionCritiqueResult
  },
  compare: async (ref, actual, ctx) => {
    // Return VisionCompareResult
  },
};

registerVisionProvider(myProvider);
```

---

## See also

- [`docs/harness-engine.md`](harness-engine.md) — the four-source critique loop and gate
- [`packages/vision-critic/src/`](../packages/vision-critic/src/) — implementation
- `.env` — `MINIMAX_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `GEMINI_API_KEY`
- [`@medesign/backend/src/critique/scoreboard.ts`](../packages/backend/src/critique/scoreboard.ts) — composite score computation
