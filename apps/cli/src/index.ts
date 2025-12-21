#!/usr/bin/env node

/**
 * Context8 CLI
 *
 * Command-line interface for indexing and managing code knowledge
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { Command } from 'commander';

// Load environment variables from project root .env file
const findEnvFile = () => {
  // Try current directory first, then walk up to find .env
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const envPath = resolve(dir, '.env');
    if (existsSync(envPath)) {
      return envPath;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
};

const envPath = findEnvFile();
if (envPath) {
  config({ path: envPath });
}
import { indexCommand, configCommand, statusCommand } from './commands/index.js';

const program = new Command();

program
  .name('context8')
  .description('Context8 - Private codebase indexing for AI assistants')
  .version('0.1.0');

// Add commands
program.addCommand(indexCommand);
program.addCommand(configCommand);
program.addCommand(statusCommand);

// Parse and execute
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
