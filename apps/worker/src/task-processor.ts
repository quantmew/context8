import { prisma, taskRepository, settingsService, remoteSourceRepository, remoteCredentialRepository } from '@context8/database';
import { IndexingPipeline } from '@context8/indexer';
import { createProvider, type ProviderName } from '@context8/embedding';
import { QdrantClient, CollectionManager } from '@context8/vector-store';
import { SnippetGenerationPipeline } from '@context8/snippet-generator';
import { WikiGenerationPipeline } from '@context8/wiki-generator';
import { CancellationToken, TaskCancelledException } from './cancellation-token.js';

type SourceType = 'LOCAL' | 'REMOTE' | 'REPOSITORY';

export interface TaskProcessorConfig {
  pollIntervalMs: number;
  concurrency: number;
}

export class TaskProcessor {
  private config: TaskProcessorConfig;
  private isRunning: boolean = false;
  private activeTaskIds: Set<string> = new Set();
  private cancellationTokens: Map<string, CancellationToken> = new Map();
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<TaskProcessorConfig> = {}) {
    this.config = {
      pollIntervalMs: config.pollIntervalMs ?? 5000,
      concurrency: config.concurrency ?? 1,
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[Worker] Already running');
      return;
    }

    // Stale task recovery: mark all RUNNING tasks as CANCELLED
    // These are from crashed workers that didn't complete
    const cancelledCount = await taskRepository.cancelAllRunning();
    if (cancelledCount > 0) {
      console.log(`[Worker] Recovered ${cancelledCount} stale task(s) - marked as CANCELLED`);
    }

    this.isRunning = true;
    console.log('[Worker] Starting task processor...');
    console.log(`[Worker] Poll interval: ${this.config.pollIntervalMs}ms`);
    console.log(`[Worker] Concurrency: ${this.config.concurrency}`);

    await this.poll();
  }

  async stop(): Promise<void> {
    console.log('[Worker] Stopping task processor...');
    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Wait for active tasks to complete
    if (this.activeTaskIds.size > 0) {
      console.log(`[Worker] Waiting for ${this.activeTaskIds.size} active task(s) to complete...`);
      while (this.activeTaskIds.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('[Worker] Stopped');
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Check for pending tasks
      const availableSlots = this.config.concurrency - this.activeTaskIds.size;

      if (availableSlots > 0) {
        const pendingTasks = await prisma.task.findMany({
          where: {
            status: 'PENDING',
            id: { notIn: Array.from(this.activeTaskIds) },
          },
          orderBy: { createdAt: 'asc' },
          take: availableSlots,
        });

        for (const task of pendingTasks) {
          this.processTask(task.id, task.sourceId, task.sourceType, task.taskType, task.triggeredBy).catch(err => {
            console.error(`[Worker] Error processing task ${task.id}:`, err);
          });
        }
      }
    } catch (err) {
      console.error('[Worker] Poll error:', err);
    }

    // Schedule next poll
    if (this.isRunning) {
      this.pollTimer = setTimeout(() => this.poll(), this.config.pollIntervalMs);
    }
  }

  private async processTask(
    taskId: string,
    sourceId: string,
    sourceType: SourceType,
    taskType: string,
    triggeredBy: string
  ): Promise<void> {
    this.activeTaskIds.add(taskId);
    console.log(`[Worker] Processing task ${taskId} (${taskType}) for ${sourceType} source`);

    // Create cancellation token for this task
    const cancellationToken = new CancellationToken(taskId, 2000);
    this.cancellationTokens.set(taskId, cancellationToken);
    cancellationToken.startPolling();

    try {
      // Check if already cancelled before starting
      if (await cancellationToken.checkOnce()) {
        console.log(`[Worker] Task ${taskId} was cancelled before processing`);
        return;
      }
      // Get the source based on type
      let sourcePath: string;
      let sourceName: string;

      if (sourceType === 'REMOTE') {
        const remoteSource = await remoteSourceRepository.findById(sourceId);
        if (!remoteSource) {
          throw new Error(`Remote source not found: ${sourceId}`);
        }

        // Check if we need to clone first
        if (!remoteSource.localPath) {
          // Import git client dynamically to avoid circular deps
          const { GitClient, getProvider } = await import('@context8/git-client');
          const gitClient = new GitClient();

          // Get decrypted token if credential exists
          let token: string | undefined;
          if (remoteSource.credentialId) {
            token = await remoteCredentialRepository.getDecryptedToken(remoteSource.credentialId) ?? undefined;
          }

          console.log(`[Worker] Cloning ${remoteSource.fullName}...`);
          const provider = getProvider(remoteSource.provider);
          const cloneUrl = provider.buildCloneUrl(
            remoteSource.fullName.split('/')[0],
            remoteSource.fullName.split('/').slice(1).join('/')
          );

          const cloneResult = await gitClient.clone(cloneUrl, remoteSource.fullName, {
            token,
            branch: remoteSource.defaultBranch,
          });

          // Update source with clone info
          await remoteSourceRepository.updateCloneInfo(sourceId, {
            localPath: cloneResult.localPath,
            lastClonedAt: new Date(),
            lastCommitSha: cloneResult.commitSha,
          });

          sourcePath = cloneResult.localPath;
          console.log(`[Worker] Cloned to ${sourcePath}`);
        } else {
          sourcePath = remoteSource.localPath;

          // Pull latest changes for incremental updates
          if (taskType === 'INCREMENTAL') {
            const { GitClient } = await import('@context8/git-client');
            const gitClient = new GitClient();

            let token: string | undefined;
            if (remoteSource.credentialId) {
              token = await remoteCredentialRepository.getDecryptedToken(remoteSource.credentialId) ?? undefined;
            }

            console.log(`[Worker] Pulling latest changes for ${remoteSource.fullName}...`);
            const pullResult = await gitClient.pull(sourcePath, {
              token,
              remoteUrl: remoteSource.repoUrl,
            });

            if (pullResult.hasChanges) {
              console.log(`[Worker] Found ${pullResult.changedFiles.length} changed files`);
              await remoteSourceRepository.update(sourceId, {
                lastCommitSha: pullResult.commitSha,
              });
            } else {
              console.log(`[Worker] No changes detected`);
            }
          }
        }

        sourceName = remoteSource.fullName;
      } else {
        // LOCAL source
        const localSource = await prisma.localSource.findUnique({
          where: { id: sourceId },
        });

        if (!localSource) {
          throw new Error(`Local source not found: ${sourceId}`);
        }

        sourcePath = localSource.path;
        sourceName = localSource.name;
      }

      // Handle SNIPPET_GENERATE task separately
      if (taskType === 'SNIPPET_GENERATE') {
        console.log(`[Worker] Generating snippets for: ${sourceName}`);
        await this.processSnippetGenerationTask(taskId, sourceId, sourceType, sourcePath, cancellationToken.signal);
        return;
      }

      // Handle WIKI_GENERATE task separately
      if (taskType === 'WIKI_GENERATE') {
        console.log(`[Worker] Generating wiki for: ${sourceName}`);
        await this.processWikiGenerationTask(taskId, sourceId, sourceType, sourcePath, cancellationToken.signal);
        return;
      }

      console.log(`[Worker] Indexing: ${sourceName} (${sourcePath})`);

      // Get embedding config from settings
      const embeddingConfig = await settingsService.getEmbeddingConfig();

      // Default dimensions based on provider
      const defaultDimensions: Record<string, number> = {
        openai: 1536,
        bigmodel: 1024,
        voyage: 1024,
      };
      const provider = (embeddingConfig.provider || 'openai') as ProviderName;
      const dimensions = defaultDimensions[provider] ?? 1024;

      console.log(`[Worker] Embedding config: provider=${provider}, dimensions=${dimensions}, hasApiKey=${!!embeddingConfig.apiKey}`);

      const embeddingService = embeddingConfig.apiKey
        ? createProvider({
            provider,
            apiKey: embeddingConfig.apiKey,
            baseUrl: embeddingConfig.baseUrl,
            model: embeddingConfig.model,
            dimensions,
          })
        : undefined;

      console.log(`[Worker] Embedding service: ${embeddingService ? 'enabled' : 'disabled'}`);

      // Setup vector store
      const qdrantHost = process.env.QDRANT_HOST ?? 'localhost';
      const qdrantPort = parseInt(process.env.QDRANT_PORT ?? '6333');
      const collectionName = process.env.QDRANT_COLLECTION ?? 'codebase_v1';

      // Parse host URL
      let host = qdrantHost;
      let https = process.env.QDRANT_HTTPS === 'true';
      if (host.startsWith('https://')) {
        host = host.replace('https://', '');
        https = true;
      } else if (host.startsWith('http://')) {
        host = host.replace('http://', '');
        https = false;
      }

      const qdrantConfig = {
        host,
        port: qdrantPort,
        apiKey: process.env.QDRANT_API_KEY,
        https,
      };

      // Initialize collection if needed
      const collectionManager = new CollectionManager(qdrantConfig, {
        name: collectionName,
        denseVectorSize: dimensions,
      });
      await collectionManager.initialize();
      console.log(`[Worker] Collection ${collectionName} initialized`);

      const qdrantClient = new QdrantClient(qdrantConfig, collectionName);

      // Create vector store adapter for pipeline
      const vectorStore = {
        async upsert(chunks: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }>) {
          console.log(`[Worker] Storing ${chunks.length} vectors to Qdrant...`);
          await qdrantClient.upsert(chunks.map(c => ({
            id: c.id,
            vector: { dense: c.vector },
            payload: c.payload as never,
          })));
          console.log(`[Worker] Stored ${chunks.length} vectors successfully`);
        },
        async deleteBySourceId(sid: string) {
          await qdrantClient.deleteBySourceId(sid);
        },
        async deleteByFilePaths(sid: string, filePaths: string[]) {
          await qdrantClient.deleteByFilePaths(sid, filePaths);
        },
      };

      // Create pipeline
      const pipeline = new IndexingPipeline({
        embeddingService,
        vectorStore,
      });

      // Run indexing with task tracking
      const result = await pipeline.indexWithTask(
        sourcePath,
        {
          taskId,
          force: taskType === 'FULL_INDEX',
          triggeredBy: triggeredBy as 'CLI' | 'WEB',
          abortSignal: cancellationToken.signal,
        },
        (progress) => {
          // Progress callback
          console.log(`[Worker] Task ${taskId}: ${progress.phase} ${progress.current}/${progress.total}`);
        }
      );

      // Update source with results based on source type
      if (sourceType === 'REMOTE') {
        await remoteSourceRepository.update(sourceId, {
          indexingStatus: 'READY',
          fileCount: result.filesProcessed,
          chunkCount: result.chunksCreated,
          summaryCount: result.summariesGenerated,
          indexError: null,
          lastSyncAt: new Date(),
        });
      } else {
        await prisma.localSource.update({
          where: { id: sourceId },
          data: {
            indexingStatus: 'READY',
            lastIndexedAt: new Date(),
            fileCount: result.filesProcessed,
            chunkCount: result.chunksCreated,
            summaryCount: result.summariesGenerated,
            indexError: null,
          },
        });
      }

      // Auto-trigger snippet generation after FULL_INDEX or REINDEX
      if (taskType === 'FULL_INDEX' || taskType === 'REINDEX') {
        console.log(`[Worker] Auto-triggering snippet generation for ${sourceName}`);

        try {
          await prisma.task.create({
            data: {
              sourceId,
              sourceType,
              taskType: 'SNIPPET_GENERATE',
              triggeredBy: 'WORKER',
              status: 'PENDING',
            },
          });

          // Update snippetStatus based on source type
          if (sourceType === 'REMOTE') {
            await remoteSourceRepository.update(sourceId, {
              snippetStatus: 'PENDING',
            });
          } else {
            await prisma.localSource.update({
              where: { id: sourceId },
              data: { snippetStatus: 'PENDING' },
            });
          }

          console.log(`[Worker] Snippet generation task created for ${sourceName}`);

          // Also trigger wiki generation
          await prisma.task.create({
            data: {
              sourceId,
              sourceType,
              taskType: 'WIKI_GENERATE',
              triggeredBy: 'WORKER',
              status: 'PENDING',
            },
          });

          // Update wikiStatus based on source type
          if (sourceType === 'REMOTE') {
            await remoteSourceRepository.update(sourceId, {
              wikiStatus: 'PENDING',
            });
          } else {
            await prisma.localSource.update({
              where: { id: sourceId },
              data: { wikiStatus: 'PENDING' },
            });
          }

          console.log(`[Worker] Wiki generation task created for ${sourceName}`);
        } catch (snippetErr) {
          console.error(`[Worker] Failed to create snippet/wiki generation tasks:`, snippetErr);
          // Don't fail the main indexing task due to task creation failure
        }
      }

      console.log(`[Worker] Task ${taskId} completed successfully`);
    } catch (err) {
      // Check if this was a cancellation
      const isCancellation = err instanceof TaskCancelledException ||
        (err instanceof Error && err.message.includes('cancelled'));

      if (isCancellation) {
        console.log(`[Worker] Task ${taskId} was cancelled`);

        // Reset source status to PENDING (not ERROR)
        if (taskType === 'SNIPPET_GENERATE') {
          if (sourceType === 'REMOTE') {
            await remoteSourceRepository.update(sourceId, { snippetStatus: 'PENDING' as never });
          } else {
            await prisma.localSource.update({
              where: { id: sourceId },
              data: { snippetStatus: 'PENDING' },
            });
          }
        } else if (taskType === 'WIKI_GENERATE') {
          if (sourceType === 'REMOTE') {
            await remoteSourceRepository.update(sourceId, { wikiStatus: 'PENDING' as never });
          } else {
            await prisma.localSource.update({
              where: { id: sourceId },
              data: { wikiStatus: 'PENDING' },
            });
          }
        } else {
          // Indexing task
          if (sourceType === 'REMOTE') {
            await remoteSourceRepository.updateIndexingStatus(sourceId, 'PENDING');
          } else {
            await prisma.localSource.update({
              where: { id: sourceId },
              data: { indexingStatus: 'PENDING', indexError: null },
            });
          }
        }

        await taskRepository.addLog(taskId, {
          level: 'INFO',
          message: 'Task cancelled by user',
          phase: 'cancelled',
        });

        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[Worker] Task ${taskId} failed:`, errorMessage);

      // Mark task as failed
      await taskRepository.updateStatus(taskId, 'FAILED', {
        errorMessage,
      });

      // Update source status based on source type
      if (sourceType === 'REMOTE') {
        await remoteSourceRepository.updateIndexingStatus(sourceId, 'ERROR', errorMessage);
      } else {
        await prisma.localSource.update({
          where: { id: sourceId },
          data: {
            indexingStatus: 'ERROR',
            indexError: errorMessage,
          },
        });
      }

      // Add error log
      await taskRepository.addLog(taskId, {
        level: 'ERROR',
        message: `Task failed: ${errorMessage}`,
        phase: 'failed',
      });
    } finally {
      // Clean up cancellation token
      cancellationToken.stopPolling();
      this.cancellationTokens.delete(taskId);
      this.activeTaskIds.delete(taskId);
    }
  }

  private async processSnippetGenerationTask(
    taskId: string,
    sourceId: string,
    sourceType: SourceType,
    sourcePath: string,
    abortSignal?: AbortSignal
  ): Promise<void> {
    // Mark task as running (startedAt is set automatically by updateStatus)
    await taskRepository.updateStatus(taskId, 'RUNNING');
    await taskRepository.addLog(taskId, {
      level: 'INFO',
      message: 'Starting snippet generation with Claude Agent SDK...',
      phase: 'init',
    });

    // Note: Claude Agent SDK can use either ANTHROPIC_API_KEY or subscription account
    // No API key check needed - SDK handles authentication automatically

    // Get embedding config (still needed for vector storage)
    const embeddingConfig = await settingsService.getEmbeddingConfig();
    // Get Claude Agent model config
    const snippetAgentConfig = await settingsService.getSnippetAgentConfig();

    if (!embeddingConfig.apiKey) {
      throw new Error('Embedding API key not configured. Required for storing snippets in vector database.');
    }

    // Default dimensions based on provider
    const defaultDimensions: Record<string, number> = {
      openai: 1536,
      bigmodel: 1024,
      voyage: 1024,
    };
    const provider = (embeddingConfig.provider || 'openai') as ProviderName;
    const dimensions = defaultDimensions[provider] ?? 1024;

    // Setup Qdrant config
    const qdrantHost = process.env.QDRANT_HOST ?? 'localhost';
    const qdrantPort = parseInt(process.env.QDRANT_PORT ?? '6333');
    const collectionName = process.env.QDRANT_COLLECTION ?? 'codebase_v1';

    let host = qdrantHost;
    if (host.startsWith('https://')) {
      host = host.replace('https://', '');
    } else if (host.startsWith('http://')) {
      host = host.replace('http://', '');
    }

    // Create snippet generation pipeline (no longer needs anthropicApiKey - uses env var)
    const pipeline = new SnippetGenerationPipeline({
      embeddingConfig: {
        provider,
        apiKey: embeddingConfig.apiKey,
        baseUrl: embeddingConfig.baseUrl,
        model: embeddingConfig.model,
        dimensions,
      },
      qdrantConfig: {
        host,
        port: qdrantPort,
        apiKey: process.env.QDRANT_API_KEY,
        collectionName,
      },
      agentModel: snippetAgentConfig.model,
    });

    // Set progress callback
    pipeline.setProgressCallback((progress) => {
      console.log(`[Worker] Task ${taskId}: ${progress.phase} - ${progress.message}`);
      taskRepository.addLog(taskId, {
        level: 'INFO',
        message: progress.message,
        phase: progress.phase,
        filePath: progress.currentFile,
      }).catch(console.error);
    });

    // Run snippet generation with Claude Agent SDK
    const result = await pipeline.generate({
      sourceId,
      sourceType: sourceType as 'LOCAL' | 'REMOTE' | 'REPOSITORY',
      sourcePath,
      maxSnippets: 100,
      maxTurns: 50,
      abortSignal,
    });

    // Log results
    await taskRepository.addLog(taskId, {
      level: 'INFO',
      message: `Generated ${result.snippets.length} snippets in ${result.durationMs}ms`,
      phase: 'complete',
      metadata: {
        snippetCount: result.snippets.length,
        projectName: result.projectName,
        qaItemCount: result.qaItems.length,
        durationMs: result.durationMs,
        errorCount: result.errors.length,
      },
    });

    // Log any errors
    for (const error of result.errors) {
      await taskRepository.addLog(taskId, {
        level: error.recoverable ? 'WARN' : 'ERROR',
        message: error.message,
        phase: 'error',
        filePath: error.file,
      });
    }

    // Update task status (completedAt is set automatically by updateStatus)
    await taskRepository.updateStatus(taskId, 'COMPLETED', {
      chunksCreated: result.snippets.length,
    });

    console.log(`[Worker] Snippet generation task ${taskId} completed: ${result.snippets.length} snippets`);
  }

  private async processWikiGenerationTask(
    taskId: string,
    sourceId: string,
    sourceType: SourceType,
    sourcePath: string,
    abortSignal?: AbortSignal
  ): Promise<void> {
    // Mark task as running
    await taskRepository.updateStatus(taskId, 'RUNNING');
    await taskRepository.addLog(taskId, {
      level: 'INFO',
      message: 'Starting wiki generation with Claude Agent SDK...',
      phase: 'init',
    });

    // Get embedding config (needed for vector storage)
    const embeddingConfig = await settingsService.getEmbeddingConfig();
    // Get Claude Agent model config
    const wikiAgentConfig = await settingsService.getWikiAgentConfig();

    if (!embeddingConfig.apiKey) {
      throw new Error('Embedding API key not configured. Required for storing wiki pages in vector database.');
    }

    // Default dimensions based on provider
    const defaultDimensions: Record<string, number> = {
      openai: 1536,
      bigmodel: 1024,
      voyage: 1024,
    };
    const provider = (embeddingConfig.provider || 'openai') as ProviderName;
    const dimensions = defaultDimensions[provider] ?? 1024;

    // Setup Qdrant config
    const qdrantHost = process.env.QDRANT_HOST ?? 'localhost';
    const qdrantPort = parseInt(process.env.QDRANT_PORT ?? '6333');
    const collectionName = process.env.QDRANT_COLLECTION ?? 'codebase_v1';

    let host = qdrantHost;
    if (host.startsWith('https://')) {
      host = host.replace('https://', '');
    } else if (host.startsWith('http://')) {
      host = host.replace('http://', '');
    }

    // Create wiki generation pipeline
    const pipeline = new WikiGenerationPipeline({
      embeddingConfig: {
        provider,
        apiKey: embeddingConfig.apiKey,
        baseUrl: embeddingConfig.baseUrl,
        model: embeddingConfig.model,
        dimensions,
      },
      qdrantConfig: {
        host,
        port: qdrantPort,
        apiKey: process.env.QDRANT_API_KEY,
        collectionName,
      },
      agentModel: wikiAgentConfig.model,
    });

    // Set progress callback
    pipeline.setProgressCallback((progress) => {
      console.log(`[Worker] Task ${taskId}: ${progress.phase} - ${progress.message}`);
      taskRepository.addLog(taskId, {
        level: 'INFO',
        message: progress.message,
        phase: progress.phase,
        filePath: progress.currentPage,
      }).catch(console.error);
    });

    // Run wiki generation with Claude Agent SDK
    const result = await pipeline.generate({
      sourceId,
      sourceType: sourceType as 'LOCAL' | 'REMOTE' | 'REPOSITORY',
      sourcePath,
      maxPages: 20,
      maxTurns: 50,
      abortSignal,
      concurrency: wikiAgentConfig.concurrency ?? 5,
    });

    // Log results
    await taskRepository.addLog(taskId, {
      level: 'INFO',
      message: `Generated wiki "${result.title}" with ${result.pageCount} pages in ${result.durationMs}ms`,
      phase: 'complete',
      metadata: {
        structureId: result.structureId,
        title: result.title,
        pageCount: result.pageCount,
        durationMs: result.durationMs,
        errorCount: result.errors.length,
      },
    });

    // Log any errors
    for (const error of result.errors) {
      await taskRepository.addLog(taskId, {
        level: error.recoverable ? 'WARN' : 'ERROR',
        message: error.message,
        phase: error.phase,
      });
    }

    // Update task status
    await taskRepository.updateStatus(taskId, 'COMPLETED', {
      chunksCreated: result.pageCount,
    });

    console.log(`[Worker] Wiki generation task ${taskId} completed: ${result.pageCount} pages`);
  }
}
