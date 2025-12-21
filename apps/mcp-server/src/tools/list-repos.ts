import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Config } from '../config.js';

interface ListReposArgs {
  filter?: string;
}

/**
 * list_repos tool implementation
 */
export async function listReposTool(
  args: ListReposArgs,
  _extra: unknown,
  _config: Config
): Promise<CallToolResult> {
  const { filter } = args;

  try {
    // TODO: Implement proper repository listing from database
    // For MVP, return a placeholder response

    const output = {
      repos: [
        {
          id: 'placeholder-repo-1',
          name: 'org/backend',
          last_indexed: new Date().toISOString(),
          status: 'ready' as const,
          file_count: 150,
          chunk_count: 500,
        },
        {
          id: 'placeholder-repo-2',
          name: 'org/frontend',
          last_indexed: new Date().toISOString(),
          status: 'ready' as const,
          file_count: 200,
          chunk_count: 750,
        },
      ],
    };

    // Apply filter if provided
    if (filter) {
      output.repos = output.repos.filter((r) =>
        r.name.toLowerCase().includes(filter.toLowerCase())
      );
    }

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
