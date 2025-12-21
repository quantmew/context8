/**
 * Token estimation and limiting utilities
 * Uses ~4 characters per token approximation (consistent with common tokenizers)
 */

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

/**
 * Estimate token count for text
 * Uses ~4 characters per token approximation
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate total tokens for a search result
 * Includes content, summary, and metadata
 */
export function estimateResultTokens(result: SearchResult): number {
  let tokens = estimateTokens(result.content);
  if (result.summary) {
    tokens += estimateTokens(result.summary);
  }
  // Add some overhead for metadata (file path, line numbers, etc.)
  tokens += 20;
  return tokens;
}

export interface TruncationResult<T> {
  results: T[];
  totalTokens: number;
  truncated: boolean;
  originalCount: number;
}

/**
 * Truncate results to fit within token budget
 */
export function truncateToTokenLimit(
  results: SearchResult[],
  tokenLimit: number
): TruncationResult<SearchResult> {
  let totalTokens = 0;
  const truncatedResults: SearchResult[] = [];

  for (const result of results) {
    const resultTokens = estimateResultTokens(result);
    if (totalTokens + resultTokens <= tokenLimit) {
      truncatedResults.push(result);
      totalTokens += resultTokens;
    } else {
      break;
    }
  }

  return {
    results: truncatedResults,
    totalTokens,
    truncated: truncatedResults.length < results.length,
    originalCount: results.length,
  };
}

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}
