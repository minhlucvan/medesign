/**
 * MetricCard — captured by emdesign.
 * Reusable, design-system-bound component. Edit freely; re-capture to update.
 */
import React from 'react';
import { Card } from '@ds/Card';
import { Stack } from '@ds/Stack';

interface MetricCardProps {
  label: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  note?: string;
}

export function MetricCard({ label, value, prefix, suffix, trend, trendLabel, note }: MetricCardProps) {
  const trendColor = trend === 'up'
    ? 'text-[var(--color-success)]'
    : trend === 'down'
    ? 'text-[var(--color-danger)]'
    : 'text-[var(--color-text-muted)]';
  const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  return (
    <Card className="p-6">
      <Stack gap="2">
        <span className="font-sans text-[13px] font-medium tracking-[0.02em] text-[var(--color-text-muted)]">
          {label}
        </span>
        <div className="flex items-baseline gap-2">
          {prefix && <span className="font-sans text-[22px] font-medium text-[var(--color-text)]">{prefix}</span>}
          <span className="font-[var(--font-display)] text-[44px] font-medium leading-[1.08] tracking-[-0.4px] text-[var(--color-text)]">
            {value}
          </span>
          {suffix && <span className="font-sans text-[16px] text-[var(--color-text-muted)]">{suffix}</span>}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 font-sans text-[14px] ${trendColor}`}>
            <span aria-hidden="true">{trendArrow}</span>
            {trendLabel && <span>{trendLabel}</span>}
            <span className="sr-only">{trend === 'up' ? 'Increase' : trend === 'down' ? 'Decrease' : 'No change'}</span>
          </div>
        )}
        {note && (
          <p className="font-sans text-[14px] text-[var(--color-text-muted)] mt-1">{note}</p>
        )}
      </Stack>
    </Card>
  );
}
