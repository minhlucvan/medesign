import type { Meta, StoryObj } from '@storybook/react';
import { MetricCard } from './MetricCard';

const meta: Meta<typeof MetricCard> = {
  title: 'Generated/MetricCard',
  component: MetricCard,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof MetricCard>;

export const Default: Story = {
  args: { label: 'Total Revenue', value: 48250, prefix: '$', trend: 'up', trendLabel: '12.5% vs last month', note: 'Includes all active subscriptions.' },
};
export const Negative: Story = {
  args: { label: 'Bounce Rate', value: 34.2, suffix: '%', trend: 'down', trendLabel: '2.8% decrease', note: 'Target is under 40%.' },
};
export const Neutral: Story = {
  args: { label: 'Active Users', value: 1247, trend: 'neutral', trendLabel: 'Same as yesterday', note: 'Daily active users.' },
};
export const Minimal: Story = {
  args: { label: 'Avg. Session', value: '4m 32s', note: 'Median session duration.' },
};
