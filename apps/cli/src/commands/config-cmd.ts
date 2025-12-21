/**
 * Config Command - manage CLI configuration
 */

import { Command } from 'commander';
import { configStore, createLogger } from '../utils/index.js';

export const configCommand = new Command('config')
  .description('Manage Context8 configuration');

// config set <key> <value>
configCommand
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action(async (key: string, value: string) => {
    const logger = createLogger();

    try {
      // Parse value as JSON if possible, otherwise use as string
      let parsedValue: unknown = value;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // Keep as string
      }

      await configStore.set(key, parsedValue);
      logger.success(`Set ${key} = ${JSON.stringify(parsedValue)}`);
    } catch (error) {
      logger.error(`Failed to set config: ${error}`);
      process.exit(1);
    }
  });

// config get <key>
configCommand
  .command('get <key>')
  .description('Get a configuration value')
  .action(async (key: string) => {
    const logger = createLogger();

    try {
      const value = await configStore.get(key);

      if (value === undefined) {
        logger.warn(`Config key "${key}" is not set`);
      } else {
        console.log(JSON.stringify(value, null, 2));
      }
    } catch (error) {
      logger.error(`Failed to get config: ${error}`);
      process.exit(1);
    }
  });

// config list
configCommand
  .command('list')
  .description('List all configuration')
  .option('--show-secrets', 'Show secret values (API keys)')
  .action(async (options) => {
    const logger = createLogger();

    try {
      const config = await configStore.getAll();

      // Mask secrets unless --show-secrets is provided
      const displayConfig = JSON.parse(JSON.stringify(config));

      if (!options.showSecrets) {
        if (displayConfig.llm?.apiKey) {
          displayConfig.llm.apiKey = maskSecret(displayConfig.llm.apiKey);
        }
        if (displayConfig.embedding?.apiKey) {
          displayConfig.embedding.apiKey = maskSecret(displayConfig.embedding.apiKey);
        }
        if (displayConfig.qdrant?.apiKey) {
          displayConfig.qdrant.apiKey = maskSecret(displayConfig.qdrant.apiKey);
        }
        if (displayConfig.database?.url) {
          displayConfig.database.url = maskDatabaseUrl(displayConfig.database.url);
        }
      }

      console.log(JSON.stringify(displayConfig, null, 2));
      logger.newLine();
      logger.info(`Config file: ${configStore.getConfigPath()}`);
    } catch (error) {
      logger.error(`Failed to list config: ${error}`);
      process.exit(1);
    }
  });

// config reset
configCommand
  .command('reset')
  .description('Reset configuration to defaults')
  .action(async () => {
    const logger = createLogger();

    try {
      await configStore.reset();
      logger.success('Configuration reset to defaults');
    } catch (error) {
      logger.error(`Failed to reset config: ${error}`);
      process.exit(1);
    }
  });

// config path
configCommand
  .command('path')
  .description('Show configuration file path')
  .action(() => {
    console.log(configStore.getConfigPath());
  });

/**
 * Mask a secret value, showing only first and last 4 characters
 */
function maskSecret(value: string): string {
  if (value.length <= 8) {
    return '****';
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

/**
 * Mask password in database URL
 */
function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch {
    return url;
  }
}
