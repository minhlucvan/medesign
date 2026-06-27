import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Generated/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary'] },
    disabled: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: '24px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { variant: 'primary', children: 'Publish' },
};
export const Primary: Story = {
  args: { variant: 'primary', children: 'Subscribe Now' },
};
export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Save Draft' },
};
export const Disabled: Story = {
  args: { disabled: true, children: 'Submit' },
};
