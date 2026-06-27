import type { Preview } from '@storybook/react';
import '../src/index.css';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: { disable: true },
  },
};
export default preview;
