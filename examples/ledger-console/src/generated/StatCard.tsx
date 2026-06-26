import React from 'react';
import { Card, Eyebrow } from '@ds';

export interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  direction?: 'up' | 'down';
}

/** A KPI metric card: kicker + large tabular figure + a gain/loss delta on the fintech delta roles. */
export function StatCard({ label, value, delta, direction = 'up' }: StatCardProps) {
  const tone = direction === 'up' ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]';
  return (
    <Card className="flex flex-col gap-3">
      <Eyebrow>{label}</Eyebrow>
      <div className="font-[var(--font-mono)] tabular-nums text-[40px] leading-none text-text">{value}</div>
      {delta && (
        <div className={`font-[var(--font-mono)] tabular-nums text-sm ${tone}`}>
          {direction === 'up' ? '+' : '−'} {delta}
        </div>
      )}
    </Card>
  );
}
