/**
 * Component lint predicates — ported from backend's linter into the domain layer so the
 * rule engine is the single source of truth. Findings are framework-tagged (react-tailwind today).
 */
import type { Diagnostic } from '../domain/values.js';
import {
  PURPLE_HEXES, AI_DEFAULT_INDIGO, TRUST_GRADIENT_BLUE, TRUST_GRADIENT_CYAN,
  SLOP_EMOJI, INVENTED_METRIC_PATTERNS, FILLER_PATTERNS, EXTERNAL_IMAGE_HOSTS, SANS_FAMILIES,
} from './constants.js';

export interface ComponentLintOptions {
  declaredTokens?: string[];
  exemptions?: string[];
  bindsDisplayFace?: boolean;
  target?: string;
}

type Finding = Omit<Diagnostic, 'scope'>;

function stripTokenBlocks(src: string): string {
  return src.replace(/:root\s*\{[\s\S]*?\}/g, '').replace(/\[data-theme[^\]]*\]\s*\{[\s\S]*?\}/g, '');
}
function find(src: string, re: RegExp): string | undefined {
  return src.match(re)?.[0];
}

/** Anti-slop + off-token rules over component source. Returns component-scope findings. */
export function componentLint(source: string, opts: ComponentLintOptions = {}): Finding[] {
  const out: Finding[] = [];
  const exempt = new Set(opts.exemptions ?? []);
  const body = stripTokenBlocks(source);
  const lower = body.toLowerCase();
  const push = (f: Finding) => {
    if (!exempt.has(f.ruleId)) out.push({ ...f, target: opts.target });
  };

  if (/(?:from|to|via)-(?:indigo|violet|purple)-\d/.test(body) || (/gradient/.test(lower) && PURPLE_HEXES.some((h) => lower.includes(h)))) {
    push({ ruleId: 'purple-gradient', severity: 'P0', message: 'Indigo/violet/purple gradient — the AI-default look.', fix: 'Use the design system accent (a solid color), not a purple gradient.' });
  }
  const hasBlue = /(?:from|to|via)-blue-\d/.test(body) || TRUST_GRADIENT_BLUE.some((h) => lower.includes(h));
  const hasCyan = /(?:from|to|via)-cyan-\d/.test(body) || TRUST_GRADIENT_CYAN.some((h) => lower.includes(h));
  if (hasBlue && hasCyan) push({ ruleId: 'trust-gradient', severity: 'P0', message: 'Blue→cyan "trust gradient" hero cliché.', fix: 'Drop the gradient; use a flat surface + accent.' });

  const indigo = AI_DEFAULT_INDIGO.find((h) => lower.includes(h));
  if (indigo) push({ ruleId: 'ai-default-indigo', severity: 'P0', message: `Solid AI-default indigo ${indigo} outside token definitions.`, fix: 'Reference the design system accent token, not a raw indigo hex.', snippet: indigo });

  const emoji = SLOP_EMOJI.find((e) => body.includes(e));
  if (emoji && /(<h[1-6]|<button|<li|className="[^"]*icon)/i.test(body)) push({ ruleId: 'emoji-icon', severity: 'P0', message: `Emoji used as an icon (${emoji}).`, fix: 'Use a real icon or omit it.', snippet: emoji });

  if (/border-l(?:-\d)?\b/.test(body) && /rounded(?:-\w+)?\b/.test(body) && /(border-l-(?!transparent)\w+|borderLeft)/i.test(body)) {
    push({ ruleId: 'left-accent-card', severity: 'P0', message: 'Rounded card with a colored left border — a generic AI tell.', fix: 'Hairline border on all sides + the design-system shadow.' });
  }

  if (opts.bindsDisplayFace) {
    const headingSans = /<h[1-3][^>]*className="[^"]*(font-sans|font-\[.*?(Inter|Roboto|Arial|system-ui))/i.test(body) ||
      (/<h[1-3]/.test(body) && SANS_FAMILIES.test(find(body, /<h[1-3][\s\S]{0,120}/)?.toString() ?? ''));
    if (headingSans) push({ ruleId: 'sans-display', severity: 'P0', message: 'Sans-serif on a display heading; this system binds a display face.', fix: 'Headings must use the display font.' });
  }

  for (const re of INVENTED_METRIC_PATTERNS) { const m = find(body, re); if (m) { push({ ruleId: 'invented-metric', severity: 'P0', message: `Invented marketing metric: "${m}".`, fix: 'Remove fabricated metrics.', snippet: m }); break; } }
  for (const re of FILLER_PATTERNS) { const m = find(body, re); if (m) { push({ ruleId: 'filler-copy', severity: 'P0', message: `Filler/placeholder copy: "${m}".`, fix: 'Write real, specific copy.', snippet: m }); break; } }

  const host = EXTERNAL_IMAGE_HOSTS.find((h) => lower.includes(h));
  if (host) push({ ruleId: 'external-image', severity: 'P1', message: `External placeholder image host: ${host}.`, fix: 'Use a local asset or a neutral solid block.', snippet: host });

  const accentUses = (body.match(/\b(bg|text|border)-accent\b/g) ?? []).length + (body.match(/var\(--color-accent\)/g) ?? []).length;
  if (accentUses > 2) push({ ruleId: 'accent-overuse', severity: 'P1', message: `Accent used ${accentUses} times; cap is ~2 per screen.`, fix: 'Reserve the accent for the single most important element.' });

  const rawHexes = body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  if (rawHexes.length > 0 && (opts.declaredTokens?.length ?? 0) > 0) {
    push({ ruleId: 'off-token-color', severity: 'P1', message: `Raw hex in component (${rawHexes.slice(0, 3).join(', ')}${rawHexes.length > 3 ? '…' : ''}); a token contract exists.`, fix: 'Reference a token role instead of raw hex.', snippet: rawHexes[0] });
  }
  return out;
}

/** Token self-check on source: every `var(--x)` must resolve to a declared role. */
export function tokenReferenceLint(source: string, declaredTokens: string[]): Finding[] {
  const declared = new Set(declaredTokens.map((t) => t.replace(/^--/, '')));
  const out: Finding[] = [];
  for (const ref of source.match(/var\(\s*--([a-z0-9-]+)\s*\)/gi) ?? []) {
    const name = ref.replace(/var\(\s*--/i, '').replace(/\s*\)/, '');
    if (!declared.has(name)) out.push({ ruleId: 'unresolved-token', severity: 'P0', message: `var(--${name}) does not resolve to a declared token.`, fix: `Use a declared role, or add --${name} to tokens.css.`, snippet: ref });
  }
  return out;
}
