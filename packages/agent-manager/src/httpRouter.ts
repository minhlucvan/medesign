/**
 * Express router for session and service management HTTP endpoints.
 * Designed to be mounted on the existing HTTP bridge at /api/.
 */
import { Router } from 'express';
import type { PlatformOrchestrator } from '../types.js';

export function createSessionRouter(orch: PlatformOrchestrator): Router {
  const router = Router();

  // ── Sessions ──────────────────────────────────────────────────────

  /** List all sessions (both Claude-native and emdesign-managed) */
  router.get('/sessions', async (_req, res, next) => {
    try {
      const [claudeSessions, emdesignSessions] = await Promise.all([
        orch.getClaudeSessions(),
        Promise.resolve(orch.listSessions()),
      ]);
      res.json({ claudeSessions, emdesignSessions });
    } catch (e) { next(e); }
  });

  /** Create a new session */
  router.post('/sessions', async (req, res, next) => {
    try {
      const session = await orch.createSession({
        type: req.body.type ?? 'custom',
        workflow: req.body.workflow ?? req.body.type ?? 'custom',
        args: req.body.args ?? {},
        model: req.body.model,
        instruction: req.body.instruction,
        scope: req.body.scope,
        origin: req.body.origin,
        elementContext: req.body.elementContext,
      });
      res.status(201).json(session);
    } catch (e) { next(e); }
  });

  /** Get a specific session */
  router.get('/sessions/:id', (req, res) => {
    const s = orch.getSession(req.params.id);
    if (!s) return res.status(404).json({ error: 'session not found' });
    res.json(s);
  });

  /** Cancel a running session */
  router.post('/sessions/:id/cancel', async (req, res, next) => {
    try {
      await orch.cancelSession(req.params.id);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  /** Resume a session */
  router.post('/sessions/:id/resume', async (req, res, next) => {
    try {
      await orch.resumeSession(req.params.id);
      res.json(orch.getSession(req.params.id));
    } catch (e) { next(e); }
  });

  /** Get conversation messages for a Claude session */
  router.get('/sessions/:id/conversation', async (req, res, next) => {
    try {
      const messages = await orch.getConversation(req.params.id);
      res.json(messages);
    } catch (e) { next(e); }
  });

  /** List Claude projects */
  router.get('/projects', async (_req, res, next) => {
    try {
      const projects = await orch.getProjects();
      res.json(projects);
    } catch (e) { next(e); }
  });

  // ── Services ──────────────────────────────────────────────────────

  /** List all services with status */
  router.get('/services', (_req, res) => {
    res.json(orch.listServices());
  });

  /** Start a service */
  router.post('/services/:type/start', async (req, res, next) => {
    try {
      const info = await orch.startService(req.params.type as any);
      res.json(info);
    } catch (e) { next(e); }
  });

  /** Stop a service */
  router.post('/services/:type/stop', async (req, res, next) => {
    try {
      await orch.stopService(req.params.type as any);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  /** Restart a service */
  router.post('/services/:type/restart', async (req, res, next) => {
    try {
      const info = await orch.restartService(req.params.type as any);
      res.json(info);
    } catch (e) { next(e); }
  });

  // ── Platform Status ──────────────────────────────────────────────

  /** Unified platform status */
  router.get('/platform/status', (_req, res) => {
    res.json(orch.getState());
  });

  return router;
}
