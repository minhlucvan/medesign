import React from 'react';

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Gap in multiples of the 8px base unit (e.g. gap={3} → 24px). */
  gap?: number;
  direction?: 'row' | 'col';
}

/** Layout primitive on the 8px spacing scale. */
export function Stack({ gap = 2, direction = 'col', className = '', style, ...props }: StackProps) {
  return (
    <div
      className={`flex ${direction === 'col' ? 'flex-col' : 'flex-row'} ${className}`}
      style={{ gap: `calc(var(--space-unit) * ${gap})`, ...style }}
      {...props}
    />
  );
}
