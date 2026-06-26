import type { Meta, StoryObj } from '@storybook/react';
import { PricingView } from './PricingView';

const meta: Meta<typeof PricingView> = {
  title: 'Generated/PricingView',
  component: PricingView,
  parameters: { layout: 'fullscreen' },
};
export default meta;
export const Default: StoryObj<typeof PricingView> = {};
