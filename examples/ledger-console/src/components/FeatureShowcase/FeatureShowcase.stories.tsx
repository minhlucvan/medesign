import type { Meta, StoryObj } from '@storybook/react';
import { FeatureShowcase } from './FeatureShowcase';

const meta: Meta<typeof FeatureShowcase> = {
  title: 'Generated/FeatureShowcase',
  component: FeatureShowcase,
};

export default meta;

export const Default: StoryObj<typeof FeatureShowcase> = {};
