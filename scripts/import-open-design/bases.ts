/**
 * The convertible open-design systems → medesign base specs.
 *
 * Each entry drives the converter (./convert.ts): it locates the vendored source skill under
 * skills/_vendor/open-design/<srcSkill>/, copies atelier's primitives, maps the source palette onto the
 * required token roles, bundles the source SKILL.md + assets as reference, and emits a base under
 * design-systems/_vendor/open-design/<id>/. The token values here are a DRAFT mapping — the authoring
 * pass (design-system-author skill) refines them and fills the DESIGN.md to the quality bar.
 *
 * `roles` keys are token-role names WITHOUT the leading `--`. Only the roles you want to override from
 * the neutral base need to be listed; every required role is already declared by baseTokensCss().
 */

export interface BaseSpec {
  id: string;
  name: string;
  category: string;
  surface: 'web' | 'image' | 'video' | 'audio';
  /** Folder under skills/_vendor/open-design/. */
  srcSkill: string;
  upstream?: string;
  /** One-line description for the manifest + catalog. */
  description: string;
  /** Token-role overrides (name → CSS value). */
  roles: Record<string, string>;
  /** Lint tuning for this look. `exemptions` are ruleIds the engine skips (e.g. a dark look). */
  craft?: { applies?: string[]; exemptions?: string[] };
}

const ATTR = 'https://github.com/nexu-io/open-design';

export const BASES: BaseSpec[] = [
  // ── Editorial / template family (palettes extracted from assets/template.html :root) ──────────────
  {
    id: 'editorial-burgundy',
    name: 'Editorial Burgundy',
    category: 'Editorial',
    surface: 'web',
    srcSkill: 'editorial-burgundy-principles-template',
    upstream: ATTR,
    description: 'Wine-on-blush editorial — burgundy ink, gold accent, soft paper warmth, serif-led.',
    roles: {
      'color-surface': '#f8d8de',
      'color-surface-raised': '#fcebee',
      'color-text': '#5a1f2e',
      'color-text-muted': 'rgba(90,31,46,0.64)',
      'color-accent': '#a8842f',
      'color-accent-hover': '#8a6c24',
      'color-border': 'rgba(90,31,46,0.18)',
      'font-display': '"Fraunces", Georgia, serif',
      'font-sans': '"Inter", system-ui, sans-serif',
      radius: '4px',
      'shadow-raised': '0 1px 2px rgba(90,31,46,0.10), 0 12px 30px rgba(90,31,46,0.08)',
    },
  },
  {
    id: 'digits-fintech-swiss',
    name: 'Digits Fintech Swiss',
    category: 'Fintech',
    surface: 'web',
    srcSkill: 'digits-fintech-swiss-template',
    upstream: ATTR,
    description: 'Swiss fintech — bone paper, ink-black type, electric-lime accent, hairline grid.',
    roles: {
      'color-surface': '#f2f2ed',
      'color-surface-raised': '#fafaf7',
      'color-text': '#0a0a0a',
      'color-text-muted': 'rgba(10,10,10,0.60)',
      'color-accent': '#8aa000', // electric lime, contrast-tuned for light paper
      'color-accent-hover': '#6f8a00',
      'color-border': 'rgba(10,10,10,0.12)',
      'font-display': '"Geist", "Inter", system-ui, sans-serif',
      'font-sans': '"Inter", system-ui, sans-serif',
      'font-mono': '"Geist Mono", "JetBrains Mono", ui-monospace, monospace',
      radius: '2px',
    },
  },
  {
    id: 'field-notes-editorial',
    name: 'Field Notes Editorial',
    category: 'Editorial',
    surface: 'web',
    srcSkill: 'field-notes-editorial-template',
    upstream: ATTR,
    description: 'Warm-paper field-notes editorial — soft ink, lime/pink/peach trims, rounded cards.',
    roles: {
      'color-surface': '#f4f0e8',
      'color-surface-raised': '#fbf9f3',
      'color-text': '#181715',
      'color-text-muted': 'rgba(24,23,21,0.72)',
      'color-accent': '#b06a86',
      'color-accent-hover': '#925670',
      'color-border': '#e6a2bc',
      'font-display': '"Fraunces", Georgia, serif',
      'font-sans': '"Inter", system-ui, sans-serif',
      radius: '28px',
    },
  },
  {
    id: 'after-hours',
    name: 'After Hours',
    category: 'Editorial',
    surface: 'web',
    srcSkill: 'after-hours-editorial-template',
    upstream: ATTR,
    description: 'Near-black nocturnal editorial — violet-white type, hot-pink accent, fine seams.',
    roles: {
      'color-surface': '#0a090f',
      'color-surface-raised': '#15131c',
      'color-text': '#f4f1f6',
      'color-text-muted': '#8f8698',
      'color-accent': '#ff4ea2',
      'color-accent-hover': '#e23b8c',
      'color-border': '#26232d',
      'font-display': '"Cabinet Grotesk", "Inter", system-ui, sans-serif',
      'font-sans': '"Inter", system-ui, sans-serif',
      radius: '10px',
      'shadow-raised': '0 1px 2px rgba(0,0,0,0.5), 0 16px 40px rgba(0,0,0,0.45)',
    },
    craft: { exemptions: [] },
  },
  {
    id: 'swiss-creative',
    name: 'Swiss Creative',
    category: 'Swiss',
    surface: 'web',
    srcSkill: 'swiss-creative-mode-template',
    upstream: ATTR,
    description: 'Playful Swiss grid — oat paper, ink type, four-color pop, hard offset shadows.',
    roles: {
      'color-surface': '#f3efe4',
      'color-surface-raised': '#fbf9f2',
      'color-text': '#0b0b0b',
      'color-text-muted': 'rgba(11,11,11,0.62)',
      'color-accent': '#188f5a',
      'color-accent-hover': '#127349',
      'color-border': '#0b0b0b',
      'font-display': '"Space Grotesk", "Inter", system-ui, sans-serif',
      'font-sans': '"Inter", system-ui, sans-serif',
      radius: '0px',
      'shadow-raised': '8px 8px 0 #0b0b0b',
    },
  },

  // ── Deck / presentation systems (palettes from example.html) ──────────────────────────────────────
  {
    id: 'deck-swiss-international',
    name: 'Deck — Swiss International',
    category: 'Deck',
    surface: 'web',
    srcSkill: 'deck-swiss-international',
    upstream: ATTR,
    description: 'International Typographic deck — paper white, ink black, Klein-blue accent, 16-col grid.',
    roles: {
      'color-surface': '#fafaf8',
      'color-surface-raised': '#ffffff',
      'color-text': '#0a0a0a',
      'color-text-muted': 'rgba(10,10,10,0.58)',
      'color-accent': '#002fa7',
      'color-accent-hover': '#002485',
      'color-border': 'rgba(10,10,10,0.14)',
      'font-display': '"Helvetica Neue", "Inter", system-ui, sans-serif',
      'font-sans': '"Helvetica Neue", "Inter", system-ui, sans-serif',
      radius: '0px',
    },
  },
  {
    id: 'deck-guizang-editorial',
    name: 'Deck — Guizang Editorial',
    category: 'Deck',
    surface: 'web',
    srcSkill: 'deck-guizang-editorial',
    upstream: ATTR,
    description: 'Dark editorial deck — near-black ground, warm-paper type, olive depth, restrained.',
    roles: {
      'color-surface': '#0a0a0b',
      'color-surface-raised': '#17160f',
      'color-text': '#f1efea',
      'color-text-muted': '#6b665b',
      'color-accent': '#c9b27a',
      'color-accent-hover': '#b59c63',
      'color-border': '#3a382f',
      'font-display': '"Fraunces", Georgia, serif',
      'font-sans': '"Inter", system-ui, sans-serif',
      radius: '6px',
      'shadow-raised': '0 1px 2px rgba(0,0,0,0.5), 0 18px 44px rgba(0,0,0,0.5)',
    },
  },
  {
    id: 'deck-open-canvas',
    name: 'Deck — Open Slide Canvas',
    category: 'Deck',
    surface: 'web',
    srcSkill: 'deck-open-slide-canvas',
    upstream: ATTR,
    description: 'Deep-space slide canvas — midnight ground, sky-blue accent, crisp light type.',
    roles: {
      'color-surface': '#0a0e1a',
      'color-surface-raised': '#11172a',
      'color-text': '#f5f5f7',
      'color-text-muted': 'rgba(245,245,247,0.62)',
      'color-accent': '#5ac8fa',
      'color-accent-hover': '#3bb6ef',
      'color-border': 'rgba(245,245,247,0.14)',
      'font-display': '"Inter", system-ui, sans-serif',
      'font-sans': '"Inter", system-ui, sans-serif',
      radius: '12px',
      'shadow-raised': '0 1px 2px rgba(0,0,0,0.5), 0 20px 50px rgba(0,0,0,0.5)',
    },
  },
  {
    id: 'keynote-warm',
    name: 'Keynote Warm',
    category: 'Deck',
    surface: 'web',
    srcSkill: 'ppt-keynote',
    upstream: ATTR,
    description: 'Warm keynote — linen paper, espresso ink, gold + rust accents, calm and premium.',
    roles: {
      'color-surface': '#f4f1ec',
      'color-surface-raised': '#fafaf7',
      'color-text': '#15140f',
      'color-text-muted': 'rgba(21,20,15,0.62)',
      'color-accent': '#c96442',
      'color-accent-hover': '#a94f32',
      'color-border': '#e7e5e0',
      'font-display': '"Fraunces", Georgia, serif',
      'font-sans': '"Inter", system-ui, sans-serif',
      radius: '8px',
    },
  },

  // ── Taste / style family (inline spec in SKILL.md) ────────────────────────────────────────────────
  {
    id: 'brutalist',
    name: 'Industrial Brutalist',
    category: 'Brutalist',
    surface: 'web',
    srcSkill: 'brutalist-skill',
    upstream: 'https://github.com/Leonxlnx/taste-skill',
    description: 'Tactical-telemetry brutalism — bone paper, hard ink, alarm-red + signal-green, zero radius.',
    roles: {
      'color-surface': '#f4f4f0',
      'color-surface-raised': '#eae8e3',
      'color-text': '#050505',
      'color-text-muted': 'rgba(5,5,5,0.62)',
      'color-accent': '#e61919',
      'color-accent-hover': '#c41212',
      'color-border': '#050505',
      'font-display': '"Neue Haas Grotesk", "Inter", system-ui, sans-serif',
      'font-sans': '"Inter", system-ui, sans-serif',
      'font-mono': '"JetBrains Mono", ui-monospace, monospace',
      radius: '0px',
      'shadow-raised': 'none',
    },
    craft: { exemptions: ['accent-overuse'] },
  },
  {
    id: 'minimalist',
    name: 'Quiet Minimalist',
    category: 'Minimalist',
    surface: 'web',
    srcSkill: 'minimalist-skill',
    upstream: 'https://github.com/Leonxlnx/taste-skill',
    description: 'Warm-monochrome minimalism — paper white, soft graphite type, one whisper-quiet accent.',
    roles: {
      'color-surface': '#ffffff',
      'color-surface-raised': '#f7f6f3',
      'color-text': '#111111',
      'color-text-muted': '#787774',
      'color-accent': '#111111',
      'color-accent-hover': '#000000',
      'color-border': '#eaeaea',
      'font-display': '"Inter", system-ui, sans-serif',
      'font-sans': '"Inter", system-ui, sans-serif',
      radius: '6px',
      'shadow-raised': '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)',
    },
  },
  {
    id: 'soft',
    name: 'Soft Studio',
    category: 'Expressive',
    surface: 'web',
    srcSkill: 'soft-skill',
    upstream: 'https://github.com/Leonxlnx/taste-skill',
    description: 'Awwwards-soft agency — near-black ground, warm-cream type, pillowy radius and depth.',
    roles: {
      'color-surface': '#050505',
      'color-surface-raised': '#141414',
      'color-text': '#fdfbf7',
      'color-text-muted': 'rgba(253,251,247,0.64)',
      'color-accent': '#fdfbf7',
      'color-accent-hover': '#e9e5dc',
      'color-border': 'rgba(253,251,247,0.14)',
      'font-display': '"Cabinet Grotesk", "Inter", system-ui, sans-serif',
      'font-sans': '"Inter", system-ui, sans-serif',
      radius: '20px',
      'radius-pill': '999px',
      'shadow-raised': '0 1px 2px rgba(0,0,0,0.5), 0 24px 60px rgba(0,0,0,0.45)',
    },
  },
  {
    id: 'stitch',
    name: 'Stitch',
    category: 'Product',
    surface: 'web',
    srcSkill: 'stitch-skill',
    upstream: 'https://github.com/google/stitch',
    description: 'Balanced product system — clean neutrals, weight-driven hierarchy, dialable expressiveness.',
    roles: {
      'color-surface': '#ffffff',
      'color-surface-raised': '#f9fafb',
      'color-text': '#18181b',
      'color-text-muted': '#71717a',
      'color-accent': '#3b82f6',
      'color-accent-hover': '#2563eb',
      'color-border': '#e5e7eb',
      'font-display': '"Geist", "Inter", system-ui, sans-serif',
      'font-sans': '"Geist", "Inter", system-ui, sans-serif',
      'font-mono': '"Geist Mono", "JetBrains Mono", ui-monospace, monospace',
      radius: '8px',
    },
  },
];
