import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { DataTable, type Column } from './DataTable';
import { Badge } from '@ds';

interface TxnRow {
  id: string;
  merchant: string;
  date: string;
  amount: string;
  status: 'cleared' | 'pending';
}

const columns: Column<TxnRow>[] = [
  { key: 'merchant', label: 'Merchant', sortable: true },
  { key: 'date', label: 'Date', sortable: true },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (value: unknown) => {
      const v = value as string;
      return (
        <Badge tone={v === 'cleared' ? 'neutral' : 'accent'}>{v}</Badge>
      );
    },
  },
  {
    key: 'amount',
    label: 'Amount',
    sortable: true,
    render: (value: unknown) => {
      const v = value as string;
      const isPositive = v.startsWith('+');
      return (
        <span
          className={
            'font-[var(--font-mono)] tabular-nums text-right ' +
            (isPositive
              ? 'text-positive dark:text-positive'
              : 'text-negative dark:text-negative')
          }
        >
          {v}
        </span>
      );
    },
  },
];

const sampleRows: TxnRow[] = [
  { id: '1', merchant: 'Stripe Payout', date: '2026-06-24', amount: '+128,400.00', status: 'cleared' },
  { id: '2', merchant: 'AWS — us-east-1', date: '2026-06-23', amount: '−14,982.16', status: 'cleared' },
  { id: '3', merchant: 'Gusto Payroll', date: '2026-06-22', amount: '−96,240.00', status: 'pending' },
  { id: '4', merchant: 'Vercel Hosting', date: '2026-06-21', amount: '−2,450.00', status: 'cleared' },
  { id: '5', merchant: 'Intercom SaaS', date: '2026-06-20', amount: '−1,800.00', status: 'cleared' },
  { id: '6', merchant: 'GitHub Enterprise', date: '2026-06-19', amount: '−420.00', status: 'pending' },
  { id: '7', merchant: 'Cloudflare CDN', date: '2026-06-18', amount: '−510.00', status: 'cleared' },
  { id: '8', merchant: 'Heroku Dynos', date: '2026-06-17', amount: '−3,200.00', status: 'cleared' },
  { id: '9', merchant: 'DigitalOcean Droplets', date: '2026-06-16', amount: '−1,024.00', status: 'pending' },
  { id: '10', merchant: 'Twilio SMS', date: '2026-06-15', amount: '−280.50', status: 'cleared' },
  { id: '11', merchant: 'Slack Workspace', date: '2026-06-14', amount: '−787.50', status: 'cleared' },
  { id: '12', merchant: 'DataDog Monitoring', date: '2026-06-13', amount: '−1,500.00', status: 'pending' },
];

const meta: Meta<typeof DataTable> = {
  title: 'Generated/DataTable',
  component: DataTable,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DataTable>;

export const Default: Story = {
  args: {
    columns,
    rows: sampleRows,
    pageSize: 5,
  },
};

export const Empty: Story = {
  args: {
    columns,
    rows: [],
    emptyMessage: 'No transactions to display',
  },
};

export const PageSizeTen: Story = {
  args: {
    columns,
    rows: sampleRows,
    pageSize: 10,
  },
};

export const SingleRow: Story = {
  args: {
    columns,
    rows: [sampleRows[0]],
    pageSize: 5,
  },
};
