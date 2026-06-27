/**
 * Button — captured by emdesign.
 * Reusable, design-system-bound component. Edit freely; re-capture to update.
 */
import React from 'react';

type Variant = 'primary' | 'secondary';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  'inline-flex items-center justify-center ' +
  'rounded font-sans text-sm font-medium min-h-[44px] ' +
  'px-6 py-[10px] ' +
  'transition-[background-color,box-shadow] ' +
  'duration-[var(--motion-fast)] ' +
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] ' +
  'disabled:opacity-45 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-white ' +
    'hover:bg-accent-hover ' +
    'shadow-[var(--shadow-raised)]',
  secondary:
    'bg-transparent text-text border border-border ' +
    'hover:bg-[var(--color-surface)]',
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
