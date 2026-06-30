/**
 * WebSocket server for real-time platform event broadcasting.
 * Attaches to an existing HTTP server and broadcasts PlatformEventBus events
 * to all connected WebSocket clients.
 */
import { WebSocket, WebSocketServer as WsServer } from 'ws';
import type { Server } from 'node:http';
import type { PlatformEventBus } from './hooks.js';

export function attachWebSocket(httpServer: Server, bus: PlatformEventBus): WsServer {
  const wss = new WsServer({ server: httpServer });

  wss.on('connection', (ws) => {
    // Subscribe to ALL event types
    const unsubSessionCreated = bus.on('session:created', (event) => send(event));
    const unsubSessionStatus = bus.on('session:status', (event) => send(event));
    const unsubSessionCompleted = bus.on('session:completed', (event) => send(event));
    const unsubSessionLog = bus.on('session:log', (event) => send(event));
    const unsubServiceStatus = bus.on('service:status', (event) => send(event));
    const unsubStateUpdate = bus.on('state:update', (event) => send(event));

    function send(event: any): void {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    }

    ws.on('close', () => {
      unsubSessionCreated();
      unsubSessionStatus();
      unsubSessionCompleted();
      unsubSessionLog();
      unsubServiceStatus();
      unsubStateUpdate();
    });

    ws.on('error', () => {
      ws.close();
    });
  });

  return wss;
}
