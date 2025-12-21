/**
 * Context8 Project (maps to LocalSource in database)
 */
export interface Project {
  id: string;
  path: string;
  name: string;
  indexingStatus: 'PENDING' | 'INDEXING' | 'READY' | 'ERROR';
  fileCount: number;
  chunkCount: number;
  summaryCount: number;
  lastIndexedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Context8 Search Result (from /api/search)
 */
export interface SearchResultItem {
  id: string;
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

export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  queryTimeMs: number;
}

export interface ProjectsResponse {
  projects: Project[];
}

/**
 * Mapped types for MCP tool responses (Context7-compatible semantics)
 */
export interface LibrarySearchResult {
  id: string;           // projectId (Context7 uses /org/project format)
  title: string;        // project name
  description: string;  // project path or generated description
  totalSnippets: number; // chunkCount
  state: 'ready' | 'indexing' | 'pending' | 'error';
}

export interface LibrarySearchResponse {
  error?: string;
  results: LibrarySearchResult[];
}

/**
 * Documentation modes (kept for API compatibility)
 */
export const DOCUMENTATION_MODES = {
  CODE: 'code',
  INFO: 'info',
} as const;

export type DocumentationMode = (typeof DOCUMENTATION_MODES)[keyof typeof DOCUMENTATION_MODES];
