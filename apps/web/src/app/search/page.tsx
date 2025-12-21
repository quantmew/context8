'use client';

import { useCallback } from 'react';
import { Search, AlertCircle } from 'lucide-react';
import { SearchBar } from '@/components/search/search-bar';
import { ResultCard } from '@/components/search/result-card';
import { SearchControls, SearchStats } from '@/components/search/search-controls';
import { ResultActions } from '@/components/search/result-actions';
import { useSearch } from '@/hooks/use-search';
import { Skeleton } from '@/components/ui/skeleton';

export default function SearchPage() {
  const {
    query,
    results,
    total,
    returned,
    totalTokens,
    wasTruncated,
    queryTimeMs,
    isLoading,
    error,
    filters,
    tokenLimit,
    search,
    updateFilters,
    updateTokenLimit,
  } = useSearch();

  const handleSearch = useCallback(
    (searchQuery: string) => {
      search(searchQuery, { filters, tokenLimit });
    },
    [search, filters, tokenLimit]
  );

  const handleTopicChange = useCallback(
    (topic: string) => {
      updateFilters({ topic: topic || undefined });
    },
    [updateFilters]
  );

  const handleModeChange = useCallback(
    (mode: 'code' | 'info' | undefined) => {
      updateFilters({ mode });
    },
    [updateFilters]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Search className="h-8 w-8 text-primary" />
          Search Your Codebase
        </h1>
        <p className="text-muted-foreground mt-1">
          Search across all indexed code using semantic search
        </p>
      </div>

      <SearchBar onSearch={handleSearch} isLoading={isLoading} defaultValue={query} />

      <SearchControls
        topic={filters.topic ?? ''}
        mode={filters.mode}
        tokenLimit={tokenLimit}
        onTopicChange={handleTopicChange}
        onModeChange={handleModeChange}
        onTokenLimitChange={updateTokenLimit}
      />

      {error && (
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-4 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}

      {query && !isLoading && !error && (
        <div className="flex items-center justify-between">
          <SearchStats
            total={total}
            returned={returned}
            totalTokens={totalTokens}
            wasTruncated={wasTruncated}
            queryTimeMs={queryTimeMs}
            query={query}
          />
          <ResultActions results={results} />
        </div>
      )}

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && results.length > 0 && (
        <div className="space-y-4">
          {results.map((result) => (
            <ResultCard key={result.id} result={result} />
          ))}
        </div>
      )}

      {!isLoading && query && results.length === 0 && !error && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">No results found for &quot;{query}&quot;</p>
          <p className="text-muted-foreground text-sm mt-2">
            Try different keywords or check your spelling
          </p>
        </div>
      )}

      {!query && !isLoading && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">Enter a search query to get started</p>
          <p className="text-muted-foreground text-sm mt-2">
            Search for function names, class names, or code patterns
          </p>
        </div>
      )}
    </div>
  );
}
