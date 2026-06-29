import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

/**
 * Welcome — placeholder story for new emdesign workspaces.
 *
 * Once you create your first component, remove or replace this file.
 * Design your first component with:
 *   `npx emdesign design <Name> [instructions]`
 *
 * Or via the `/mds:craft:component` command in Claude Code.
 */
function Welcome() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.25rem',
        padding: '4rem 2rem',
        width: '100%',
        minHeight: '100vh',
        boxSizing: 'border-box',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <span style={{ fontSize: '3rem' }}>🎨</span>
      <h1
        style={{
          margin: 0,
          fontSize: '1.5rem',
          fontWeight: 600,
          color: '#111',
        }}
      >
        emdesign workspace ready
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: '0.95rem',
          lineHeight: 1.6,
          color: '#555',
        }}
      >
        Your design-engineering environment is set up.
        <br />
        Define a design system, then design and capture token-bound React
        components — all inside Storybook.
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          marginTop: '0.75rem',
          fontSize: '0.85rem',
          color: '#666',
        }}
      >
        <code
          style={{
            background: '#f4f4f5',
            padding: '0.4rem 0.75rem',
            borderRadius: 6,
          }}
        >
          emdesign customize --primary &quot;#6366f1&quot; --font
          &quot;Inter&quot;
        </code>
        <code
          style={{
            background: '#f4f4f5',
            padding: '0.4rem 0.75rem',
            borderRadius: 6,
          }}
        >
          emdesign design Button &quot;primary CTA with icon support&quot;
        </code>
      </div>
    </div>
  );
}

const meta: Meta<typeof Welcome> = {
  title: 'Welcome',
  component: Welcome,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof Welcome>;

export const Default: Story = {};
