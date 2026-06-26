import type { Meta, StoryObj } from '@storybook/react';
import { PricingTiers } from './PricingTiers';

// Story id `generated-pricingtiers--default` — matches the backend's toStoryId() for visual tests.
const meta: Meta<typeof PricingTiers> = {
  title: 'Generated/PricingTiers',
  component: PricingTiers,
};
export default meta;

export const Default: StoryObj<typeof PricingTiers> = {};
