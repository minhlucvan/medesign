/**
 * FeatureShowcase — captured by emdesign.
 * Reusable, design-system-bound component. Edit freely; re-capture to update.
 */
import React from 'react';
import { Stack } from '@ds';

export interface FeatureStep {
  stepNumber: string;
  label: string;
  subtitle: string;
  description: string;
}

export interface FeatureShowcaseProps {
  /** Three steps to showcase */
  steps?: FeatureStep[];
  className?: string;
}

const defaultSteps: FeatureStep[] = [
  {
    stepNumber: '01',
    label: 'Connect',
    subtitle: 'Link your accounts',
    description: 'Connect your financial accounts in seconds, with support for over 200 institutions and real-time balance updates.',
  },
  {
    stepNumber: '02',
    label: 'Track',
    subtitle: 'Monitor metrics',
    description: 'Track income, expenses, and portfolio performance on live dashboards with custom alerts for every movement.',
  },
  {
    stepNumber: '03',
    label: 'Optimize',
    subtitle: 'Make it the default',
    description: 'Identify opportunities and execute strategies from the console. Automated workflows turn insights into action.',
  },
];

/**
 * FeatureShowcase — editorial three-column step showcase for Atelier.
 * Headlines in Newsreader serif, neutral step badges with hairline
 * borders, warm surface-raised cards. The first card's step number
 * uses the terracotta accent as a single decisive accent point;
 * remaining cards stay neutral. Section heading sits flush with
 * the card grid below it.
 */
export function FeatureShowcase({
  steps = defaultSteps,
  className = '',
}: FeatureShowcaseProps) {
  return (
    <main className={`bg-surface text-text py-12 px-8 font-sans select-none dark:bg-surface dark:text-text ${className}`}>
      <h1 className="font-display text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] text-text mb-8">
        How it works
      </h1>
      <div role="list" className="flex flex-row gap-6">
        {steps.map((step, idx) => (
          <div
            key={step.stepNumber}
            role="listitem"
            className="flex-1 flex flex-col gap-5 px-6 pt-8 pb-8 border border-border bg-surface-raised shadow-[var(--shadow-raised)]"
          >
            {/* Kicker row: step badge + label */}
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center justify-center w-7 h-7 font-sans text-[11px] font-bold leading-none select-none ${
                  idx === 0
                    ? 'bg-accent text-white'
                    : 'border border-text-muted text-text-muted'
                }`}
                aria-hidden="true"
              >
                {step.stepNumber}
              </span>
              <span className="font-sans text-[12px] font-semibold uppercase tracking-[0.12em] leading-none text-text-muted">
                {step.label}
              </span>
            </div>

            {/* Step subtitle — serif display headline */}
            <h2 className="font-display text-[22px] font-semibold leading-[1.25] text-text">
              {step.subtitle}
            </h2>

            {/* Description */}
            <p className="font-sans text-[16px] leading-[1.6] text-text flex-1">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
