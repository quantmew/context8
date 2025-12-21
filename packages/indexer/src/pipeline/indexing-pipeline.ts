/**
 * Indexing Pipeline - main orchestration for indexing local directories
 */

import { resolve, basename } from 'node:path';
import { access } from 'node:fs/promises';
import {
  localSourceRepository,
  fileMetadataRepository,
  taskRepository,
} from '@context8/database';
import { astChunker } from '@context8/parser';
import type {
  IndexingOptions,
  IndexingResult,
  ProgressCallback,
  CollectedFile,
  ProcessedChunk,
} from '../types.js';
import { PipelineContext } from './pipeline-context.js';
import { FileCollector } from '../collectors/file-collector.js';
import {
  FileChangeDetector,
  createStoredFilesMap,
} from '../change-detection/file-change-detector.js';
import { TaskLogger } from '../services/task-logger.js';

type TriggerType = 'CLI' | 'WEB' | 'WEBHOOK' | 'SCHEDULED';

export interface IndexingOptionsWithTask extends IndexingOptions {
  /** Who triggered the indexing */
  triggeredBy?: TriggerType;
  /** Existing task ID to use (for worker mode) */
  taskId?: string;
}

export interface IndexingResultWithTask extends IndexingResult {
  /** Task ID for tracking */
  taskId: string;
}

export interface IndexingPipelineConfig {
  /** LLM service for summarization (optional) */
  llmService?: ILLMService;
  /** Embedding service (optional) */
  embeddingService?: IEmbeddingService;
  /** Vector store for storing embeddings (optional) */
  vectorStore?: IVectorStore;
}

// Interfaces for pluggable services
export interface ILLMService {
  summarize(content: string, metadata: { language: string; symbolName?: string }): Promise<{
    summary: string;
    keywords: string[];
  }>;
}

export interface IEmbeddingService {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface IVectorStore {
  upsert(chunks: Array<{
    id: string;
    vector: number[];
    payload: Record<string, unknown>;
  }>): Promise<void>;
  deleteBySourceId(sourceId: string): Promise<void>;
  deleteByFilePaths(sourceId: string, filePaths: string[]): Promise<void>;
}

export class IndexingPipeline {
  private llmService?: ILLMService;
  private embeddingService?: IEmbeddingService;
  private vectorStore?: IVectorStore;

  constructor(config: IndexingPipelineConfig = {}) {
    this.llmService = config.llmService;
    this.embeddingService = config.embeddingService;
    this.vectorStore = config.vectorStore;
  }

  /**
   * Index a local directory
   */
  async index(
    path: string,
    options: IndexingOptions = {},
    onProgress?: ProgressCallback
  ): Promise<IndexingResult> {
    const absolutePath = resolve(path);

    // Verify path exists
    try {
      await access(absolutePath);
    } catch {
      throw new Error(`Path does not exist: ${absolutePath}`);
    }

    // Get or create LocalSource
    const sourceName = basename(absolutePath);
    let source = await localSourceRepository.findByPath(absolutePath);

    if (!source) {
      source = await localSourceRepository.create({
        path: absolutePath,
        name: sourceName,
      });
    }

    // Create pipeline context
    const ctx = new PipelineContext({
      sourceId: source.id,
      sourcePath: absolutePath,
      options,
      onProgress,
    });

    try {
      // Update status to indexing
      await localSourceRepository.updateIndexingStatus(source.id, 'INDEXING');

      // Run the pipeline
      const result = await this.runPipeline(ctx);

      // Update status to ready
      await localSourceRepository.updateIndexingStatus(source.id, 'READY');
      await localSourceRepository.updateStats(source.id, {
        fileCount: ctx.filesProcessed,
        chunkCount: ctx.chunksCreated,
        summaryCount: ctx.summariesGenerated,
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await localSourceRepository.updateIndexingStatus(source.id, 'ERROR', message);

      ctx.addError({
        phase: 'collect',
        message,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return ctx.buildResult(false);
    }
  }

  /**
   * Index a local directory with task tracking
   * Creates a Task record and logs progress to the database
   */
  async indexWithTask(
    path: string,
    options: IndexingOptionsWithTask = {},
    onProgress?: ProgressCallback
  ): Promise<IndexingResultWithTask> {
    const absolutePath = resolve(path);

    // Verify path exists
    try {
      await access(absolutePath);
    } catch {
      throw new Error(`Path does not exist: ${absolutePath}`);
    }

    // Get or create LocalSource
    const sourceName = basename(absolutePath);
    let source = await localSourceRepository.findByPath(absolutePath);

    if (!source) {
      source = await localSourceRepository.create({
        path: absolutePath,
        name: sourceName,
      });
    }

    // Use existing task or create a new one
    let taskId: string;
    if (options.taskId) {
      // Use existing task from worker
      taskId = options.taskId;
    } else {
      // Create a new Task record
      const task = await taskRepository.create({
        sourceId: source.id,
        sourceType: 'LOCAL',
        taskType: options.force ? 'FULL_INDEX' : 'INCREMENTAL',
        triggeredBy: options.triggeredBy ?? 'CLI',
      });
      taskId = task.id;
    }

    // Create task logger
    const taskLogger = new TaskLogger(taskId, {
      console: options.verbose ?? false,
    });

    // Create pipeline context
    const ctx = new PipelineContext({
      sourceId: source.id,
      sourcePath: absolutePath,
      options,
      onProgress: (progress) => {
        // Log progress to task logger
        const msg = progress.currentFile
          ? `${progress.phase}: ${progress.current}/${progress.total} - ${progress.currentFile}`
          : `${progress.phase}: ${progress.current}/${progress.total}`;
        taskLogger.info(msg, { phase: progress.phase });

        // Call user's progress callback
        if (onProgress) {
          onProgress(progress);
        }
      },
    });

    try {
      // Update task and source status
      await taskRepository.updateStatus(taskId, 'RUNNING');
      await localSourceRepository.updateIndexingStatus(source.id, 'INDEXING');
      taskLogger.info(`Starting indexing for ${absolutePath}`, { phase: 'collecting' });

      // Run the pipeline
      const result = await this.runPipeline(ctx);

      // Update task with final stats
      await taskRepository.updateStatus(taskId, 'COMPLETED', {
        filesProcessed: ctx.filesProcessed,
        chunksCreated: ctx.chunksCreated,
        summariesGenerated: ctx.summariesGenerated,
      });

      // Update source status
      await localSourceRepository.updateIndexingStatus(source.id, 'READY');
      await localSourceRepository.updateStats(source.id, {
        fileCount: ctx.filesProcessed,
        chunkCount: ctx.chunksCreated,
        summaryCount: ctx.summariesGenerated,
      });

      taskLogger.info(`Indexing completed in ${ctx.getDuration()}ms`, { phase: 'storing' });
      await taskLogger.close();

      return { ...result, taskId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Update task and source status
      await taskRepository.updateStatus(taskId, 'FAILED', { errorMessage: message });
      await localSourceRepository.updateIndexingStatus(source.id, 'ERROR', message);

      taskLogger.error(`Indexing failed: ${message}`);
      await taskLogger.close();

      ctx.addError({
        phase: 'collect',
        message,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return { ...ctx.buildResult(false), taskId };
    }
  }

  /**
   * Run the indexing pipeline
   */
  private async runPipeline(ctx: PipelineContext): Promise<IndexingResult> {
    ctx.log(`Starting indexing for ${ctx.sourcePath}`);

    // Helper to check abort signal
    const checkAbort = () => {
      if (ctx.options.abortSignal?.aborted) {
        throw new Error('Task cancelled');
      }
    };

    // Phase 1: Collect files
    checkAbort();
    ctx.reportProgress({ phase: 'collecting', current: 0, total: 0 });
    const collector = new FileCollector(ctx.sourcePath, {
      includePatterns: ctx.options.include,
      excludePatterns: ctx.options.exclude,
    });

    const currentFilePaths = await collector.getFilePaths();
    ctx.log(`Found ${currentFilePaths.length} files`);

    // Phase 2: Detect changes (for incremental indexing)
    let filesToProcess: string[];

    if (ctx.shouldForce()) {
      // Force mode: process all files
      filesToProcess = currentFilePaths;
      ctx.filesAdded = currentFilePaths.length;
    } else {
      // Incremental mode: detect changes
      const storedFiles = await fileMetadataRepository.findBySourceId(ctx.sourceId);
      const storedFilesMap = createStoredFilesMap(
        storedFiles.map((f) => ({
          id: f.id,
          filePath: f.filePath,
          contentHash: f.contentHash,
        }))
      );

      const changeDetector = new FileChangeDetector(ctx.sourcePath);
      const changes = await changeDetector.detectChanges(storedFilesMap, currentFilePaths);

      ctx.filesAdded = changes.added.length;
      ctx.filesModified = changes.modified.length;
      ctx.filesRemoved = changes.removed.length;

      ctx.log(`Changes: +${changes.added.length} ~${changes.modified.length} -${changes.removed.length}`);

      // Handle removed files
      if (changes.removed.length > 0) {
        const removedPaths = changes.removed.map((f) => f.filePath);
        await fileMetadataRepository.deleteByPaths(ctx.sourceId, removedPaths);

        if (this.vectorStore) {
          await this.vectorStore.deleteByFilePaths(ctx.sourceId, removedPaths);
        }
      }

      // Files to process = added + modified
      filesToProcess = [
        ...changes.added.map((f) => f.filePath),
        ...changes.modified.map((f) => f.filePath),
      ];
    }

    // Dry run: just report what would be processed
    if (ctx.isDryRun()) {
      ctx.log('Dry run mode - no actual processing');
      ctx.filesProcessed = filesToProcess.length;
      return ctx.buildResult(true);
    }

    // Phase 3: Collect and parse files
    if (filesToProcess.length === 0) {
      ctx.log('No files to process');
      return ctx.buildResult(true);
    }

    const collectedFiles = await collector.collectFiles(filesToProcess);
    ctx.log(`Collected ${collectedFiles.length} files`);

    // Phase 4: Parse and chunk files
    ctx.reportProgress({ phase: 'parsing', current: 0, total: collectedFiles.length });

    const allChunks: ProcessedChunk[] = [];

    for (let i = 0; i < collectedFiles.length; i++) {
      checkAbort(); // Check for cancellation before each file
      const file = collectedFiles[i];

      ctx.reportProgress({
        phase: 'parsing',
        current: i + 1,
        total: collectedFiles.length,
        currentFile: file.filePath,
      });

      try {
        const chunks = await this.parseFile(file, ctx);
        allChunks.push(...chunks);
        ctx.filesProcessed++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.addError({
          file: file.filePath,
          phase: 'parse',
          message,
        });
        ctx.logError(`Failed to parse ${file.filePath}`, error);
      }
    }

    ctx.chunksCreated = allChunks.length;
    ctx.log(`Created ${allChunks.length} chunks`);

    // Phase 5: LLM summarization (if enabled)
    if (!ctx.shouldSkipLLM() && this.llmService && allChunks.length > 0) {
      checkAbort();
      ctx.reportProgress({ phase: 'summarizing', current: 0, total: allChunks.length });

      for (let i = 0; i < allChunks.length; i++) {
        checkAbort(); // Check for cancellation before each chunk
        const chunk = allChunks[i];

        ctx.reportProgress({
          phase: 'summarizing',
          current: i + 1,
          total: allChunks.length,
          currentFile: chunk.metadata.filePath,
        });

        try {
          const result = await this.llmService.summarize(chunk.content, {
            language: chunk.metadata.language,
            symbolName: chunk.metadata.symbolName,
          });
          chunk.summary = result.summary;
          chunk.keywords = result.keywords;
          ctx.summariesGenerated++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          ctx.addError({
            file: chunk.metadata.filePath,
            phase: 'llm',
            message,
          });
        }
      }

      ctx.log(`Generated ${ctx.summariesGenerated} summaries`);
    }

    // Phase 6: Generate embeddings (if enabled)
    checkAbort();
    if (this.embeddingService && allChunks.length > 0) {
      ctx.reportProgress({ phase: 'embedding', current: 0, total: allChunks.length });

      const textsToEmbed = allChunks.map((chunk) =>
        chunk.summary ? `${chunk.summary}\n\n${chunk.content}` : chunk.content
      );

      try {
        const embeddings = await this.embeddingService.embedBatch(textsToEmbed);

        for (let i = 0; i < allChunks.length; i++) {
          allChunks[i].embedding = embeddings[i];
        }

        ctx.log(`Generated ${embeddings.length} embeddings`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.addError({
          phase: 'embed',
          message,
        });
        ctx.logError('Failed to generate embeddings', error);
      }
    }

    // Phase 7: Store results
    checkAbort();
    ctx.reportProgress({ phase: 'storing', current: 0, total: collectedFiles.length });

    // Update file metadata
    for (const file of collectedFiles) {
      const fileChunks = allChunks.filter(
        (c) => c.metadata.filePath === file.filePath
      );

      await fileMetadataRepository.upsert(ctx.sourceId, file.filePath, {
        sourceId: ctx.sourceId,
        filePath: file.filePath,
        absolutePath: file.absolutePath,
        contentHash: file.contentHash,
        size: file.size,
        language: file.language,
        lastModified: file.lastModified,
        lastIndexed: new Date(),
        chunkCount: fileChunks.length,
        hasSummary: fileChunks.some((c) => c.summary !== undefined),
      });
    }

    // Store vectors (if vector store is configured)
    if (this.vectorStore && allChunks.some((c) => c.embedding)) {
      const chunksWithEmbeddings = allChunks.filter((c) => c.embedding);

      await this.vectorStore.upsert(
        chunksWithEmbeddings.map((chunk) => ({
          id: chunk.id,
          vector: chunk.embedding!,
          payload: {
            source_id: ctx.sourceId,
            file_path: chunk.metadata.filePath,
            start_line: chunk.metadata.startLine,
            end_line: chunk.metadata.endLine,
            language: chunk.metadata.language,
            chunk_type: chunk.metadata.chunkType,
            chunk_level: chunk.metadata.chunkLevel,
            symbol_name: chunk.metadata.symbolName,
            signature: chunk.metadata.signature,
            content: chunk.content,
            summary: chunk.summary,
            keywords: chunk.keywords,
          },
        }))
      );
    }

    ctx.log(`Indexing complete in ${ctx.getDuration()}ms`);
    return ctx.buildResult(true);
  }

  /**
   * Parse a file and create chunks
   */
  private async parseFile(
    file: CollectedFile,
    ctx: PipelineContext
  ): Promise<ProcessedChunk[]> {
    const chunks = await astChunker.chunkFile(
      file.filePath,
      file.content,
      ctx.sourceId,
      file.contentHash
    );

    return chunks.map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      metadata: {
        filePath: file.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        language: chunk.language,
        chunkType: chunk.type,
        chunkLevel: chunk.level,
        symbolName: chunk.symbolName ?? undefined,
        signature: chunk.signature ?? undefined,
      },
    }));
  }

  /**
   * Set the LLM service
   */
  setLLMService(service: ILLMService): void {
    this.llmService = service;
  }

  /**
   * Set the embedding service
   */
  setEmbeddingService(service: IEmbeddingService): void {
    this.embeddingService = service;
  }

  /**
   * Set the vector store
   */
  setVectorStore(store: IVectorStore): void {
    this.vectorStore = store;
  }
}

// Singleton instance
export const indexingPipeline = new IndexingPipeline();
