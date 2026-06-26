import type { Meta, StoryObj } from '@storybook/react';
import { DataTable } from './DataTable';

const meta: Meta<typeof DataTable> = { title: 'Generated/DataTable', component: DataTable };
export default meta;

export const Default: StoryObj<typeof DataTable> = {
  args: {
    rows: [
      { id: '1', merchant: 'Stripe Payout', date: '2026-06-24', amount: '+128,400.00', status: 'cleared' },
      { id: '2', merchant: 'AWS — us-east-1', date: '2026-06-23', amount: '−14,982.16', status: 'cleared' },
      { id: '3', merchant: 'Gusto Payroll', date: '2026-06-22', amount: '−96,240.00', status: 'pending' },
    ],
  },
};
