import React from 'react';
import { Badge } from '@ds';

export interface TxnRow {
  id: string;
  merchant: string;
  date: string;
  amount: string;
  status: 'cleared' | 'pending';
}

/** A dense transactions table: hairline rules, tabular monospace figures, status badges. */
export function DataTable({ rows }: { rows: TxnRow[] }) {
  const cols = 'grid grid-cols-[1fr_auto_7rem_8rem] gap-4 px-4';
  return (
    <div className="border border-border bg-surface-raised">
      <div className={`${cols} py-2 border-b border-border text-xs uppercase tracking-[0.12em] text-text-muted font-[var(--font-sans)]`}>
        <span>Merchant</span>
        <span>Date</span>
        <span>Status</span>
        <span className="text-right">Amount</span>
      </div>
      {rows.map((r) => (
        <div key={r.id} className={`${cols} py-3 border-b border-border items-center`}>
          <span className="text-text">{r.merchant}</span>
          <span className="font-[var(--font-mono)] tabular-nums text-text-muted text-sm">{r.date}</span>
          <span><Badge>{r.status}</Badge></span>
          <span className="font-[var(--font-mono)] tabular-nums text-right text-text">{r.amount}</span>
        </div>
      ))}
    </div>
  );
}
