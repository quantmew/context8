'use client';

import { useState, useCallback } from 'react';

export interface SearchResult {
  id: string | number;
  score: number;
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  chunkType: string;
  symbolName: string | null;
  content: string;
  summary?: string;
  keywords?: string[];
  projectId: string;
  projectName: string;
}

export interface SearchFilters {
  projectIds?: string[];
  languages?: string[];
  topic?: string;
  mode?: 'code' | 'info';
  chunkTypes?: string[];
}

interface SearchState {
  query: string;
  results: SearchResult[];
  total: number;
  returned: number;
  totalTokens: number;
  wasTruncated: boolean;
  queryTimeMs: number;
  isLoading: boolean;
  error: string | null;
}

interface SearchOptions {
  filters?: SearchFilters;
  tokenLimit?: number;
  limit?: number;
}

export function useSearch() {
  const [state, setState] = useState<SearchState>({
    query: '',
    results: [],
    total: 0,
    returned: 0,
    totalTokens: 0,
    wasTruncated: false,
    queryTimeMs: 0,
    isLoading: false,
    error: null,
  });

  const [filters, setFilters] = useState<SearchFilters>({});
  const [tokenLimit, setTokenLimit] = useState<number | undefined>(undefined);

  const search = useCallback(
    async (query: string, options?: SearchOptions) => {
      setState((prev) => ({ ...prev, query, isLoading: true, error: null }));

      const searchFilters = options?.filters ?? filters;
      const searchTokenLimit = options?.tokenLimit ?? tokenLimit;

      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            filters: searchFilters,
            tokenLimit: searchTokenLimit,
            limit: options?.limit ?? 50,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error ?? 'Search failed');
        }

        const data = await response.json();

        setState((prev) => ({
          ...prev,
          results: data.results,
          total: data.total,
          returned: data.returned ?? data.results.length,
          totalTokens: data.totalTokens ?? 0,
          wasTruncated: data.wasTruncated ?? false,
          queryTimeMs: data.queryTimeMs,
          isLoading: false,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          results: [],
          total: 0,
          returned: 0,
          totalTokens: 0,
          wasTruncated: false,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Search failed',
        }));
      }
    },
    [filters, tokenLimit]
  );

  const clearResults = useCallback(() => {
    setState({
      query: '',
      results: [],
      total: 0,
      returned: 0,
      totalTokens: 0,
      wasTruncated: false,
      queryTimeMs: 0,
      isLoading: false,
      error: null,
    });
  }, []);

  const updateFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const updateTokenLimit = useCallback((limit: number | undefined) => {
    setTokenLimit(limit);
  }, []);

  return {
    ...state,
    filters,
    tokenLimit,
    search,
    clearResults,
    updateFilters,
    updateTokenLimit,
  };
}
