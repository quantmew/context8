import { query } from '@anthropic-ai/claude-agent-sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { prisma, localSourceRepository, remoteSourceRepository } from '@context8/database';
import { createProvider, type IEmbeddingProvider } from '@context8/embedding';
import { QdrantClient } from '@context8/vector-store';
import {
  WikiStructureOutputSchema,
  WikiPageContentSchema,
  type WikiStructureOutput,
  type WikiPageContent,
  type WikiPageOutline,
} from '../schemas/wiki-schema.js';
import {
  STRUCTURE_SYSTEM_PROMPT,
  CONTENT_SYSTEM_PROMPT,
  buildStructurePrompt,
  buildPageContentPrompt,
} from '../prompts/wiki-prompts.js';
import type {
  WikiGenerationOptions,
  WikiGenerationResult,
  ProgressCallback,
  PipelineConfig,
} from '../types.js';
import { pLimit } from '../utils/concurrency.js';
import { withRetry } from '../utils/retry.js';
import { writePageToDisk, writeMetaToDisk, type WikiMeta } from '../utils/wiki-files.js';

const DEFAULT_MAX_PAGES = 20;
const DEFAULT_MAX_TURNS = 50;
const DEFAULT_CONCURRENCY = 5;

export class WikiGenerationPipeline {
  private embeddingProvider: IEmbeddingProvider;
  private qdrant: QdrantClient;
  private progressCallback?: ProgressCallback;
  private agentModel: string;

  constructor(config: PipelineConfig) {
    this.embeddingProvider = createProvider({
      provider: config.embeddingConfig.provider as 'openai' | 'bigmodel' | 'voyage',
      apiKey: config.embeddingConfig.apiKey,
      baseUrl: config.embeddingConfig.baseUrl,
      model: config.embeddingConfig.model,
      dimensions: config.embeddingConfig.dimensions,
    });

    this.qdrant = new QdrantClient(
      {
        host: config.qdrantConfig.host,
        port: config.qdrantConfig.port,
        apiKey: config.qdrantConfig.apiKey,
      },
      config.qdrantConfig.collectionName
    );

    this.agentModel = config.agentModel ?? 'claude-sonnet-4-5';
  }

  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  async generate(options: WikiGenerationOptions): Promise<WikiGenerationResult> {
    const startTime = Date.now();
    const {
      sourceId,
      sourceType,
      sourcePath,
      maxPages = DEFAULT_MAX_PAGES,
      maxTurns = DEFAULT_MAX_TURNS,
      abortSignal,
      concurrency = DEFAULT_CONCURRENCY,
    } = options;

    // Helper to check abort signal
    const checkAbort = () => {
      if (abortSignal?.aborted) {
        throw new Error('Task cancelled');
      }
    };

    const errors: WikiGenerationResult['errors'] = [];

    try {
      // Update status to GENERATING_STRUCTURE
      await this.updateSourceWikiStatus(sourceId, sourceType, 'GENERATING_STRUCTURE');

      // ========================================
      // Phase 1: Generate Wiki Structure
      // ========================================
      checkAbort();
      this.emitProgress('structure', 0, 1, undefined, 'Starting Claude Agent to analyze codebase...');

      const structure = await this.generateStructure(sourcePath, maxPages, maxTurns, abortSignal);

      this.emitProgress(
        'structure',
        1,
        1,
        undefined,
        `Created structure: "${structure.title}" with ${structure.pages.length} pages`
      );

      // Create or update WikiStructure in database
      const wikiStructure = await prisma.wikiStructure.upsert({
        where: {
          sourceId_sourceType: { sourceId, sourceType },
        },
        create: {
          sourceId,
          sourceType,
          title: structure.title,
          description: structure.description,
          status: 'GENERATING_PAGES',
        },
        update: {
          title: structure.title,
          description: structure.description,
          status: 'GENERATING_PAGES',
          errorMessage: null,
        },
      });

      // Delete existing pages for this structure (regeneration)
      await prisma.wikiPage.deleteMany({
        where: { structureId: wikiStructure.id },
      });

      // Update status to GENERATING_PAGES
      await this.updateSourceWikiStatus(sourceId, sourceType, 'GENERATING_PAGES');

      // ========================================
      // Phase 2: Generate Content for Each Page (PARALLEL)
      // ========================================
      checkAbort();
      const totalPages = structure.pages.length;
      const generatedPages: Array<{ pageId: string; title: string }> = [];

      // Create concurrency limiter
      const limit = pLimit(concurrency);
      let completedCount = 0;

      console.log(`[WikiPipeline] Starting parallel page generation with concurrency=${concurrency}`);

      // Process all pages in parallel with concurrency limit
      const pagePromises = structure.pages.map((pageOutline, idx) =>
        limit(async () => {
          checkAbort(); // Check for cancellation before each page

          this.emitProgress(
            'content',
            completedCount,
            totalPages,
            pageOutline.title,
            `Generating page: ${pageOutline.title}`
          );

          try {
            const pageContent = await this.generatePageContent(
              sourcePath,
              pageOutline,
              Math.min(maxTurns, 30), // Fewer turns for individual pages
              abortSignal
            );

            // Write page content to disk
            await writePageToDisk(sourceId, pageOutline.id, pageContent.content);

            // Store page metadata in database
            const savedPage = await prisma.wikiPage.create({
              data: {
                structureId: wikiStructure.id,
                pageId: pageOutline.id,
                title: pageOutline.title,
                content: pageContent.content, // Keep for backward compatibility / fallback
                importance: pageOutline.importance,
                order: idx,
                filePaths: [
                  ...pageOutline.filePaths,
                  ...(pageContent.additionalFilePaths || []),
                ],
                relatedPageIds: pageOutline.relatedPageIds,
                parentPageId: pageOutline.parentId || null,
                isSection: pageOutline.isSection,
              },
            });

            // Create embedding and store in Qdrant (with retry for transient failures)
            const embeddingText = `${pageOutline.title}\n${pageOutline.description}\n${pageContent.content.slice(0, 3000)}`;
            const embedding = await withRetry(
              () => this.embeddingProvider.embed(embeddingText),
              {
                maxRetries: 3,
                initialDelayMs: 1000,
                onRetry: (attempt, error) => {
                  console.warn(
                    `[WikiPipeline] Embedding retry ${attempt}/3 for "${pageOutline.title}": ${error.message}`
                  );
                },
              }
            );

            await withRetry(
              () =>
                this.qdrant.upsert([
                  {
                    id: `wiki_${savedPage.id}`,
                    vector: { dense: embedding },
                    payload: {
                      source_id: sourceId,
                      chunk_type: 'wiki_page',
                      file_path: savedPage.filePaths[0] || 'wiki',
                      language: 'markdown',
                      wiki_page_id: savedPage.id,
                      wiki_structure_id: wikiStructure.id,
                      title: pageOutline.title,
                      importance: pageOutline.importance,
                      content: pageContent.content.slice(0, 5000),
                      file_paths: savedPage.filePaths,
                      page_id: pageOutline.id,
                    },
                  },
                ]),
              {
                maxRetries: 3,
                initialDelayMs: 1000,
                onRetry: (attempt, error) => {
                  console.warn(
                    `[WikiPipeline] Qdrant retry ${attempt}/3 for "${pageOutline.title}": ${error.message}`
                  );
                },
              }
            );

            // Update page with vector ID
            await prisma.wikiPage.update({
              where: { id: savedPage.id },
              data: { vectorId: `wiki_${savedPage.id}` },
            });

            // Update progress (atomic increment)
            completedCount++;
            this.emitProgress(
              'storing',
              completedCount,
              totalPages,
              pageOutline.title,
              `Completed ${completedCount}/${totalPages}: ${pageOutline.title}`
            );

            return { success: true, pageId: pageOutline.id, title: pageOutline.title };
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.error(`[WikiPipeline] Error generating page ${pageOutline.id}:`, message);

            errors.push({
              phase: `content:${pageOutline.id}`,
              message,
              recoverable: true,
            });

            // Create or update a placeholder page with error message
            await prisma.wikiPage.upsert({
              where: {
                structureId_pageId: {
                  structureId: wikiStructure.id,
                  pageId: pageOutline.id,
                },
              },
              create: {
                structureId: wikiStructure.id,
                pageId: pageOutline.id,
                title: pageOutline.title,
                content: `# ${pageOutline.title}\n\n*Content generation failed: ${message}*\n\n## Relevant Files\n${pageOutline.filePaths.map(f => `- \`${f}\``).join('\n')}`,
                importance: pageOutline.importance,
                order: idx,
                filePaths: pageOutline.filePaths,
                relatedPageIds: pageOutline.relatedPageIds,
                parentPageId: pageOutline.parentId || null,
                isSection: pageOutline.isSection,
              },
              update: {
                content: `# ${pageOutline.title}\n\n*Content generation failed: ${message}*\n\n## Relevant Files\n${pageOutline.filePaths.map(f => `- \`${f}\``).join('\n')}`,
              },
            });

            // Update progress even for failed pages
            completedCount++;
            this.emitProgress(
              'storing',
              completedCount,
              totalPages,
              pageOutline.title,
              `Completed ${completedCount}/${totalPages}: ${pageOutline.title} (with errors)`
            );

            return { success: false, pageId: pageOutline.id, title: pageOutline.title };
          }
        })
      );

      // Wait for all pages to complete
      const results = await Promise.all(pagePromises);

      // Collect generated pages
      for (const result of results) {
        generatedPages.push({ pageId: result.pageId, title: result.title });
      }

      // ========================================
      // Phase 3: Finalize
      // ========================================

      // Write wiki metadata to disk
      const wikiMeta: WikiMeta = {
        title: structure.title,
        description: structure.description,
        sourceId,
        sourceType,
        generatedAt: new Date().toISOString(),
        pages: structure.pages.map((p, idx) => ({
          pageId: p.id,
          title: p.title,
          importance: p.importance,
          order: idx,
          parentPageId: p.parentId,
          isSection: p.isSection,
        })),
      };
      await writeMetaToDisk(sourceId, wikiMeta);

      // Update WikiStructure status to READY
      await prisma.wikiStructure.update({
        where: { id: wikiStructure.id },
        data: { status: 'READY' },
      });

      // Update source wiki status to READY
      await this.updateSourceWikiStatus(sourceId, sourceType, 'READY');

      this.emitProgress(
        'complete',
        totalPages,
        totalPages,
        undefined,
        `Wiki generation complete! ${generatedPages.length} pages created.`
      );

      return {
        structureId: wikiStructure.id,
        title: structure.title,
        description: structure.description,
        pageCount: generatedPages.length,
        pages: generatedPages,
        durationMs: Date.now() - startTime,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update source wiki status to ERROR
      await this.updateSourceWikiStatus(sourceId, sourceType, 'ERROR');

      // Update WikiStructure if it exists
      try {
        await prisma.wikiStructure.updateMany({
          where: { sourceId, sourceType },
          data: { status: 'ERROR', errorMessage },
        });
      } catch {
        // Structure might not exist yet
      }

      throw error;
    }
  }

  /**
   * Phase 1: Generate wiki structure using Claude Agent
   */
  private async generateStructure(
    sourcePath: string,
    maxPages: number,
    maxTurns: number,
    abortSignal?: AbortSignal
  ): Promise<WikiStructureOutput> {
    const prompt = buildStructurePrompt(sourcePath, maxPages);
    const schema = zodToJsonSchema(WikiStructureOutputSchema, { $refStrategy: 'root' });

    let result: WikiStructureOutput | null = null;

    console.log('[WikiPipeline] Starting structure generation...');

    for await (const message of query({
      prompt,
      options: {
        allowedTools: ['Read', 'Glob', 'Grep'],
        outputFormat: {
          type: 'json_schema',
          schema: schema,
        },
        permissionMode: 'acceptEdits',
        cwd: sourcePath,
        model: this.agentModel,
        maxTurns,
        systemPrompt: STRUCTURE_SYSTEM_PROMPT,
      },
    })) {
      // Check for cancellation on each message
      if (abortSignal?.aborted) {
        throw new Error('Task cancelled');
      }

      // Log agent progress
      if (message.type === 'assistant' && message.message?.content) {
        for (const block of message.message.content) {
          if ('text' in block && block.text) {
            const agentMessage = block.text.slice(0, 300);
            console.log('[WikiAgent:Structure]', agentMessage.slice(0, 150));
            this.emitProgress('agent', 0, 0, undefined, `[Structure] ${agentMessage}`);
          }
        }
      }

      // Get the final result
      if (message.type === 'result') {
        if (message.subtype === 'success' && message.structured_output) {
          result = message.structured_output as WikiStructureOutput;
          console.log('[WikiPipeline] Structure generation complete:', result.title);
        } else if (message.subtype === 'error_max_structured_output_retries') {
          throw new Error('Agent failed to produce valid wiki structure after retries');
        }
      }
    }

    if (!result) {
      throw new Error('Agent did not produce wiki structure output');
    }

    // Validate result has pages
    if (!result.pages || result.pages.length === 0) {
      throw new Error('Agent produced empty wiki structure');
    }

    return result;
  }

  /**
   * Phase 2: Generate content for a single page using Claude Agent
   */
  private async generatePageContent(
    sourcePath: string,
    page: WikiPageOutline,
    maxTurns: number,
    abortSignal?: AbortSignal
  ): Promise<WikiPageContent> {
    const prompt = buildPageContentPrompt(sourcePath, {
      id: page.id,
      title: page.title,
      description: page.description,
      filePaths: page.filePaths,
      relatedPageIds: page.relatedPageIds,
    });
    const schema = zodToJsonSchema(WikiPageContentSchema, { $refStrategy: 'root' });

    console.log(`[WikiPipeline] Generating content for: ${page.title}`);

    // Wrap the query execution with retry logic for transient failures
    const result = await withRetry(
      async () => {
        let pageResult: WikiPageContent | null = null;

        for await (const message of query({
          prompt,
          options: {
            allowedTools: ['Read', 'Glob', 'Grep'],
            outputFormat: {
              type: 'json_schema',
              schema: schema,
            },
            permissionMode: 'acceptEdits',
            cwd: sourcePath,
            model: this.agentModel,
            maxTurns,
            systemPrompt: CONTENT_SYSTEM_PROMPT,
          },
        })) {
          // Check for cancellation on each message
          if (abortSignal?.aborted) {
            throw new Error('Task cancelled');
          }

          // Log agent progress
          if (message.type === 'assistant' && message.message?.content) {
            for (const block of message.message.content) {
              if ('text' in block && block.text) {
                const agentMessage = block.text.slice(0, 200);
                console.log(`[WikiAgent:${page.id}]`, agentMessage.slice(0, 100));
                this.emitProgress('agent', 0, 0, page.title, `[${page.id}] ${agentMessage}`);
              }
            }
          }

          // Get the final result
          if (message.type === 'result') {
            if (message.subtype === 'success' && message.structured_output) {
              pageResult = message.structured_output as WikiPageContent;
              console.log(
                `[WikiPipeline] Content generated for: ${page.title} (${pageResult.content.length} chars)`
              );
            } else if (message.subtype === 'error_max_structured_output_retries') {
              throw new Error(`Agent failed to produce content for page: ${page.id}`);
            }
          }
        }

        if (!pageResult) {
          throw new Error(`Agent did not produce content for page: ${page.id}`);
        }

        // Validate content is not empty
        if (!pageResult.content || pageResult.content.trim().length < 100) {
          throw new Error(`Generated content too short for page: ${page.id}`);
        }

        return pageResult;
      },
      {
        maxRetries: 3,
        initialDelayMs: 2000,
        maxDelayMs: 30000,
        onRetry: (attempt, error, nextDelayMs) => {
          console.warn(
            `[WikiPipeline] Retry ${attempt}/3 for page "${page.title}" after error: ${error.message}. ` +
              `Waiting ${Math.round(nextDelayMs / 1000)}s...`
          );
          this.emitProgress(
            'agent',
            0,
            0,
            page.title,
            `[${page.id}] Retrying (${attempt}/3) after: ${error.message}`
          );
        },
      }
    );

    return result;
  }

  /**
   * Update the source's wiki status in the database
   */
  private async updateSourceWikiStatus(
    sourceId: string,
    sourceType: string,
    status: 'PENDING' | 'GENERATING_STRUCTURE' | 'GENERATING_PAGES' | 'READY' | 'ERROR'
  ): Promise<void> {
    if (sourceType === 'REMOTE') {
      await remoteSourceRepository.update(sourceId, { wikiStatus: status as never });
    } else {
      await localSourceRepository.update(sourceId, { wikiStatus: status as never });
    }
  }

  /**
   * Emit progress update
   */
  private emitProgress(
    phase: 'structure' | 'content' | 'storing' | 'complete' | 'agent',
    current: number,
    total: number,
    currentPage: string | undefined,
    message: string
  ): void {
    if (this.progressCallback) {
      this.progressCallback({ phase, current, total, currentPage, message });
    }
    console.log(`[WikiPipeline] ${phase}: ${message}`);
  }
}
