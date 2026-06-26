import React from 'react';
import { Heading, Eyebrow, Button } from '@ds';
import { StatCard } from './StatCard';
import { DataTable, type TxnRow } from './DataTable';

const TXNS: TxnRow[] = [
  { id: '1', merchant: 'Stripe Payout', date: '2026-06-24', amount: '+128,400.00', status: 'cleared' },
  { id: '2', merchant: 'AWS — us-east-1', date: '2026-06-23', amount: '−14,982.16', status: 'cleared' },
  { id: '3', merchant: 'Gusto Payroll', date: '2026-06-22', amount: '−96,240.00', status: 'pending' },
  { id: '4', merchant: 'Mercury Interest', date: '2026-06-21', amount: '+1,204.55', status: 'cleared' },
  { id: '5', merchant: 'Ramp Card', date: '2026-06-20', amount: '−8,112.39', status: 'pending' },
];

/** The treasury dashboard — KPI stat row + a dense transactions table. Production fintech view. */
export function DashboardView() {
  return (
    <div className="bg-surface min-h-screen p-8 font-[var(--font-sans)] text-text">
      <div className="mx-auto flex flex-col gap-8" style={{ maxWidth: 'var(--container-max)' }}>
        <header className="flex items-end justify-between border-b border-border pb-6">
          <div className="flex flex-col gap-1">
            <Eyebrow>Overview</Eyebrow>
            <Heading level={1}>Treasury</Heading>
          </div>
          <Button>New transfer</Button>
        </header>

        <section className="grid grid-cols-4 gap-4">
          <StatCard label="Available balance" value="$2.41M" delta="4.1% MoM" direction="up" />
          <StatCard label="Monthly burn" value="$184K" delta="2.3% MoM" direction="down" />
          <StatCard label="Runway" value="14.2 mo" delta="0.6 mo" direction="up" />
          <StatCard label="Pending out" value="$104K" delta="3 transfers" direction="down" />
        </section>

        <section className="flex flex-col gap-3">
          <Eyebrow>Recent activity</Eyebrow>
          <DataTable rows={TXNS} />
        </section>
      </div>
    </div>
  );
}
