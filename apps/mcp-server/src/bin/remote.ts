#!/usr/bin/env node

/**
 * Remote MCP HTTP Server Entry Point
 */

import { createHttpServer } from '../http-server.js';
import { loadConfig } from '../config.js';

async function main() {
  const config = loadConfig();
  config.server.mode = 'remote';

  const app = createHttpServer(config);
  const port = config.server.port;

  app.listen(port, () => {
    console.log(`Context8 MCP HTTP Server running on http://localhost:${port}/mcp`);
    console.log(`Health check: http://localhost:${port}/health`);
  });
}

main().catch((error) => {
  console.error('Failed to start HTTP server:', error);
  process.exit(1);
});
