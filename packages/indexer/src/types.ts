/**
 * Indexer Types
 */

export interface IndexingOptions {
  /** Skip LLM summarization */
  skipLLM?: boolean;
  /** Force full re-index, ignore cache */
  force?: boolean;
  /** Dry run mode - show what would be indexed */
  dryRun?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Concurrency for file processing */
  concurrency?: number;
  /** File patterns to include (glob) */
  include?: string[];
  /** File patterns to exclude (glob) */
  exclude?: string[];
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

export interface IndexingResult {
  sourceId: string;
  sourcePath: string;
  success: boolean;
  filesProcessed: number;
  filesAdded: number;
  filesModified: number;
  filesRemoved: number;
  chunksCreated: number;
  summariesGenerated: number;
  errors: IndexingError[];
  duration: number;
}

export interface IndexingError {
  file?: string;
  phase: 'collect' | 'parse' | 'llm' | 'embed' | 'store';
  message: string;
  stack?: string;
}

export interface IndexingProgress {
  phase: 'collecting' | 'parsing' | 'summarizing' | 'embedding' | 'storing';
  current: number;
  total: number;
  currentFile?: string;
  message?: string;
}

export type ProgressCallback = (progress: IndexingProgress) => void;

export interface FileChange {
  filePath: string;
  absolutePath: string;
  status: 'added' | 'modified' | 'removed';
  contentHash?: string;
  size?: number;
  language?: string;
}

export interface CollectedFile {
  filePath: string;
  absolutePath: string;
  content: string;
  size: number;
  language: string;
  lastModified: Date;
  contentHash: string;
}

export interface ProcessedFile {
  file: CollectedFile;
  chunks: ProcessedChunk[];
}

export interface ProcessedChunk {
  id: string;
  content: string;
  summary?: string;
  keywords?: string[];
  embedding?: number[];
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  chunkType: string;
  chunkLevel: string;
  symbolName?: string;
  signature?: string;
}
