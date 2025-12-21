export type SourceType = 'LOCAL' | 'REMOTE' | 'REPOSITORY';

export type SnippetCategory =
  | 'INSTALLATION'
  | 'ARCHITECTURE'
  | 'API_USAGE'
  | 'WORKFLOW'
  | 'EXAMPLE'
  | 'TROUBLESHOOT'
  | 'OTHER';

export interface SnippetData {
  title: string;
  description: string;
  content: string;
  language: string;
  sourceUrl: string | null;
  sourceFilePath: string;
  startLine: number | null;
  endLine: number | null;
  sourceChunkIds: string[];
  category: SnippetCategory;
  keywords: string[];
  tokenCount: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  isExtracted?: boolean;
}

export interface QAItemData {
  question: string;
  answer: string;
}

export interface SnippetGenerationOptions {
  sourceId: string;
  sourceType: SourceType;
  sourcePath: string;
  maxSnippets?: number;
  maxTurns?: number;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

export interface SnippetGenerationResult {
  snippets: SnippetData[];
  projectName: string;
  projectOverview: string;
  qaItems: QAItemData[];
  durationMs: number;
  errors: Array<{
    file: string;
    message: string;
    recoverable: boolean;
  }>;
}

export interface ProgressCallback {
  (progress: {
    phase: 'exploring' | 'generating' | 'storing' | 'agent';
    current: number;
    total: number;
    currentFile?: string;
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
