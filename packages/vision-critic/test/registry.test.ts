import { describe, it, expect } from 'vitest';
import { registry, registerVisionProvider, resolveVisionProvider } from '../src/registry.js';
import { createMockProvider } from './helpers.js';

describe('ProviderRegistry', () => {
  it('registers and resolves a provider', async () => {
    const mock = createMockProvider({ id: 'test-provider', name: 'Test' });
    await registerVisionProvider(mock);
    expect(await resolveVisionProvider('test-provider')).toBe(mock);
  });

  it('returns undefined for unregistered provider', async () => {
    expect(await resolveVisionProvider('nonexistent')).toBeUndefined();
  });

  it('lists registered providers', async () => {
    await registerVisionProvider(createMockProvider({ id: 'reg-test-a' }));
    await registerVisionProvider(createMockProvider({ id: 'reg-test-b' }));
    const ids = registry.list().map((p) => p.id);
    expect(ids).toContain('reg-test-a');
    expect(ids).toContain('reg-test-b');
  });

  it('filters available providers', async () => {
    await registerVisionProvider(createMockProvider({ id: 'avail', available: () => true }));
    await registerVisionProvider(createMockProvider({ id: 'unavail', available: () => false }));
    const avail = registry.available();
    expect(avail.some((p) => p.id === 'avail')).toBe(true);
    expect(avail.some((p) => p.id === 'unavail')).toBe(false);
  });
});
