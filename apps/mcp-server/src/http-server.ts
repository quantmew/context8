import express, { type Express } from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { Context8McpServer } from './server.js';
import type { Config } from './config.js';

interface SessionStore {
  transport: StreamableHTTPServerTransport;
  createdAt: Date;
  lastAccessedAt: Date;
}

/**
 * Create HTTP server for remote MCP connections
 */
export function createHttpServer(config: Config): Express {
  const app = express();
  const sessions = new Map<string, SessionStore>();

  app.use(express.json({ limit: '10mb' }));

  // CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      version: '0.1.0',
      activeSessions: sessions.size,
    });
  });

  // MCP POST endpoint
  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    let session: SessionStore | undefined;

    if (sessionId && sessions.has(sessionId)) {
      session = sessions.get(sessionId)!;
      session.lastAccessedAt = new Date();
    } else if (!sessionId && isInitializeRequest(req.body)) {
      const mcpServer = new Context8McpServer(config);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, {
            transport,
            createdAt: new Date(),
            lastAccessedAt: new Date(),
          });
          console.log(`Session initialized: ${id}`);
        },
      });

      await mcpServer.getServer().connect(transport);

      session = {
        transport,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      };
    } else {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid session' },
        id: null,
      });
    }

    await session.transport.handleRequest(req, res, req.body);
  });

  // MCP GET endpoint (SSE)
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid session' },
        id: null,
      });
    }

    session.lastAccessedAt = new Date();
    await session.transport.handleRequest(req, res);
  });

  // MCP DELETE endpoint
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    const session = sessions.get(sessionId);

    if (session) {
      sessions.delete(sessionId);
    }

    res.json({ success: true });
  });

  // Session cleanup (every minute)
  setInterval(() => {
    const now = new Date();
    const maxIdleMs = 60 * 60 * 1000; // 1 hour

    for (const [id, session] of sessions.entries()) {
      if (now.getTime() - session.lastAccessedAt.getTime() > maxIdleMs) {
        console.log(`Cleaning up stale session: ${id}`);
        sessions.delete(id);
      }
    }
  }, 60000);

  return app;
}
