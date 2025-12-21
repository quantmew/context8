import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Config } from '../config.js';
import { localSourceRepository } from '@context8/database';
import { formatLibraryId } from '../utils/library-id-parser.js';

interface ResolveLibraryIdArgs {
  libraryName: string;
}

interface LibraryMatch {
  libraryId: string;
  name: string;
  description: string;
  codeSnippets: number;
  source: 'local' | 'remote';
  reputation: 'High' | 'Medium' | 'Low';
  benchmarkScore: number;
}

/**
 * resolve-library-id tool implementation
 *
 * Resolves a package/product name to a Context7-compatible library ID.
 * Returns a list of matching libraries sorted by relevance.
 */
export async function resolveLibraryIdTool(
  args: ResolveLibraryIdArgs,
  _extra: unknown,
  _config: Config
): Promise<CallToolResult> {
  const { libraryName } = args;

  try {
    // Search for matching local sources
    const allSources = await localSourceRepository.findAll();

    // Score and filter sources based on name similarity
    const scoredSources = allSources
      .map((source) => {
        const nameLower = source.name.toLowerCase();
        const searchLower = libraryName.toLowerCase();

        // Calculate simple relevance score
        let score = 0;

        // Exact match
        if (nameLower === searchLower) {
          score = 100;
        }
        // Starts with search term
        else if (nameLower.startsWith(searchLower)) {
          score = 80;
        }
        // Contains search term
        else if (nameLower.includes(searchLower)) {
          score = 60;
        }
        // Word match
        else if (
          nameLower.split(/[-_\s]/).some((word) => word === searchLower) ||
          searchLower.split(/[-_\s]/).some((word) => nameLower.includes(word))
        ) {
          score = 40;
        }

        if (score === 0) return null;

        // Boost by chunk count (indicates more documentation)
        const chunkBonus = Math.min(source.chunkCount / 1000, 20);
        score += chunkBonus;

        const match: LibraryMatch = {
          libraryId: formatLibraryId('local', { id: source.id }),
          name: source.name,
          description: `Local source at ${source.path}`,
          codeSnippets: source.chunkCount,
          source: 'local',
          reputation: source.chunkCount > 500 ? 'High' : source.chunkCount > 100 ? 'Medium' : 'Low',
          benchmarkScore: Math.round(score),
        };
        return match;
      })
      .filter((match): match is LibraryMatch => match !== null);

    const matches = scoredSources
      .sort((a, b) => b.benchmarkScore - a.benchmarkScore)
      .slice(0, 10);

    if (matches.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                message: `No libraries found matching "${libraryName}". Try a different search term or add a new library.`,
                suggestions: [
                  'Check spelling and try alternative names',
                  'Use the list_repos tool to see available libraries',
                  'Add a new local source through the web interface',
                ],
              },
              null,
              2
            ),
          },
        ],
      };
    }

    const output = {
      query: libraryName,
      matches,
      selectedLibraryId: matches[0].libraryId,
      selectionReason:
        matches[0].benchmarkScore >= 80
          ? 'Exact or near-exact match found'
          : 'Best match based on name similarity and documentation coverage',
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
