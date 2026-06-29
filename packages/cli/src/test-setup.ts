/**
 * Vitest setup: pre-mock node:readline so vi.spyOn on built-in module exports
 * works in ESM mode (built-in module exports are non-configurable natively).
 */

import { vi } from 'vitest';

vi.mock('node:readline', () => ({
  createInterface: vi.fn(() => ({
    question: vi.fn((_query: string, cb: (answer: string) => void) => {
      cb('');
    }),
    close: vi.fn(),
  })),
}));
