import React from 'react';

type Tone = 'neutral' | 'accent';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const tones: Record<Tone, string> = {
  neutral: 'bg-[#f3efe8] text-text-muted',
  accent: 'bg-accent text-white', // use sparingly — counts toward the ≤2 accent budget
};

/** Atelier pill badge. */
export function Badge({ tone = 'neutral', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={
        'inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 ' +
        'text-xs font-semibold ' +
        tones[tone] +
        ' ' +
        className
      }
      {...props}
    />
  );
}
