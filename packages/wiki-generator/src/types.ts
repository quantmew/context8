export type SourceType = 'LOCAL' | 'REMOTE' | 'REPOSITORY';

export type WikiImportance = 'HIGH' | 'MEDIUM' | 'LOW';

export interface WikiPageData {
  pageId: string;
  title: string;
  description: string;
  content: string;
  importance: WikiImportance;
  order: number;
  filePaths: string[];
  relatedPageIds: string[];
  parentPageId?: string;
  isSection: boolean;
}

export interface WikiStructureData {
  title: string;
  description: string;
  pages: WikiPageData[];
}

export interface WikiGenerationOptions {
  sourceId: string;
  sourceType: SourceType;
  sourcePath: string;
  maxPages?: number;
  maxTurns?: number;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
  /** Number of concurrent page generations (default: 5) */
  concurrency?: number;
}

export interface WikiGenerationResult {
  structureId: string;
  title: string;
  description: string;
  pageCount: number;
  pages: Array<{ pageId: string; title: string }>;
  durationMs: number;
  errors: Array<{
    phase: string;
    message: string;
    recoverable: boolean;
  }>;
}

export interface ProgressCallback {
  (progress: {
    phase: 'structure' | 'content' | 'storing' | 'complete' | 'agent';
    current: number;
    total: number;
    currentPage?: string;
    message: string;
  }): void;
}

export interface PipelineConfig {
  embeddingConfig: {
    provider: string;
    apiKey: string;
    baseUrl?: string;
    model?: string;
    dimensions: number;
  };
  qdrantConfig: {
    host: string;
    port: number;
    apiKey?: string;
    collectionName: string;
  };
  /** Claude Agent SDK model (e.g., 'claude-sonnet-4-5') */
  agentModel?: string;
}
