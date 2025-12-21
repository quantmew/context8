/**
 * Pipeline Context - shared state during indexing
 */

import type {
  IndexingOptions,
  IndexingResult,
  IndexingError,
  IndexingProgress,
  ProgressCallback,
} from '../types.js';

export interface PipelineConfig {
  sourceId: string;
  sourcePath: string;
  options: IndexingOptions;
  onProgress?: ProgressCallback;
}

export class PipelineContext {
  readonly sourceId: string;
  readonly sourcePath: string;
  readonly options: IndexingOptions;

  private errors: IndexingError[] = [];
  private startTime: number;
  private progressCallback?: ProgressCallback;

  // Counters
  filesProcessed = 0;
  filesAdded = 0;
  filesModified = 0;
  filesRemoved = 0;
  chunksCreated = 0;
  summariesGenerated = 0;

  constructor(config: PipelineConfig) {
    this.sourceId = config.sourceId;
    this.sourcePath = config.sourcePath;
    this.options = config.options;
    this.progressCallback = config.onProgress;
    this.startTime = Date.now();
  }

  /**
   * Report progress
   */
  reportProgress(progress: IndexingProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  /**
   * Add an error
   */
  addError(error: IndexingError): void {
    this.errors.push(error);
  }

  /**
   * Get all errors
   */
  getErrors(): IndexingError[] {
    return this.errors;
  }

  /**
   * Check if verbose mode is enabled
   */
  isVerbose(): boolean {
    return this.options.verbose ?? false;
  }

  /**
   * Check if dry run mode is enabled
   */
  isDryRun(): boolean {
    return this.options.dryRun ?? false;
  }

  /**
   * Check if LLM should be skipped
   */
  shouldSkipLLM(): boolean {
    return this.options.skipLLM ?? false;
  }

  /**
   * Check if force re-index is enabled
   */
  shouldForce(): boolean {
    return this.options.force ?? false;
  }

  /**
   * Get duration in milliseconds
   */
  getDuration(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Build the final result
   */
  buildResult(success: boolean): IndexingResult {
    return {
      sourceId: this.sourceId,
      sourcePath: this.sourcePath,
      success,
      filesProcessed: this.filesProcessed,
      filesAdded: this.filesAdded,
      filesModified: this.filesModified,
      filesRemoved: this.filesRemoved,
      chunksCreated: this.chunksCreated,
      summariesGenerated: this.summariesGenerated,
      errors: this.errors,
      duration: this.getDuration(),
    };
  }

  /**
   * Log a message (only in verbose mode)
   */
  log(message: string): void {
    if (this.isVerbose()) {
      console.log(`[indexer] ${message}`);
    }
  }

  /**
   * Log an error
   */
  logError(message: string, error?: unknown): void {
    console.error(`[indexer] ERROR: ${message}`);
    if (error && this.isVerbose()) {
      console.error(error);
    }
  }
}
