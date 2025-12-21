import { LibrarySearchResponse, LibrarySearchResult } from './types.js';

/**
 * Maps project state to a human-readable label
 */
function getStateLabel(state: LibrarySearchResult['state']): string {
  switch (state) {
    case 'ready': return 'Ready';
    case 'indexing': return 'Indexing...';
    case 'pending': return 'Pending';
    case 'error': return 'Error';
    default: return 'Unknown';
  }
}

/**
 * Formats a single search result for display
 */
export function formatSearchResult(result: LibrarySearchResult): string {
  const formattedResult = [
    `- Title: ${result.title}`,
    `- Project ID: ${result.id}`,
    `- Description: ${result.description}`,
  ];

  if (result.totalSnippets !== undefined && result.totalSnippets > 0) {
    formattedResult.push(`- Code Chunks: ${result.totalSnippets}`);
  }

  formattedResult.push(`- Status: ${getStateLabel(result.state)}`);

  return formattedResult.join('\n');
}

/**
 * Formats all search results for display
 */
export function formatSearchResults(searchResponse: LibrarySearchResponse): string {
  if (!searchResponse.results || searchResponse.results.length === 0) {
    return 'No projects found matching your query.';
  }

  const formattedResults = searchResponse.results.map(formatSearchResult);
  return formattedResults.join('\n----------\n');
}
