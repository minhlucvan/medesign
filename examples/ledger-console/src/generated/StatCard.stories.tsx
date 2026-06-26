import type { Meta, StoryObj } from '@storybook/react';
import { StatCard } from './StatCard';

const meta: Meta<typeof StatCard> = { title: 'Generated/StatCard', component: StatCard };
export default meta;
type S = StoryObj<typeof StatCard>;

export const Up: S = { args: { label: 'Available balance', value: '$2.41M', delta: '4.1% MoM', direction: 'up' } };
export const Down: S = { args: { label: 'Monthly burn', value: '$184K', delta: '2.3% MoM', direction: 'down' } };
