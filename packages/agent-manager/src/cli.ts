#!/usr/bin/env node
/**
 * CLI entry point for session browsing — adapted from claude-run (MIT, github.com/nilbuild/claude-run).
 */
import { createSessionServer } from "./server.js";

const port = parseInt(process.env.EMDESIGN_SESSION_PORT ?? "12001", 10);
const claudeDir = process.env.CLAUDE_DIR;

const server = createSessionServer({
  port,
  claudeDir,
  dev: process.argv.includes("--dev"),
});

process.on("SIGINT", () => {
  console.error("\n[emdesign/session] Shutting down...");
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.stop();
  process.exit(0);
});

server.start().catch((err) => {
  console.error("[emdesign/session] Failed to start:", err);
  process.exit(1);
});
