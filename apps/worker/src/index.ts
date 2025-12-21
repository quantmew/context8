import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TaskProcessor } from './task-processor.js';

// Load environment variables from root .env file
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

const processor = new TaskProcessor({
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '3000'),
  concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? '1'),
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n[Worker] Received ${signal}, shutting down...`);
  await processor.stop();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start the processor
console.log('='.repeat(50));
console.log('Context8 Task Worker');
console.log('='.repeat(50));

processor.start().catch(err => {
  console.error('[Worker] Failed to start:', err);
  process.exit(1);
});
