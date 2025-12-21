import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Config } from '../config.js';
import { QdrantClient } from '@context8/vector-store';
import { localSourceRepository, settingsService } from '@context8/database';
import { createProvider, type ProviderName } from '@context8/embedding';
import { parseLibraryId } from '../utils/library-id-parser.js';
import { paginate, truncateToTokenLimit } from '../utils/pagination.js';

interface GetLibraryDocsArgs {
  context7CompatibleLibraryID: string;
  mode?: 'code' | 'info' | 'snippet';
  topic?: string;
  page?: number;
}

// Mode to chunk type mapping
const MODE_CHUNK_TYPES: Record<string, string[]> = {
  code: ['function', 'method', 'class', 'interface', 'type_alias', 'module', 'variable'],
  info: ['file_summary', 'comment', 'docstring', 'readme', 'documentation'],
  snippet: ['snippet'], // Knowledge base entries in llms.txt format
};

const PAGE_SIZE = 20;
const DEFAULT_TOKEN_LIMIT = 32000;

interface DocResult {
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  chunkType: string;
  symbolName: string | null;
  content: string;
  summary?: string;
  relevanceScore: number;
}

// Snippet-specific result for llms.txt format
interface SnippetResult {
  title: string;
  description: string;
  content: string;
  language: string;
  sourceUrl: string | null;
  sourceFilePath: string;
  category: string;
  keywords: string[];
  relevanceScore: number;
}

/**
 * get-library-docs tool implementation
 *
 * Fetches up-to-date documentation for a library.
 * Supports three modes:
 * - mode='code' for API references and code examples (default)
 * - mode='info' for conceptual guides, narrative information, and architectural questions
 * - mode='snippet' for knowledge base entries in llms.txt format
 */
export async function getLibraryDocsTool(
  args: GetLibraryDocsArgs,
  _extra: unknown,
  config: Config
): Promise<CallToolResult> {
  const { context7CompatibleLibraryID, mode = 'code', topic, page = 1 } = args;

  try {
    // Parse the library ID
    const parsed = parseLibraryId(context7CompatibleLibraryID);
    if (!parsed) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: 'Invalid library ID format',
                message: `Expected format: /local/{uuid} or /{owner}/{repo}. Got: ${context7CompatibleLibraryID}`,
                suggestion: 'Use resolve-library-id first to get a valid library ID',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Currently only support local sources
    if (parsed.type !== 'local') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: 'Remote sources not yet supported',
                message: 'Currently only local sources (/local/{uuid}) are supported.',
                libraryId: context7CompatibleLibraryID,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Verify the local source exists
    const source = await localSourceRepository.findById(parsed.id);
    if (!source) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: 'Library not found',
                message: `No library found with ID: ${parsed.id}`,
                suggestion: 'Use resolve-library-id to find the correct library ID',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Get embedding provider configuration
    const embeddingConfig = await settingsService.getEmbeddingConfig();
    if (!embeddingConfig.apiKey) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: 'Embedding API not configured',
                message: 'Please configure embedding API key in settings',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Create embedding provider
    const defaultDimensions: Record<string, number> = {
      openai: 1536,
      bigmodel: 1024,
      voyage: 1024,
    };
    const provider = embeddingConfig.provider as ProviderName;
    const dimensions = defaultDimensions[provider] ?? 1536;

    const embeddingProvider = createProvider({
      provider: provider || 'openai',
      apiKey: embeddingConfig.apiKey,
      baseUrl: embeddingConfig.baseUrl,
      model: embeddingConfig.model,
      dimensions,
    });

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

    // Filter by source ID
    filterConditions.push({
      key: 'source_id',
      match: { value: source.id },
    });

    // Filter by mode (chunk types)
    if (mode && MODE_CHUNK_TYPES[mode]) {
      filterConditions.push({
        key: 'chunk_type',
        match: { any: MODE_CHUNK_TYPES[mode] },
      });
    }

    // Build search query
    let searchQuery = topic || source.name;
    if (topic && mode === 'info') {
      searchQuery = `${topic} documentation guide tutorial`;
    } else if (topic && mode === 'code') {
      searchQuery = `${topic} implementation function class api`;
    } else if (topic && mode === 'snippet') {
      searchQuery = `${topic} how to example usage`;
    }

    // Generate embedding for the query
    const queryEmbedding = await embeddingProvider.embed(searchQuery);

    // Search Qdrant
    const searchResults = await qdrant.searchDense(queryEmbedding, {
      limit: 100, // Get more results for pagination
      filter: { must: filterConditions },
      includePayload: true,
    });

    // Handle snippet mode separately for llms.txt format
    if (mode === 'snippet') {
      const snippetResults: SnippetResult[] = searchResults.map((r) => {
        const payload = r.payload as unknown as Record<string, unknown>;
        return {
          title: (payload.title as string) || 'Untitled',
          description: (payload.description as string) || '',
          content: r.payload.content,
          language: r.payload.language || 'text',
          sourceUrl: (payload.source_url as string | null) || null,
          sourceFilePath: r.payload.file_path,
          category: (payload.category as string) || 'OTHER',
          keywords: (payload.keywords as string[]) || [],
          relevanceScore: r.score,
        };
      });

      // Apply pagination
      const paginatedSnippets = paginate(snippetResults, { page, pageSize: PAGE_SIZE });

      // Apply token limit
      const { results: tokenLimitedSnippets, totalTokens, truncated } = truncateToTokenLimit(
        paginatedSnippets.items,
        DEFAULT_TOKEN_LIMIT
      );

      // Format as llms.txt style
      const formattedSnippets = tokenLimitedSnippets.map((snippet) => {
        const sourceInfo = snippet.sourceUrl || snippet.sourceFilePath;
        return [
          `### ${snippet.title}`,
          `Source: ${sourceInfo}`,
          snippet.description,
          '```' + snippet.language,
          snippet.content,
          '```',
          '--------------------------------',
        ].join('\n');
      });

      const output = {
        library: {
          id: context7CompatibleLibraryID,
          name: source.name,
          path: source.path,
        },
        query: {
          mode,
          topic: topic || null,
          page,
        },
        results: {
          count: tokenLimitedSnippets.length,
          totalMatches: snippetResults.length,
          totalPages: paginatedSnippets.totalPages,
          hasMore: paginatedSnippets.hasMore,
          tokensTruncated: truncated,
          totalTokens,
        },
        documentation: formattedSnippets.join('\n\n'),
        nextPageSuggestion:
          paginatedSnippets.hasMore
            ? `For more results, call get-library-docs with page=${page + 1}`
            : null,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(output, null, 2),
          },
        ],
      };
    }

    // Format results for code/info modes
    const allResults: DocResult[] = searchResults.map((r) => ({
      filePath: r.payload.file_path,
      startLine: r.payload.start_line ?? 0,
      endLine: r.payload.end_line ?? 0,
      language: r.payload.language,
      chunkType: r.payload.chunk_type,
      symbolName: r.payload.symbol_name ?? null,
      content: r.payload.content,
      summary: (r.payload as unknown as Record<string, unknown>).summary as string | undefined,
      relevanceScore: r.score,
    }));

    // Apply pagination
    const paginatedResults = paginate(allResults, { page, pageSize: PAGE_SIZE });

    // Apply token limit to paginated results
    const { results: tokenLimitedResults, totalTokens, truncated } = truncateToTokenLimit(
      paginatedResults.items,
      DEFAULT_TOKEN_LIMIT
    );

    // Format output for LLM consumption
    const formattedDocs = tokenLimitedResults.map((doc) => {
      const header = `### ${doc.filePath}:${doc.startLine}-${doc.endLine} (${doc.chunkType})`;
      const symbolInfo = doc.symbolName ? `Symbol: ${doc.symbolName}` : '';
      const summaryInfo = doc.summary ? `Summary: ${doc.summary}` : '';

      return [
        header,
        symbolInfo,
        summaryInfo,
        '```' + doc.language,
        doc.content,
        '```',
      ]
        .filter(Boolean)
        .join('\n');
    });

    const output = {
      library: {
        id: context7CompatibleLibraryID,
        name: source.name,
        path: source.path,
      },
      query: {
        mode,
        topic: topic || null,
        page,
      },
      results: {
        count: tokenLimitedResults.length,
        totalMatches: allResults.length,
        totalPages: paginatedResults.totalPages,
        hasMore: paginatedResults.hasMore,
        tokensTruncated: truncated,
        totalTokens,
      },
      documentation: formattedDocs.join('\n\n---\n\n'),
      nextPageSuggestion:
        paginatedResults.hasMore
          ? `For more results, call get-library-docs with page=${page + 1}`
          : null,
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
          text: JSON.stringify(
            {
              error: 'Failed to fetch library documentation',
              message,
              libraryId: context7CompatibleLibraryID,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
