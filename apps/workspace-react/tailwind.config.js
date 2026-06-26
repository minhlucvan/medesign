/**
 * Tailwind is bound to the active design system via CSS variables (see src/index.css,
 * which imports the selected design system's tokens.css). Components reference semantic
 * tokens — e.g. `bg-[var(--color-surface)]` — never raw hex, so output stays on-system.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{ts,tsx}',
    './.storybook/**/*.{ts,tsx}',
    // The active design system's primitives + any generated/captured components.
    '../../design-systems/**/code/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Semantic roles map to the design system's CSS custom properties.
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        border: 'var(--color-border)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
      },
    },
  },
  plugins: [],
};
