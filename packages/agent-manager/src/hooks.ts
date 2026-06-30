/**
 * Typed event bus for cross-component communication.
 */
import { EventEmitter } from 'node:events';

export type PlatformEvent =
  | { type: 'session:created'; session: import('./storage.js').EmSession }
  | { type: 'session:status'; sessionId: string; status: import('./storage.js').SessionStatus; phase?: string; round?: number }
  | { type: 'session:completed'; sessionId: string; result?: unknown; error?: string }
  | { type: 'session:log'; sessionId: string; line: string; stream: 'stdout' | 'stderr' }
  | { type: 'service:status'; service: import('./types.js').ServiceType; status: import('./types.js').ServiceStatus; info?: Partial<import('./types.js').ServiceInfo> }
  | { type: 'state:update'; studio: import('@emdesign/backend').StudioState }
  | { type: 'intent:queued'; intent: import('@emdesign/backend').ChangeRequest }
  | { type: 'intent:resolved'; intent: import('@emdesign/backend').ChangeRequest };

export class PlatformEventBus {
  private ee = new EventEmitter();

  constructor() {
    this.ee.setMaxListeners(100);
  }

  on<E extends PlatformEvent['type']>(
    type: E,
    handler: (event: Extract<PlatformEvent, { type: E }>) => void,
  ): () => void {
    this.ee.on(type, handler);
    return () => this.ee.off(type, handler);
  }

  emit<E extends PlatformEvent>(event: E): void {
    this.ee.emit(event.type, event);
  }

  /** Subscribe to ALL event types */
  onAny(handler: (event: PlatformEvent) => void): () => void {
    const wrapped = (_type: string, event: PlatformEvent) => handler(event);
    // We use the 'newListener' trick — subscribe to each type individually
    // Simpler approach: just listen on a meta-channel
    for (const type of [
      'session:created', 'session:status', 'session:completed', 'session:log',
      'service:status', 'state:update', 'intent:queued', 'intent:resolved',
    ] as const) {
      this.ee.on(type, wrapped.bind(null, type));
    }
    return () => {
      for (const type of [
        'session:created', 'session:status', 'session:completed', 'session:log',
        'service:status', 'state:update', 'intent:queued', 'intent:resolved',
      ] as const) {
        this.ee.off(type, wrapped);
      }
    };
  }
}
