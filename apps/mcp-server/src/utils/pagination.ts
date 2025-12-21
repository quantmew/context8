/**
 * Pagination utilities for MCP tools
 */

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export function paginate<T>(
  items: T[],
  options: PaginationOptions
): PaginatedResult<T> {
  const { page, pageSize } = options;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const totalPages = Math.ceil(items.length / pageSize);

  return {
    items: items.slice(start, end),
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * Token estimation (~4 chars per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate results to fit within token budget
 */
export function truncateToTokenLimit<T extends { content: string }>(
  results: T[],
  tokenLimit: number
): { results: T[]; totalTokens: number; truncated: boolean } {
  let totalTokens = 0;
  const truncatedResults: T[] = [];

  for (const result of results) {
    const tokens = estimateTokens(result.content) + 20; // 20 for metadata overhead
    if (totalTokens + tokens <= tokenLimit) {
      truncatedResults.push(result);
      totalTokens += tokens;
    } else {
      break;
    }
  }

  return {
    results: truncatedResults,
    totalTokens,
    truncated: truncatedResults.length < results.length,
  };
}
