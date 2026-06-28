import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  'inline-flex items-center justify-center rounded font-medium px-5 py-3 ' +
  'transition-[background-color,box-shadow] duration-[120ms] ' +
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] ' +
  'disabled:opacity-45 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
  // Accent is precious — primary is the screen's one decisive action.
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'bg-transparent text-text border border-border hover:bg-[#f3efe8]',
  danger: 'bg-[var(--color-danger)] text-white hover:bg-[#7a281f]',
};

/** Atelier primary/secondary button. References token roles only. */
export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
