/**
 * Index Command - index a local directory
 */

import { Command } from 'commander';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { indexingPipeline, type IndexingProgress } from '@context8/indexer';
import { createDeepSeekProvider, CodeSummarizer } from '@context8/llm-service';
import { createMockProvider, createOpenAIProvider } from '@context8/embedding';
import { configStore, createLogger } from '../utils/index.js';

export const indexCommand = new Command('index')
  .description('Index a local code directory')
  .requiredOption('-p, --path <directory>', 'Path to the directory to index')
  .option('-i, --incremental', 'Only re-index changed files')
  .option('--force', 'Force full re-index, ignore cache')
  .option('--no-llm', 'Skip LLM summarization')
  .option('--dry-run', 'Show what would be indexed without doing it')
  .option('-v, --verbose', 'Verbose output')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .action(async (options) => {
    const logger = createLogger(options.verbose);

    try {
      // Resolve and validate path
      const targetPath = resolve(options.path);

      try {
        await access(targetPath);
      } catch {
        logger.error(`Path does not exist: ${targetPath}`);
        process.exit(1);
      }

      logger.info(`Indexing ${targetPath}`);

      // Load configuration
      const config = await configStore.load();

      // Setup LLM service if not skipped
      let llmService: { summarize: (content: string, meta: { language: string; symbolName?: string }) => Promise<{ summary: string; keywords: string[] }> } | undefined;

      if (options.llm !== false) {
        // Check for api key with both naming conventions
        const llmConfig = config.llm as Record<string, unknown>;
        const llmApiKey = (llmConfig.apiKey ?? llmConfig['api-key']) as string | undefined;

        if (llmApiKey) {
          logger.debug('Setting up LLM service with DeepSeek');
          const provider = createDeepSeekProvider(llmApiKey, {
            baseUrl: config.llm.baseUrl,
            model: config.llm.model,
          });
          const summarizer = new CodeSummarizer(provider);

          llmService = {
            async summarize(content: string, meta: { language: string; symbolName?: string }) {
              const result = await summarizer.summarize(content, meta);
              return { summary: result.summary, keywords: result.keywords };
            },
          };

          indexingPipeline.setLLMService(llmService);
        } else {
          logger.warn('No LLM API key configured. Run: context8 config set llm.api-key YOUR_KEY');
          logger.warn('Skipping LLM summarization');
        }
      }

      // Setup embedding service
      const embeddingConfig = config.embedding as Record<string, unknown> | undefined;
      const openaiApiKey = (embeddingConfig?.apiKey ?? embeddingConfig?.['api-key'] ?? process.env.OPENAI_API_KEY) as string | undefined;

      if (openaiApiKey) {
        logger.debug('Setting up embedding service with OpenAI');
        const embeddingProvider = createOpenAIProvider({
          apiKey: openaiApiKey,
          model: 'text-embedding-3-small',
          dimensions: 1536,
        });
        indexingPipeline.setEmbeddingService({
          async embed(text: string) {
            return embeddingProvider.embed(text);
          },
          async embedBatch(texts: string[]) {
            return embeddingProvider.embedBatch(texts);
          },
        });
      } else {
        logger.debug('Setting up embedding service (mock)');
        const embeddingProvider = createMockProvider({ dimensions: 1024 });
        indexingPipeline.setEmbeddingService({
          async embed(text: string) {
            return embeddingProvider.embed(text);
          },
          async embedBatch(texts: string[]) {
            return embeddingProvider.embedBatch(texts);
          },
        });
      }

      // Progress callback
      const onProgress = (progress: IndexingProgress) => {
        const phaseLabels: Record<string, string> = {
          collecting: 'Collecting files',
          parsing: 'Parsing files',
          summarizing: 'Generating summaries',
          embedding: 'Creating embeddings',
          storing: 'Storing results',
        };

        const label = phaseLabels[progress.phase] || progress.phase;
        const progressText = progress.total > 0
          ? ` (${progress.current}/${progress.total})`
          : '';
        const fileText = progress.currentFile ? ` - ${progress.currentFile}` : '';

        logger.updateSpinner(`${label}${progressText}${fileText}`);
      };

      // Parse include/exclude patterns
      const include = options.include?.split(',').map((p: string) => p.trim());
      const exclude = options.exclude?.split(',').map((p: string) => p.trim());

      // Start indexing
      logger.startSpinner('Starting indexing...');

      const result = await indexingPipeline.indexWithTask(
        targetPath,
        {
          skipLLM: options.llm === false,
          force: options.force,
          dryRun: options.dryRun,
          verbose: options.verbose,
          include,
          exclude,
          triggeredBy: 'CLI',
        },
        onProgress
      );

      // Report results
      if (result.success) {
        logger.completeSpinner('Indexing complete!');
        logger.newLine();

        logger.info(`Task ID: ${result.taskId}`);
        logger.info(`Source ID: ${result.sourceId}`);
        logger.info(`Files processed: ${result.filesProcessed}`);

        if (!options.force) {
          logger.info(`  Added: ${result.filesAdded}`);
          logger.info(`  Modified: ${result.filesModified}`);
          logger.info(`  Removed: ${result.filesRemoved}`);
        }

        logger.info(`Chunks created: ${result.chunksCreated}`);
        logger.info(`Summaries generated: ${result.summariesGenerated}`);
        logger.info(`Duration: ${logger.formatDuration(result.duration)}`);

        if (result.errors.length > 0) {
          logger.warn(`Warnings: ${result.errors.length} errors encountered`);
          if (options.verbose) {
            for (const error of result.errors) {
              logger.debug(`  ${error.file || 'unknown'}: ${error.message}`);
            }
          }
        }
      } else {
        logger.failSpinner('Indexing failed');
        logger.error('Indexing encountered errors:');
        for (const error of result.errors) {
          logger.error(`  ${error.phase}: ${error.message}`);
        }
        process.exit(1);
      }
    } catch (error) {
      logger.error('Indexing failed', error);
      process.exit(1);
    }
  });
