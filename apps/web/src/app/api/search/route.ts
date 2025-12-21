import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/qdrant';
import { prisma } from '@/lib/db';
import { settingsService } from '@context8/database';
import { createProvider, type ProviderName } from '@context8/embedding';
import { truncateToTokenLimit, type SearchResult } from '@/lib/tokens';

// Mode to chunk type mapping
const MODE_CHUNK_TYPES = {
  code: ['function', 'method', 'class', 'interface', 'type_alias', 'module', 'variable'],
  info: ['file_summary', 'comment', 'docstring', 'readme', 'documentation'],
};

interface SearchRequest {
  query: string;
  filters?: {
    projectIds?: string[];
    languages?: string[];
    topic?: string;
    mode?: 'code' | 'info';
    chunkTypes?: string[];
  };
  tokenLimit?: number;
  limit?: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: SearchRequest = await request.json();
    const { query, filters, tokenLimit, limit = 50 } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Build filter conditions for Qdrant
    const filterConditions: Array<{ key: string; match: { any?: string[]; value?: string; text?: string } }> = [];

    if (filters?.projectIds && filters.projectIds.length > 0) {
      filterConditions.push({
        key: 'source_id',
        match: { any: filters.projectIds },
      });
    }

    if (filters?.languages && filters.languages.length > 0) {
      filterConditions.push({
        key: 'language',
        match: { any: filters.languages },
      });
    }

    // Add mode-based chunk type filter
    if (filters?.mode && MODE_CHUNK_TYPES[filters.mode]) {
      filterConditions.push({
        key: 'chunk_type',
        match: { any: MODE_CHUNK_TYPES[filters.mode] },
      });
    } else if (filters?.chunkTypes && filters.chunkTypes.length > 0) {
      // Allow explicit chunk type filtering
      filterConditions.push({
        key: 'chunk_type',
        match: { any: filters.chunkTypes },
      });
    }

    // Get embedding provider from settings
    const embeddingConfig = await settingsService.getEmbeddingConfig();
    if (!embeddingConfig.apiKey) {
      return NextResponse.json(
        { error: 'Embedding API key not configured. Please configure it in Settings.' },
        { status: 500 }
      );
    }

    // Create embedding provider based on settings
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

    // Enhance query with topic if provided
    let enhancedQuery = query;
    if (filters?.topic) {
      enhancedQuery = `${filters.topic}: ${query}`;
    }

    const queryEmbedding = await embeddingProvider.embed(enhancedQuery);

    const searchResults = await qdrantClient.searchDense(queryEmbedding, {
      limit,
      filter: filterConditions.length > 0 ? { must: filterConditions } : undefined,
      includePayload: true,
    });

    // Get project names for the results
    const projectIds = Array.from(
      new Set(searchResults.map((r) => r.payload.source_id ?? r.payload.repo_id).filter((id): id is string => !!id))
    );
    const projects = await prisma.localSource.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true },
    });
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    // Increment search count for searched projects
    if (projectIds.length > 0) {
      await prisma.localSource.updateMany({
        where: { id: { in: projectIds } },
        data: { searchCount: { increment: 1 } },
      });
    }

    // Format results
    let results: SearchResult[] = searchResults.map((r) => {
      const projectId = r.payload.source_id ?? r.payload.repo_id ?? '';
      return {
        id: r.id,
        score: r.score,
        filePath: r.payload.file_path,
        startLine: r.payload.start_line ?? 0,
        endLine: r.payload.end_line ?? 0,
        language: r.payload.language,
        chunkType: r.payload.chunk_type,
        symbolName: r.payload.symbol_name ?? null,
        content: r.payload.content,
        summary: (r.payload as unknown as Record<string, unknown>).summary as string | undefined,
        keywords: (r.payload as unknown as Record<string, unknown>).keywords as string[] | undefined,
        projectId,
        projectName: projectMap.get(projectId) ?? 'Unknown',
      };
    });

    // Apply token limit if specified
    let totalTokens = 0;
    let wasTruncated = false;
    let returnedCount = results.length;

    if (tokenLimit && tokenLimit > 0) {
      const truncation = truncateToTokenLimit(results, tokenLimit);
      results = truncation.results;
      totalTokens = truncation.totalTokens;
      wasTruncated = truncation.truncated;
      returnedCount = truncation.results.length;
    }

    const queryTimeMs = Date.now() - startTime;

    return NextResponse.json({
      results,
      total: searchResults.length,
      returned: returnedCount,
      totalTokens,
      wasTruncated,
      queryTimeMs,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
