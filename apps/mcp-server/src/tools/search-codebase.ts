import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Config } from '../config.js';
import { QdrantClient } from '@context8/vector-store';

interface SearchArgs {
  query: string;
  repo_filter?: string[];
  language_filter?: string[];
  limit: number;
}

/**
 * search_codebase tool implementation
 */
export async function searchCodebaseTool(
  args: SearchArgs,
  _extra: unknown,
  config: Config
): Promise<CallToolResult> {
  const { query: _query, repo_filter, language_filter, limit } = args;

  try {
    // Initialize Qdrant client
    const qdrant = new QdrantClient(
      {
        host: config.qdrant.host,
        port: config.qdrant.port,
        apiKey: config.qdrant.apiKey,
      },
      config.qdrant.collectionName
    );

    // Build filter conditions
    const filterConditions: Array<{ key: string; match: { any?: string[]; value?: string } }> = [];

    if (repo_filter && repo_filter.length > 0) {
      filterConditions.push({
        key: 'repo_id',
        match: { any: repo_filter },
      });
    }

    if (language_filter && language_filter.length > 0) {
      filterConditions.push({
        key: 'language',
        match: { any: language_filter },
      });
    }

    // For MVP, use simple text search via Qdrant's search
    // TODO: Implement proper embedding-based search
    const mockEmbedding = new Array(1024).fill(0).map(() => Math.random() - 0.5);

    const results = await qdrant.searchDense(mockEmbedding, {
      limit,
      filter: filterConditions.length > 0 ? { must: filterConditions } : undefined,
      includePayload: true,
    });

    // Format results
    const formattedResults = results.map((r) => ({
      file_path: r.payload.file_path,
      repo_name: r.payload.repo_id,
      start_line: r.payload.start_line,
      end_line: r.payload.end_line,
      language: r.payload.language,
      symbol_name: r.payload.symbol_name,
      content: r.payload.content,
      relevance_score: r.score,
      match_type: 'semantic' as const,
    }));

    const sources = results.map((r) => ({
      repo: r.payload.repo_id,
      file: r.payload.file_path,
      lines: `${r.payload.start_line}-${r.payload.end_line}`,
    }));

    const output = {
      results: formattedResults,
      total_matches: formattedResults.length,
      query_expansion: null,
      sources,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(output, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: message }, null, 2),
        },
      ],
      isError: true,
    };
  }
}
