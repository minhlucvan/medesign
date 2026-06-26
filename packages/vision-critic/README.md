# @medesign/vision-critic

**Multi-model LLM vision critique** — captures a screenshot of a rendered component and scores it
across five visual axes: hierarchy, balance, spacing/rhythm, on-brand fit, and polish.

## Role in the system

The **vision** feedback source in the four-source critique loop. An LLM with vision capabilities
(Claude, Gemini, or Minimax) reads the rendered component screenshot and returns structured findings
— each with severity, region, issue, and an **actionable fix** specific enough for the agent to apply
directly.

## Supported providers

- **Claude** — via `ANTHROPIC_API_KEY` (model: `claude-sonnet-4-20250514`)
- **Gemini** — via `GEMINI_API_KEY` (model: `gemini-2.5-pro-exp-03-25`)
- **Minimax** — via `ANTHROPIC_AUTH_TOKEN` (Anthropic-compat gateway) or `MINIMAX_API_KEY` (native)

## Scoring

Five axes scored 0–1, weighted: hierarchy 0.25, balance 0.20, spacingRhythm 0.20, onBrand 0.15,
polish 0.20 → `visionScore`. Vision is **opt-in** — absent providers are redistributed to present
scorers in the composite.

## Related

- `@medesign/backend` — the critique gate that consumes vision scores
- `docs/vision-feedback.md` — full documentation with provider notes
- `.env` — API key configuration
