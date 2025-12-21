/**
 * Config Store - manages CLI configuration in ~/.context8/config.json
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface Context8Config {
  llm: {
    provider: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  embedding: {
    provider: string;
    apiKey?: string;
    model?: string;
  };
  qdrant: {
    host: string;
    port: number;
    apiKey?: string;
  };
  database: {
    url?: string;
  };
}

const DEFAULT_CONFIG: Context8Config = {
  llm: {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  embedding: {
    provider: 'mock',
  },
  qdrant: {
    host: 'localhost',
    port: 6333,
  },
  database: {},
};

export class ConfigStore {
  private configDir: string;
  private configPath: string;
  private config: Context8Config | null = null;

  constructor() {
    this.configDir = join(homedir(), '.context8');
    this.configPath = join(this.configDir, 'config.json');
  }

  /**
   * Load configuration from disk
   */
  async load(): Promise<Context8Config> {
    if (this.config) {
      return this.config;
    }

    try {
      const content = await readFile(this.configPath, 'utf-8');
      this.config = { ...DEFAULT_CONFIG, ...JSON.parse(content) };
    } catch {
      // Config file doesn't exist, use defaults
      this.config = { ...DEFAULT_CONFIG };
    }

    return this.config!;
  }

  /**
   * Save configuration to disk
   */
  async save(): Promise<void> {
    if (!this.config) {
      return;
    }

    try {
      await mkdir(this.configDir, { recursive: true });
      await writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save config: ${error}`);
    }
  }

  /**
   * Get a configuration value by key path
   */
  async get(keyPath: string): Promise<unknown> {
    const config = await this.load();
    const keys = keyPath.split('.');

    let current: unknown = config;
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Set a configuration value by key path
   */
  async set(keyPath: string, value: unknown): Promise<void> {
    const config = await this.load();
    const keys = keyPath.split('.');
    const lastKey = keys.pop()!;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = config;
    for (const key of keys) {
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[lastKey] = value;
    await this.save();
  }

  /**
   * Get all configuration
   */
  async getAll(): Promise<Context8Config> {
    return this.load();
  }

  /**
   * Reset configuration to defaults
   */
  async reset(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    await this.save();
  }

  /**
   * Get config directory path
   */
  getConfigDir(): string {
    return this.configDir;
  }

  /**
   * Get config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }
}

// Singleton instance
export const configStore = new ConfigStore();
