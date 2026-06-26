import type { Meta, StoryObj } from '@storybook/react';
import { DashboardView } from './DashboardView';

const meta: Meta<typeof DashboardView> = {
  title: 'Generated/DashboardView',
  component: DashboardView,
  parameters: { layout: 'fullscreen' },
};
export default meta;
export const Default: StoryObj<typeof DashboardView> = {};
