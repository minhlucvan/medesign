import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/** Atelier text input: raised paper, hairline border, accent focus ring. */
export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={
        'bg-surface-raised text-text placeholder:text-text-muted ' +
        'border border-border rounded-[var(--radius-sm)] px-3 py-2.5 ' +
        'transition-[border-color,box-shadow] duration-[120ms] ' +
        'focus-visible:outline-none focus-visible:border-accent focus-visible:shadow-[var(--focus-ring)] ' +
        className
      }
      {...props}
    />
  );
}
