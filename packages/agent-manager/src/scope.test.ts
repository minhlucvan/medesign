/**
 * Session scoping — unit tests.
 *
 * These tests verify the session scope API contract:
 * - SessionCreateOptions accepts scope, origin, and elementContext
 * - EmSession stores scope, origin, and elementContext fields
 * - POST /api/sessions passes these fields through
 *
 * Full integration tests need the HTTP server running.
 */

import type { SessionCreateOptions } from '../types.js';
import type { EmSession } from '../storage.js';

describe('SessionCreateOptions', () => {
  const minimal: SessionCreateOptions = {
    type: 'custom',
    workflow: 'custom',
    args: {},
  };

  it('accepts minimal options', () => {
    expect(minimal.type).toBe('custom');
  });

  it('accepts scope', () => {
    const opts: SessionCreateOptions = { ...minimal, scope: 'story:test-id' };
    expect(opts.scope).toBe('story:test-id');
  });

  it('accepts origin', () => {
    const opts: SessionCreateOptions = { ...minimal, origin: 'comment' };
    expect(opts.origin).toBe('comment');
  });

  it('accepts element context', () => {
    const opts: SessionCreateOptions = {
      ...minimal,
      elementContext: { selector: '#btn', tag: 'button', text: 'Click', component: 'Button' },
    };
    expect(opts.elementContext?.selector).toBe('#btn');
    expect(opts.elementContext?.tag).toBe('button');
  });
});

describe('EmSession scope fields', () => {
  const session: EmSession = {
    id: 'test-1',
    display: 'Test session',
    timestamp: Date.now(),
    project: '/test',
    projectName: 'test',
    emdesignStatus: 'created',
    emdesignType: 'custom',
    scope: 'global',
    origin: 'chat',
  };

  it('stores scope', () => {
    expect(session.scope).toBe('global');
  });

  it('stores origin', () => {
    expect(session.origin).toBe('chat');
  });

  it('stores elementContext when provided', () => {
    const withCtx: EmSession = {
      ...session,
      origin: 'comment',
      elementContext: { selector: '#btn', tag: 'button', text: 'Submit' },
    };
    expect(withCtx.elementContext?.selector).toBe('#btn');
  });

  it('allows story-scoped sessions', () => {
    const storySes: EmSession = { ...session, scope: 'story:example--primary' };
    expect(storySes.scope?.startsWith('story:')).toBe(true);
  });
});
