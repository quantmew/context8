/**
 * MCP Tool Input/Output Types
 */

// ============================================
// search_codebase
// ============================================

export interface SearchCodebaseInput {
  query: string;
  repo_filter?: string[];
  language_filter?: string[];
  chunk_type_filter?: string[];
  limit?: number;
}

export interface SearchCodebaseOutput {
  results: Array<{
    file_path: string;
    repo_name: string;
    start_line: number;
    end_line: number;
    language: string;
    symbol_name: string | null;
    content: string;
    relevance_score: number;
    match_type: 'semantic' | 'keyword' | 'hybrid';
  }>;
  total_matches: number;
  query_expansion: string | null;
  sources: Array<{
    repo: string;
    file: string;
    lines: string;
    url?: string;
  }>;
}

// ============================================
// resolve_internal_library
// ============================================

export interface ResolveLibraryInput {
  name: string;
}

export interface ResolveLibraryOutput {
  matches: Array<{
    repo_id: string;
    repo_name: string;
    description: string | null;
    languages: string[];
    last_updated: string;
    match_confidence: number;
  }>;
  suggested_query: string | null;
}

// ============================================
// fetch_file_context
// ============================================

export interface FetchFileContextInput {
  repo_name: string;
  file_path: string;
  start_line?: number;
  end_line?: number;
  include_dependencies?: boolean;
}

export interface FetchFileContextOutput {
  file: {
    path: string;
    repo_name: string;
    language: string;
    content: string;
    total_lines: number;
    returned_lines: {
      start: number;
      end: number;
    };
  };
  dependencies?: Array<{
    path: string;
    repo_name: string;
    relationship: 'imports' | 'extends' | 'implements' | 'references';
    snippet: string;
  }>;
  source: {
    repo: string;
    file: string;
    lines: string;
    commit_sha: string;
    url?: string;
  };
}

// ============================================
// list_repos
// ============================================

export interface ListReposInput {
  filter?: string;
}

export interface ListReposOutput {
  repos: Array<{
    id: string;
    name: string;
    last_indexed: string | null;
    status: 'ready' | 'indexing' | 'error' | 'pending';
    file_count: number;
    chunk_count: number;
  }>;
}
