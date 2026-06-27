import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

/** Atelier card: raised paper, hairline border, soft shadow. Never a colored left border. */
export function Card({ className = '', ...props }: CardProps) {
  return (
    <div
      className={
        'bg-surface-raised border border-border rounded p-6 ' +
        'shadow-[var(--shadow-raised)] ' +
        className
      }
      {...props}
    />
  );
}
