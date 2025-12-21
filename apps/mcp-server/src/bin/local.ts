#!/usr/bin/env node

/**
 * Local MCP Server Entry Point
 * Run via: npx context8-mcp or node dist/bin/local.js
 */

import { Context8McpServer } from '../server.js';
import { loadConfig } from '../config.js';

async function main() {
  const config = loadConfig();
  config.server.mode = 'local';

  const server = new Context8McpServer(config);
  await server.startStdio();
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
