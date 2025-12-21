/**
 * File Collector - traverses directories and collects files for indexing
 */

import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import fg from 'fast-glob';
import { FileFilter, getLanguageFromPath } from './file-filter.js';
import type { CollectedFile, ProgressCallback } from '../types.js';

export interface FileCollectorOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  concurrency?: number;
}

export class FileCollector {
  private rootPath: string;
  private filter: FileFilter | null = null;
  private options: FileCollectorOptions;

  constructor(rootPath: string, options: FileCollectorOptions = {}) {
    this.rootPath = resolve(rootPath);
    this.options = options;
  }

  /**
   * Initialize the file filter (loads .gitignore)
   */
  async init(): Promise<void> {
    this.filter = await FileFilter.create(this.rootPath, {
      includePatterns: this.options.includePatterns,
      excludePatterns: this.options.excludePatterns,
    });
  }

  /**
   * Collect all files for indexing
   */
  async collect(onProgress?: ProgressCallback): Promise<CollectedFile[]> {
    if (!this.filter) {
      await this.init();
    }

    // Use fast-glob to find all files
    const patterns = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts', '**/*.py', '**/*.pyi'];

    const files = await fg(patterns, {
      cwd: this.rootPath,
      absolute: false,
      ignore: [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        '__pycache__/**',
        '*.pyc',
        '.next/**',
        '.nuxt/**',
        'coverage/**',
      ],
      dot: false,
    });

    // Filter and collect files
    const collectedFiles: CollectedFile[] = [];
    let processed = 0;

    for (const filePath of files) {
      const absolutePath = join(this.rootPath, filePath);

      // Apply additional filter rules
      if (!this.filter!.shouldInclude(absolutePath, this.rootPath)) {
        continue;
      }

      try {
        const file = await this.collectFile(filePath, absolutePath);
        collectedFiles.push(file);

        processed++;
        if (onProgress) {
          onProgress({
            phase: 'collecting',
            current: processed,
            total: files.length,
            currentFile: filePath,
          });
        }
      } catch (error) {
        // Skip files that can't be read
        console.error(`Failed to collect file ${filePath}:`, error);
      }
    }

    return collectedFiles;
  }

  /**
   * Collect a single file
   */
  private async collectFile(
    filePath: string,
    absolutePath: string
  ): Promise<CollectedFile> {
    const [content, fileStat] = await Promise.all([
      readFile(absolutePath, 'utf-8'),
      stat(absolutePath),
    ]);

    const language = getLanguageFromPath(filePath) ?? 'unknown';
    const contentHash = this.computeHash(content);

    return {
      filePath,
      absolutePath,
      content,
      size: fileStat.size,
      language,
      lastModified: fileStat.mtime,
      contentHash,
    };
  }

  /**
   * Get file paths only (without content)
   */
  async getFilePaths(): Promise<string[]> {
    if (!this.filter) {
      await this.init();
    }

    const patterns = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts', '**/*.py', '**/*.pyi'];

    const files = await fg(patterns, {
      cwd: this.rootPath,
      absolute: false,
      ignore: [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        '__pycache__/**',
        '*.pyc',
        '.next/**',
        '.nuxt/**',
        'coverage/**',
      ],
      dot: false,
    });

    return files.filter((filePath) => {
      const absolutePath = join(this.rootPath, filePath);
      return this.filter!.shouldInclude(absolutePath, this.rootPath);
    });
  }

  /**
   * Collect specific files by path
   */
  async collectFiles(filePaths: string[]): Promise<CollectedFile[]> {
    const files: CollectedFile[] = [];

    for (const filePath of filePaths) {
      const absolutePath = join(this.rootPath, filePath);
      try {
        const file = await this.collectFile(filePath, absolutePath);
        files.push(file);
      } catch (error) {
        console.error(`Failed to collect file ${filePath}:`, error);
      }
    }

    return files;
  }

  /**
   * Compute SHA-256 hash of content
   */
  private computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get the root path
   */
  getRootPath(): string {
    return this.rootPath;
  }
}

/**
 * Compute SHA-256 hash of content
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
