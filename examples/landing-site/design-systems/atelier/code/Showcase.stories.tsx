import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Button, Card, Input, Badge, Heading, Eyebrow, Stack } from './index';

/** Renders every Atelier primitive on the paper canvas — the design-system gallery. */
function Showcase() {
  return (
    <div className="bg-surface text-text" style={{ padding: 48, minWidth: 560 }}>
      <Stack gap={4}>
        <Stack gap={1}>
          <Eyebrow>Atelier</Eyebrow>
          <Heading level={1}>An editorial design system</Heading>
          <p className="font-[var(--font-sans)] text-text-muted" style={{ maxWidth: '60ch' }}>
            Ink on warm paper, a serif display face, and one decisive moss-green accent used sparingly.
          </p>
        </Stack>

        <Stack direction="row" gap={2}>
          <Button>Primary action</Button>
          <Button variant="secondary">Secondary</Button>
          <Badge tone="accent">New</Badge>
          <Badge>Draft</Badge>
        </Stack>

        <Card>
          <Stack gap={2}>
            <Heading level={3}>Subscribe to the journal</Heading>
            <Input placeholder="you@studio.com" />
            <Button>Join</Button>
          </Stack>
        </Card>
      </Stack>
    </div>
  );
}

const meta: Meta<typeof Showcase> = {
  title: 'Design System/Atelier',
  component: Showcase,
};
export default meta;

export const Gallery: StoryObj<typeof Showcase> = {};
