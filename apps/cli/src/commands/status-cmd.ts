/**
 * Status Command - view indexing status
 */

import { Command } from 'commander';
import { localSourceRepository } from '@context8/database';
import { createLogger } from '../utils/index.js';

export const statusCommand = new Command('status')
  .description('View indexing status and statistics')
  .option('-s, --source <id>', 'Show status for specific source (ID or path)')
  .option('--list-sources', 'List all indexed sources')
  .option('-v, --verbose', 'Show detailed statistics')
  .action(async (options) => {
    const logger = createLogger(options.verbose);

    try {
      if (options.listSources || !options.source) {
        // List all sources
        const sources = await localSourceRepository.findAll();

        if (sources.length === 0) {
          logger.info('No indexed sources found');
          logger.info('Run: context8 index --path <directory> to index a codebase');
          return;
        }

        logger.info(`Found ${sources.length} indexed source(s):\n`);

        for (const source of sources) {
          const status = getStatusEmoji(source.indexingStatus);
          const lastIndexed = source.lastIndexedAt
            ? formatDate(source.lastIndexedAt)
            : 'never';

          console.log(`${status} ${source.name}`);
          console.log(`   Path: ${source.path}`);
          console.log(`   Status: ${source.indexingStatus}`);
          console.log(`   Last indexed: ${lastIndexed}`);
          console.log(`   Files: ${source.fileCount}`);
          console.log(`   Chunks: ${source.chunkCount}`);
          console.log(`   Summaries: ${source.summaryCount}`);

          if (source.indexError) {
            console.log(`   Error: ${source.indexError}`);
          }

          console.log();
        }
      } else {
        // Show specific source
        let source = await localSourceRepository.findById(options.source);

        if (!source) {
          source = await localSourceRepository.findByPath(options.source);
        }

        if (!source) {
          logger.error(`Source not found: ${options.source}`);
          process.exit(1);
        }

        const status = getStatusEmoji(source.indexingStatus);
        const lastIndexed = source.lastIndexedAt
          ? formatDate(source.lastIndexedAt)
          : 'never';

        console.log(`\n${status} ${source.name}\n`);
        console.log(`ID:           ${source.id}`);
        console.log(`Path:         ${source.path}`);
        console.log(`Status:       ${source.indexingStatus}`);
        console.log(`Last indexed: ${lastIndexed}`);
        console.log(`Files:        ${source.fileCount}`);
        console.log(`Chunks:       ${source.chunkCount}`);
        console.log(`Summaries:    ${source.summaryCount}`);
        console.log(`Created:      ${formatDate(source.createdAt)}`);
        console.log(`Updated:      ${formatDate(source.updatedAt)}`);

        if (source.indexError) {
          console.log(`\nError: ${source.indexError}`);
        }
      }
    } catch (error) {
      logger.error('Failed to get status', error);
      process.exit(1);
    }
  });

/**
 * Get status emoji
 */
function getStatusEmoji(status: string): string {
  switch (status) {
    case 'READY':
      return '✓';
    case 'INDEXING':
      return '⟳';
    case 'PENDING':
      return '○';
    case 'ERROR':
      return '✗';
    default:
      return '?';
  }
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleString();
}
