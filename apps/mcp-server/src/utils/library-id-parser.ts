/**
 * Library ID Parser
 *
 * Context7-compatible library ID format:
 * - Local sources: /local/{uuid}
 * - Remote repos: /{owner}/{repo}
 * - With version: /{owner}/{repo}/{version}
 */

export interface ParsedLibraryId {
  type: 'local' | 'remote';
  id: string;
  owner?: string;
  repo?: string;
  version?: string;
}

export function parseLibraryId(libraryId: string): ParsedLibraryId | null {
  if (!libraryId.startsWith('/')) {
    return null;
  }

  const parts = libraryId.slice(1).split('/');

  // Local source: /local/{uuid}
  if (parts[0] === 'local' && parts.length >= 2) {
    return {
      type: 'local',
      id: parts[1],
    };
  }

  // Remote repo: /{owner}/{repo} or /{owner}/{repo}/{version}
  if (parts.length >= 2) {
    return {
      type: 'remote',
      id: libraryId,
      owner: parts[0],
      repo: parts[1],
      version: parts[2],
    };
  }

  return null;
}

export function formatLibraryId(
  type: 'local' | 'remote',
  options: { id?: string; owner?: string; repo?: string }
): string {
  if (type === 'local' && options.id) {
    return `/local/${options.id}`;
  }

  if (type === 'remote' && options.owner && options.repo) {
    return `/${options.owner}/${options.repo}`;
  }

  throw new Error('Invalid library ID format');
}
