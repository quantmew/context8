/**
 * Vector Store Types
 */

export interface QdrantConfig {
  host: string;
  port: number;
  apiKey?: string;
  https?: boolean;
}

export interface DenseVector {
  values: number[];
  dimensions: number;
}

export interface SparseVector {
  indices: number[];
  values: number[];
}

export interface HybridVectors {
  dense: DenseVector;
  sparse: SparseVector;
}

/**
 * Qdrant payload schema for code chunks
 */
export interface CodeChunkPayload {
  // Identity
  chunk_id?: string;
  repo_id?: string;
  org_id?: string;
  source_id?: string; // For local sources
  snippet_id?: string; // For snippet chunks

  // Location
  file_path: string;
  start_line?: number;
  end_line?: number;

  // Code metadata
  language: string;
  chunk_type: string;
  chunk_level?: string;
  symbol_name?: string | null;
  signature?: string | null;

  // Content
  content: string;

  // Dependencies
  imports?: string[];
  exports?: string[];

  // Versioning
  commit_sha?: string;
  content_hash?: string;

  // Parent reference (for implementation chunks)
  parent_chunk_id?: string | null;

  // Timestamps
  created_at?: string;
  updated_at?: string;

  // Snippet-specific fields
  title?: string;
  description?: string;
  category?: string;
  keywords?: string[];

  // Wiki-specific fields
  wiki_page_id?: string;
  wiki_structure_id?: string;
  importance?: string;
  page_id?: string;
  file_paths?: string[];
}

export interface SearchOptions {
  limit: number;
  filter?: SearchFilter;
  includePayload?: boolean;
  scoreThreshold?: number;
}

export interface SearchFilter {
  must?: FilterCondition[];
  should?: FilterCondition[];
  must_not?: FilterCondition[];
}

export interface FilterCondition {
  key: string;
  match?: {
    value?: string | number | boolean;
    any?: (string | number)[];
    text?: string;
  };
  range?: {
    gte?: number;
    lte?: number;
    gt?: number;
    lt?: number;
  };
}

export interface SearchResult {
  id: string;
  score: number;
  payload: CodeChunkPayload;
}

export interface UpsertPoint {
  id: string;
  vector: {
    dense: number[];
    sparse?: {
      indices: number[];
      values: number[];
    };
  };
  payload: CodeChunkPayload;
}
