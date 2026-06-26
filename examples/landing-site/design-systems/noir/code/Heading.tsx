import React from 'react';

type Level = 1 | 2 | 3;
type Size = 'display';

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: Level;
  /** Opt-in to a larger rung than the level's default (e.g. a hero headline). Keeps the semantic tag. */
  size?: Size;
}

// Headings ALWAYS use the display (serif) family — never the sans family.
const styles: Record<Level, string> = {
  1: 'text-[44px] leading-[1.08] tracking-[-0.4px]',
  2: 'text-[30px] leading-[1.15] tracking-[-0.2px]',
  3: 'text-[22px] leading-[1.25]',
};
// One rung above level 1 — for the single largest headline on a page. Tracking tightens as size grows.
const oversize: Record<Size, string> = {
  display: 'text-[60px] leading-[1.04] tracking-[-0.6px]',
};

/** Atelier display heading (Newsreader serif). */
export function Heading({ level = 1, size, className = '', ...props }: HeadingProps) {
  const Tag = `h${level}` as const;
  const type = size ? oversize[size] : styles[level];
  return (
    <Tag
      className={`font-[var(--font-display)] font-medium text-text ${type} ${className}`}
      {...props}
    />
  );
}

/** Uppercase eyebrow label — the only uppercase text, always tracked. */
export function Eyebrow({ className = '', ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`font-[var(--font-sans)] uppercase text-xs font-semibold tracking-[0.12em] text-text-muted ${className}`}
      {...props}
    />
  );
}
