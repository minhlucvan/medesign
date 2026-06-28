import type { Preview } from '@storybook/react';
import '../src/index.css';
import { charterDecorator } from '@emdesign/addon/charters/preview';
import { withComponentContext } from '@emdesign/addon/harness';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: { disable: true },
  },
  decorators: [charterDecorator, withComponentContext],
};
export default preview;
