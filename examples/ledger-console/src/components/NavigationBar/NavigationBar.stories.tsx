import type { Meta, StoryObj } from '@storybook/react';
import type { StoryCharter } from '@emdesign/dsr/charters/story-charter';
import { NavigationBar } from './NavigationBar';

// ── Component-level charters — run against EVERY story of NavigationBar ──
const componentCharters: StoryCharter[] = [
  {
    name: 'brand-visible',
    description: 'The brand text is rendered and visible',
    severity: 'P1',
    target: 'brand text',
    run({ getByText }) {
      const brand = getByText('Digits') ?? getByText('Ledger Console');
      if (!brand) throw new Error('Brand text not found in rendered output');
    },
  },
  {
    name: 'cta-present',
    description: 'The CTA button exists and has a label',
    severity: 'P1',
    target: 'CTA button',
    async run({ getByRole }) {
      const btn = await getByRole('button');
      if (!btn) throw new Error('No button found in NavigationBar');
      if (!btn.textContent?.trim()) throw new Error('CTA button has no text');
    },
  },
  {
    name: 'nav-semantic',
    description: 'Navigation uses semantic <nav> element',
    severity: 'P2',
    target: '<nav> element',
    run({ container }) {
      const nav = container.querySelector('nav');
      if (!nav) throw new Error('No <nav> element found');
      if (nav.getAttribute('aria-label') !== 'Primary navigation') {
        throw new Error('<nav> missing aria-label="Primary navigation"');
      }
    },
  },
];

// Attach to the component so the charter decorator picks them up
(NavigationBar as unknown as Record<string, unknown>).charters = componentCharters;

const meta: Meta<typeof NavigationBar> = {
  title: 'Generated/NavigationBar',
  component: NavigationBar,
  tags: ['autodocs'],
  args: {
    brand: 'Digits',
    ctaLabel: 'GET STARTED',
  },
  argTypes: {
    brand: { control: 'text' },
    ctaLabel: { control: 'text' },
    onCtaClick: { action: 'cta-clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof NavigationBar>;

export const Default: Story = {};

export const CustomLabels: Story = {
  args: { brand: 'Ledger Console', ctaLabel: 'SEND PAYMENT' },
};

export const Minimal: Story = {
  args: { navLinks: [] },
};
