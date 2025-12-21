/**
 * API Request/Response Types
 */

// ============================================
// Auth
// ============================================

export interface DeviceCodeRequest {
  client_id: string;
  scope: string;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface TokenRequest {
  client_id: string;
  device_code: string;
  grant_type: 'urn:ietf:params:oauth:grant-type:device_code';
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in?: number;
}

export interface JWTPayload {
  sub: string;
  org_id: string;
  scopes: string[];
  github_access_token?: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

// ============================================
// Repository Management
// ============================================

export interface ConnectRepoRequest {
  github_repo_id: string;
  full_name: string;
  default_branch?: string;
}

export interface RepoStatusResponse {
  id: string;
  full_name: string;
  indexing_status: string;
  last_indexed_sha: string | null;
  chunk_count: number;
  file_count: number;
  indexed_at: string | null;
}

// ============================================
// Internal Search API (MCP -> API)
// ============================================

export interface InternalSearchRequest {
  user_id: string;
  query: string;
  filters: {
    repo_ids?: string[];
    languages?: string[];
    chunk_types?: string[];
  };
  options: {
    limit: number;
    include_content: boolean;
    rerank: boolean;
  };
}

export interface InternalSearchResponse {
  results: Array<{
    chunk_id: string;
    repo_id: string;
    file_path: string;
    start_line: number;
    end_line: number;
    language: string;
    chunk_type: string;
    symbol_name: string | null;
    content: string;
    score: number;
    match_type: string;
  }>;
  metadata: {
    query_time_ms: number;
    total_candidates: number;
    reranked: boolean;
  };
}

// ============================================
// Webhooks
// ============================================

export interface GitHubPushEvent {
  ref: string;
  before: string;
  after: string;
  repository: {
    id: number;
    full_name: string;
    default_branch: string;
    private: boolean;
    clone_url: string;
  };
  commits: Array<{
    id: string;
    message: string;
    timestamp: string;
    added: string[];
    modified: string[];
    removed: string[];
  }>;
  pusher: {
    name: string;
    email: string;
  };
  installation: {
    id: number;
  };
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  previousPath?: string;
}

// ============================================
// API Errors
// ============================================

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}
