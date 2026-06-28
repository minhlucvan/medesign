/** Tailwind bound to the active design system via CSS variables (src/index.css imports its tokens.css). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}', './.storybook/**/*.{ts,tsx}', './design-systems/**/code/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--color-surface)',
        'surface-subtle': 'var(--color-surface-subtle)',
        'surface-raised': 'var(--color-surface-raised)',
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        border: 'var(--color-border)',
      },
      borderRadius: { DEFAULT: 'var(--radius)' },
    },
  },
  plugins: [],
};
