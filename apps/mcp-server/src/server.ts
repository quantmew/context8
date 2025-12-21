import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { Config } from './config.js';
import { searchCodebaseTool } from './tools/search-codebase.js';
import { resolveLibraryTool } from './tools/resolve-library.js';
import { fetchFileTool } from './tools/fetch-file.js';
import { listReposTool } from './tools/list-repos.js';
import { resolveLibraryIdTool } from './tools/resolve-library-id.js';
import { getLibraryDocsTool } from './tools/get-library-docs.js';
import { getWikiDocsTool } from './tools/get-wiki-docs.js';
import { deleteProjectTool } from './tools/delete-project.js';

/**
 * Context8 MCP Server
 * Exposes private codebase search capabilities to AI coding assistants
 *
 * Context7-compatible tools:
 * - resolve-library-id: Resolve library name to Context7-compatible ID
 * - get-library-docs: Fetch documentation with mode/topic/page support
 * - get-wiki-docs: Fetch comprehensive wiki documentation (DeepWiki feature)
 */
export class Context8McpServer {
  private server: McpServer;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.server = new McpServer({
      name: 'context8',
      version: '0.1.0',
    });

    this.registerTools();
  }

  private registerTools(): void {
    // ==========================================
    // Context7-Compatible Tools (Primary)
    // ==========================================

    // Tool: resolve-library-id
    this.server.tool(
      'resolve-library-id',
      `Resolves a package/product name to a Context7-compatible library ID and returns a list of matching libraries.

You MUST call this function before 'get-library-docs' to obtain a valid Context7-compatible library ID UNLESS the user explicitly provides a library ID in the format '/local/{uuid}' in their query.

Selection Process:
1. Analyze the query to understand what library/package the user is looking for
2. Return the most relevant match based on:
   - Name similarity to the query (exact matches prioritized)
   - Description relevance to the query's intent
   - Documentation coverage (prioritize libraries with higher Code Snippet counts)

Response Format:
- Returns the selected library ID in a clearly marked section
- Provides a brief explanation for why this library was chosen
- If multiple good matches exist, acknowledge this but proceed with the most relevant one
- If no good matches exist, clearly state this and suggest query refinements`,
      {
        libraryName: z.string().min(1).describe('Library name to search for and retrieve a Context7-compatible library ID'),
      },
      async (args, extra) => {
        return resolveLibraryIdTool(args, extra, this.config);
      }
    );

    // Tool: get-library-docs
    this.server.tool(
      'get-library-docs',
      `Fetches up-to-date documentation for a library. You must call 'resolve-library-id' first to obtain the exact Context7-compatible library ID required to use this tool, UNLESS the user explicitly provides a library ID in the format '/local/{uuid}' in their query.

Use mode='code' (default) for API references and code examples, or mode='info' for conceptual guides, narrative information, and architectural questions.`,
      {
        context7CompatibleLibraryID: z
          .string()
          .min(1)
          .describe("Exact Context7-compatible library ID (e.g., '/local/{uuid}') retrieved from 'resolve-library-id' or directly from user query."),
        mode: z
          .enum(['code', 'info'])
          .default('code')
          .describe("Documentation mode: 'code' for API references and code examples (default), 'info' for conceptual guides, narrative information, and architectural questions."),
        topic: z.string().optional().describe("Topic to focus documentation on (e.g., 'hooks', 'routing')."),
        page: z
          .number()
          .int()
          .min(1)
          .max(10)
          .default(1)
          .describe('Page number for pagination (start: 1, default: 1). If the context is not sufficient, try page=2, page=3, etc.'),
      },
      async (args, extra) => {
        return getLibraryDocsTool(args, extra, this.config);
      }
    );

    // Tool: get-wiki-docs
    this.server.tool(
      'get-wiki-docs',
      `Fetches comprehensive wiki documentation generated for a library. The wiki contains structured pages covering architecture, getting started, core concepts, API reference, and more.

You must call 'resolve-library-id' first to obtain the Context7-compatible library ID, UNLESS the user explicitly provides a library ID in the format '/local/{uuid}' in their query.

Returns wiki structure with all pages. Use pageId parameter to fetch a specific page's full content.`,
      {
        context7CompatibleLibraryID: z
          .string()
          .min(1)
          .describe("Exact Context7-compatible library ID (e.g., '/local/{uuid}') retrieved from 'resolve-library-id'."),
        pageId: z
          .string()
          .optional()
          .describe("Specific wiki page ID to fetch (e.g., 'getting-started', 'architecture-overview'). If omitted, returns all pages."),
        includeContent: z
          .boolean()
          .default(true)
          .describe('Whether to include page content in the response. Set to false to get only page structure.'),
      },
      async (args, extra) => {
        return getWikiDocsTool(args, extra, this.config);
      }
    );

    // Tool: delete-project
    this.server.tool(
      'delete-project',
      `Deletes a project and all its associated data including:
- Database records (source, files, snippets, wiki pages, tasks)
- Vector embeddings from Qdrant

WARNING: This operation is irreversible. All indexed data will be permanently deleted.

Parameters:
- projectId: The project ID (Context7-compatible like '/local/{uuid}' or raw UUID)
- force: If true, cancels any running tasks before deletion (default: false)

Returns success status and counts of deleted items.`,
      {
        projectId: z
          .string()
          .min(1)
          .describe(
            "Project ID to delete. Can be Context7-compatible format ('/local/{uuid}') or raw UUID."
          ),
        force: z
          .boolean()
          .default(false)
          .describe(
            'If true, cancel any running/pending tasks before deletion. Default: false (will reject if tasks are running).'
          ),
      },
      async (args, extra) => {
        return deleteProjectTool(args, extra, this.config);
      }
    );

    // ==========================================
    // Legacy Tools (Maintained for compatibility)
    // ==========================================

    // Tool: search_codebase (legacy)
    this.server.tool(
      'search_codebase',
      `[LEGACY - prefer get-library-docs] Search across your organization's private code repositories using semantic and keyword search.
Returns relevant code snippets with file locations and citations.
Use this when you need to find implementations, examples, or understand how something is used in the codebase.`,
      {
        query: z.string().min(1).max(1000).describe('Natural language search query or code snippet'),
        repo_filter: z.array(z.string()).optional().describe('Repository names to limit search scope'),
        language_filter: z.array(z.string()).optional().describe('Programming languages to filter by'),
        limit: z.number().int().min(1).max(50).default(10).describe('Maximum results'),
      },
      async (args, extra) => {
        return searchCodebaseTool(args, extra, this.config);
      }
    );

    // Tool: resolve_internal_library (legacy)
    this.server.tool(
      'resolve_internal_library',
      `[LEGACY - prefer resolve-library-id] Resolve a natural language library name or alias to specific repository IDs.
Use this when a user mentions an internal component by its common name.`,
      {
        name: z.string().min(1).describe('Library name or alias'),
      },
      async (args, extra) => {
        return resolveLibraryTool(args, extra, this.config);
      }
    );

    // Tool: fetch_file_context
    this.server.tool(
      'fetch_file_context',
      `Retrieve the full content of a specific file or a range of lines.
Use this after search returns a snippet and you need more context.`,
      {
        repo_name: z.string().describe('Repository name'),
        file_path: z.string().describe('File path within the repository'),
        start_line: z.number().int().min(1).optional().describe('Starting line (1-indexed)'),
        end_line: z.number().int().min(1).optional().describe('Ending line (inclusive)'),
      },
      async (args, extra) => {
        return fetchFileTool(args, extra, this.config);
      }
    );

    // Tool: list_repos
    this.server.tool(
      'list_repos',
      `List all indexed repositories accessible to the current user.`,
      {
        filter: z.string().optional().describe('Search filter'),
      },
      async (args, extra) => {
        return listReposTool(args, extra, this.config);
      }
    );
  }

  /**
   * Start server in stdio mode (for local MCP via npx)
   */
  async startStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Context8 MCP Server running on stdio');
  }

  /**
   * Get the underlying McpServer for HTTP transport
   */
  getServer(): McpServer {
    return this.server;
  }
}
