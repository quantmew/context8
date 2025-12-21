#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import express from 'express';
import { Command } from 'commander';

import { searchLibraries, fetchLibraryDocumentation } from './lib/api.js';
import { formatSearchResults } from './lib/utils.js';
import { LibrarySearchResponse, DOCUMENTATION_MODES } from './lib/types.js';

/** Default number of results to return per page */
const DEFAULT_RESULTS_LIMIT = 10;
/** Default HTTP server port */
const DEFAULT_PORT = 3000;

// Parse CLI arguments
const program = new Command()
  .option('--transport <stdio|http>', 'transport type', 'stdio')
  .option('--port <number>', 'port for HTTP transport', DEFAULT_PORT.toString())
  .option('--api-url <url>', 'Context8 API base URL (or set CONTEXT8_API_URL env var)')
  .allowUnknownOption()
  .parse(process.argv);

const cliOptions = program.opts<{
  transport: string;
  port: string;
  apiUrl?: string;
}>();

// Validate transport option
const allowedTransports = ['stdio', 'http'];
if (!allowedTransports.includes(cliOptions.transport)) {
  console.error(
    `Invalid --transport value: '${cliOptions.transport}'. Must be one of: stdio, http.`
  );
  process.exit(1);
}

const TRANSPORT_TYPE = (cliOptions.transport || 'stdio') as 'stdio' | 'http';

// Set API URL from CLI if provided
if (cliOptions.apiUrl) {
  process.env.CONTEXT8_API_URL = cliOptions.apiUrl;
}

// Validate transport-specific flags
const passedPortFlag = process.argv.includes('--port');
if (TRANSPORT_TYPE === 'stdio' && passedPortFlag) {
  console.error('The --port flag is not allowed when using --transport stdio.');
  process.exit(1);
}

// HTTP port configuration
const CLI_PORT = (() => {
  const parsed = parseInt(cliOptions.port, 10);
  return isNaN(parsed) ? undefined : parsed;
})();

// Create MCP Server
const server = new McpServer(
  {
    name: 'Context8',
    version: '0.1.0',
  },
  {
    instructions:
      'Use this server to search and retrieve code context from your local codebase projects.',
  }
);

// Tool 1: resolve-library-id
server.registerTool(
  'resolve-library-id',
  {
    title: 'Resolve Context8 Project ID',
    description: `Resolves a package/product name to a Context7-compatible library ID and returns a list of matching libraries.

You MUST call this function before 'get-library-docs' to obtain a valid Context7-compatible library ID UNLESS the user explicitly provides a library ID in the format '/org/project' or '/org/project/version' in their query.

Selection Process:
1. Analyze the query to understand what library/package the user is looking for
2. Return the most relevant match based on:
- Name similarity to the query (exact matches prioritized)
- Description relevance to the query's intent
- Documentation coverage (prioritize libraries with higher Code Snippet counts)
- Source reputation (consider libraries with High or Medium reputation more authoritative)
- Benchmark Score: Quality indicator (100 is the highest score)

Response Format:
- Return the selected library ID in a clearly marked section
- Provide a brief explanation for why this library was chosen
- If multiple good matches exist, acknowledge this but proceed with the most relevant one
- If no good matches exist, clearly state this and suggest query refinements

For ambiguous queries, request clarification before proceeding with a best-guess match.`,
    inputSchema: {
      libraryName: z
        .string()
        .describe('Library name to search for and retrieve a Context7-compatible library ID.'),
    },
  },
  async ({ libraryName }) => {
    const searchResponse: LibrarySearchResponse = await searchLibraries(libraryName);

    if (!searchResponse.results || searchResponse.results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: searchResponse.error
              ? searchResponse.error
              : 'No projects found. Make sure Context8 is running and projects are indexed.',
          },
        ],
      };
    }

    const resultsText = formatSearchResults(searchResponse);

    const responseText = `Available Libraries:

Each result includes:
- Library ID: Context7-compatible identifier (format: /org/project)
- Name: Library or package name
- Description: Short summary
- Code Snippets: Number of available code examples
- Source Reputation: Authority indicator (High, Medium, Low, or Unknown)
- Benchmark Score: Quality indicator (100 is the highest score)
- Versions: List of versions if available. Use one of those versions if the user provides a version in their query. The format of the version is /org/project/version.

For best results, select libraries based on name match, source reputation, snippet coverage, benchmark score, and relevance to your use case.

----------

${resultsText}`;

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  }
);

// Tool 2: get-library-docs
server.registerTool(
  'get-library-docs',
  {
    title: 'Get Library Docs',
    description:
      "Fetches up-to-date documentation for a library. You must call 'resolve-library-id' first to obtain the exact Context7-compatible library ID required to use this tool, UNLESS the user explicitly provides a library ID in the format '/org/project' or '/org/project/version' in their query. Use mode='code' (default) for API references and code examples, or mode='info' for conceptual guides, narrative information, and architectural questions.",
    inputSchema: {
      context7CompatibleLibraryID: z
        .string()
        .describe(
          "Exact Context7-compatible library ID (e.g., '/mongodb/docs', '/vercel/next.js', '/supabase/supabase', '/vercel/next.js/v14.3.0-canary.87') retrieved from 'resolve-library-id' or directly from user query in the format '/org/project' or '/org/project/version'."
        ),
      mode: z
        .enum(['code', 'info'])
        .optional()
        .default('code')
        .describe(
          "Documentation mode: 'code' for API references and code examples (default), 'info' for conceptual guides, narrative information, and architectural questions."
        ),
      topic: z
        .string()
        .optional()
        .describe("Topic to focus documentation on (e.g., 'hooks', 'routing')."),
      page: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe(
          'Page number for pagination (start: 1, default: 1). If the context is not sufficient, try page=2, page=3, page=4, etc. with the same topic.'
        ),
    },
  },
  async ({ context7CompatibleLibraryID, mode = DOCUMENTATION_MODES.CODE, page = 1, topic }) => {
    const fetchDocsResponse = await fetchLibraryDocumentation(
      context7CompatibleLibraryID,
      mode,
      {
        page,
        limit: DEFAULT_RESULTS_LIMIT,
        topic,
      }
    );

    if (!fetchDocsResponse) {
      return {
        content: [
          {
            type: 'text',
            text: "Documentation not found or not finalized for this library. This might have happened because you used an invalid Context7-compatible library ID. To get a valid Context7-compatible library ID, use the 'resolve-library-id' with the package name you wish to retrieve documentation for.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: fetchDocsResponse,
        },
      ],
    };
  }
);

async function main() {
  if (TRANSPORT_TYPE === 'http') {
    const initialPort = CLI_PORT ?? DEFAULT_PORT;
    let actualPort = initialPort;

    const app = express();
    app.use(express.json());

    // CORS middleware
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,DELETE');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, MCP-Session-Id, MCP-Protocol-Version'
      );
      res.setHeader('Access-Control-Expose-Headers', 'MCP-Session-Id');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });

    // MCP endpoint
    app.all('/mcp', async (req: express.Request, res: express.Response) => {
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });

        res.on('close', () => {
          transport.close();
        });

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          });
        }
      }
    });

    // Health check
    app.get('/ping', (_req: express.Request, res: express.Response) => {
      res.json({ status: 'ok', message: 'pong' });
    });

    // 404 handler
    app.use((_req: express.Request, res: express.Response) => {
      res.status(404).json({
        error: 'not_found',
        message: 'Endpoint not found. Use /mcp for MCP protocol communication.',
      });
    });

    const startServer = (port: number, maxAttempts = 10) => {
      const httpServer = app.listen(port);

      httpServer.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && port < initialPort + maxAttempts) {
          console.warn(`Port ${port} is in use, trying port ${port + 1}...`);
          startServer(port + 1, maxAttempts);
        } else {
          console.error(`Failed to start server: ${err.message}`);
          process.exit(1);
        }
      });

      httpServer.once('listening', () => {
        actualPort = port;
        console.error(
          `Context8 MCP Server running on HTTP at http://localhost:${actualPort}/mcp`
        );
      });
    };

    startServer(initialPort);
  } else {
    // STDIO transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Context8 MCP Server running on stdio');
  }
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
