import type { VisionProvider } from './types.js';

/**
 * Provider registry — a singleton map so both MCP tools and CLI can share registered
 * providers without passing instance references.
 *
 * Built-in providers (claude, gemini, minimax) are lazily registered on first access
 * via dynamic imports to avoid circular dependencies.
 */
class ProviderRegistry {
  private providers = new Map<string, VisionProvider>();

  register(provider: VisionProvider): void {
    this.providers.set(provider.id, provider);
  }

  resolve(id: string): VisionProvider | undefined {
    return this.providers.get(id);
  }

  list(): VisionProvider[] {
    return [...this.providers.values()];
  }

  /** Return only providers whose dependencies are satisfied (API keys present, etc.). */
  available(): VisionProvider[] {
    return this.list().filter((p) => p.available());
  }

  firstAvailable(): VisionProvider | undefined {
    return this.available()[0];
  }
}

/** Global singleton. */
export const registry = new ProviderRegistry();

// Lazy registration state
let builtinsRegistered = false;

async function ensureBuiltins(): Promise<void> {
  if (builtinsRegistered) return;
  builtinsRegistered = true;
  try {
    const { claudeProvider } = await import('./providers/claude.js');
    registry.register(claudeProvider);
  } catch { /* skip if unavailable */ }
  try {
    const { geminiProvider } = await import('./providers/gemini.js');
    registry.register(geminiProvider);
  } catch { /* skip if unavailable */ }
  try {
    const { minimaxProvider } = await import('./providers/minimax.js');
    registry.register(minimaxProvider);
  } catch { /* skip if unavailable */ }
}

/** Convenience wrappers — all trigger lazy registration on first call. */
export async function registerVisionProvider(provider: VisionProvider): Promise<void> {
  await ensureBuiltins();
  registry.register(provider);
}

export async function resolveVisionProvider(id: string): Promise<VisionProvider | undefined> {
  await ensureBuiltins();
  return registry.resolve(id);
}

export async function listVisionProviders(): Promise<VisionProvider[]> {
  await ensureBuiltins();
  return registry.list();
}

export async function availableVisionProviders(): Promise<VisionProvider[]> {
  await ensureBuiltins();
  return registry.available();
}
