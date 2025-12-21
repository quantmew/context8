import {
  LibrarySearchResponse,
  LibrarySearchResult,
  Project,
  ProjectsResponse,
  SearchResponse,
  DocumentationMode,
  DOCUMENTATION_MODES,
} from './types.js';

// Default to local development endpoint
const DEFAULT_API_BASE_URL = 'http://localhost:3001/api';

function getApiBaseUrl(): string {
  return process.env.CONTEXT8_API_URL || DEFAULT_API_BASE_URL;
}

/**
 * Maps IndexingStatus from database to simplified state
 */
function mapIndexingStatus(status: string): 'ready' | 'indexing' | 'pending' | 'error' {
  switch (status) {
    case 'READY':
      return 'ready';
    case 'INDEXING':
      return 'indexing';
    case 'PENDING':
      return 'pending';
    case 'ERROR':
      return 'error';
    default:
      return 'pending';
  }
}

/**
 * Search for projects/libraries by name
 * Maps to Context7's searchLibraries() functionality
 *
 * Implementation strategy:
 * - Fetch all projects from /api/projects
 * - Filter by name match (fuzzy search)
 * - Return in Context7-compatible format
 */
export async function searchLibraries(query: string): Promise<LibrarySearchResponse> {
  try {
    const url = new URL(`${getApiBaseUrl()}/projects`);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorText = await response.text();
      return {
        results: [],
        error: `Failed to fetch projects: ${response.status} - ${errorText}`,
      };
    }

    const data = (await response.json()) as ProjectsResponse;
    const queryLower = query.toLowerCase();

    // Filter and map projects matching the query
    const matchedProjects = data.projects
      .filter(
        (project: Project) =>
          project.name.toLowerCase().includes(queryLower) ||
          project.path.toLowerCase().includes(queryLower)
      )
      .map(
        (project: Project): LibrarySearchResult => ({
          id: project.id,
          title: project.name,
          description: `Local project: ${project.path}`,
          totalSnippets: project.chunkCount,
          state: mapIndexingStatus(project.indexingStatus),
        })
      );

    return { results: matchedProjects };
  } catch (error) {
    const errorMessage = `Error searching libraries: ${error}`;
    console.error(errorMessage);
    return { results: [], error: errorMessage };
  }
}

/**
 * Fetch documentation/code context for a specific project
 * Maps to Context7's fetchLibraryDocumentation() functionality
 *
 * Implementation strategy:
 * - Use /api/search with projectId filter
 * - topic parameter becomes the search query
 * - mode affects result formatting (code vs info)
 * - Pagination via page/limit parameters
 */
export async function fetchLibraryDocumentation(
  projectId: string,
  docMode: DocumentationMode,
  options: {
    page?: number;
    limit?: number;
    topic?: string;
  } = {}
): Promise<string | null> {
  try {
    // Note: page is reserved for future pagination support
    const { page: _page = 1, limit = 10, topic } = options;
    void _page; // Explicitly mark as intentionally unused

    // Build search query - if no topic, use generic query
    const searchQuery = topic || '*';

    const url = new URL(`${getApiBaseUrl()}/search`);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        filters: {
          projectIds: [projectId],
        },
        limit: limit,
        // Note: Context8 search API doesn't have pagination offset yet
        // We'll handle this by adjusting limit if needed
      }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return 'Project not found. Please use resolve-library-id to find a valid project.';
      }
      const errorText = await response.text();
      return `Failed to fetch documentation: ${response.status} - ${errorText}`;
    }

    const data = (await response.json()) as SearchResponse;

    if (!data.results || data.results.length === 0) {
      const suggestion =
        docMode === DOCUMENTATION_MODES.CODE
          ? " Try mode='info' for conceptual content."
          : " Try mode='code' for code examples.";
      return `No ${docMode} content found for this topic.${suggestion}`;
    }

    // Format results based on mode
    return formatDocumentation(data.results, docMode, topic);
  } catch (error) {
    const errorMessage = `Error fetching documentation: ${error}`;
    console.error(errorMessage);
    return errorMessage;
  }
}

/**
 * Format search results into documentation text
 */
function formatDocumentation(
  results: SearchResponse['results'],
  mode: DocumentationMode,
  topic?: string
): string {
  const header = topic ? `## Documentation for "${topic}"\n\n` : `## Code Context\n\n`;

  const formattedResults = results.map((result, index) => {
    const locationInfo = `**File:** \`${result.filePath}\` (lines ${result.startLine}-${result.endLine})`;
    const languageInfo = `**Language:** ${result.language}`;
    const typeInfo = result.chunkType ? `**Type:** ${result.chunkType}` : '';
    const symbolInfo = result.symbolName ? `**Symbol:** \`${result.symbolName}\`` : '';

    const metadata = [locationInfo, languageInfo, typeInfo, symbolInfo]
      .filter(Boolean)
      .join(' | ');

    const summary = result.summary ? `\n\n> ${result.summary}` : '';

    const codeBlock =
      mode === DOCUMENTATION_MODES.CODE
        ? `\n\n\`\`\`${result.language}\n${result.content}\n\`\`\``
        : '';

    const infoBlock =
      mode === DOCUMENTATION_MODES.INFO && result.summary ? `\n\n${result.summary}` : '';

    return `### Result ${index + 1}\n${metadata}${summary}${codeBlock}${infoBlock}`;
  });

  return header + formattedResults.join('\n\n---\n\n');
}
