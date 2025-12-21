/**
 * File Filter - handles .gitignore and pattern-based filtering
 */

import ignoreModule, { type Ignore } from 'ignore';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

// Handle ESM default export quirks
const ignore = ignoreModule as unknown as () => Ignore;

// Default patterns to always exclude
const DEFAULT_EXCLUDES = [
  // Dependencies
  'node_modules',
  'vendor',
  'bower_components',
  '.pnpm',

  // Build outputs
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '__pycache__',
  '*.pyc',
  '.tox',
  '*.egg-info',

  // IDE and editor
  '.idea',
  '.vscode',
  '*.swp',
  '*.swo',
  '*~',

  // Version control
  '.git',
  '.svn',
  '.hg',

  // OS files
  '.DS_Store',
  'Thumbs.db',

  // Test coverage
  'coverage',
  '.nyc_output',
  'htmlcov',

  // Logs
  '*.log',
  'logs',

  // Environment
  '.env',
  '.env.*',
  '!.env.example',

  // Lock files (usually not useful for indexing)
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'poetry.lock',
  'Pipfile.lock',
];

// Supported file extensions for code indexing
const SUPPORTED_EXTENSIONS: Record<string, string> = {
  // TypeScript
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',

  // Python
  '.py': 'python',
  '.pyi': 'python',
};

export class FileFilter {
  private ignorer: Ignore;
  private supportedExtensions: Set<string>;
  private includePatterns: string[];
  private excludePatterns: string[];

  constructor(options: {
    gitignorePath?: string;
    gitignoreContent?: string;
    includePatterns?: string[];
    excludePatterns?: string[];
    additionalExtensions?: Record<string, string>;
  } = {}) {
    this.ignorer = ignore();
    this.includePatterns = options.includePatterns ?? [];
    this.excludePatterns = options.excludePatterns ?? [];

    // Add default excludes
    this.ignorer.add(DEFAULT_EXCLUDES);

    // Add user excludes
    if (this.excludePatterns.length > 0) {
      this.ignorer.add(this.excludePatterns);
    }

    // Add gitignore content if provided
    if (options.gitignoreContent) {
      this.ignorer.add(options.gitignoreContent);
    }

    // Build supported extensions
    this.supportedExtensions = new Set(
      Object.keys({
        ...SUPPORTED_EXTENSIONS,
        ...options.additionalExtensions,
      })
    );
  }

  /**
   * Create a FileFilter with .gitignore loaded from the directory
   */
  static async create(
    rootPath: string,
    options: {
      includePatterns?: string[];
      excludePatterns?: string[];
      additionalExtensions?: Record<string, string>;
    } = {}
  ): Promise<FileFilter> {
    let gitignoreContent: string | undefined;

    try {
      gitignoreContent = await readFile(join(rootPath, '.gitignore'), 'utf-8');
    } catch {
      // No .gitignore file, that's fine
    }

    return new FileFilter({
      ...options,
      gitignoreContent,
    });
  }

  /**
   * Check if a file should be included in indexing
   */
  shouldInclude(filePath: string, rootPath: string): boolean {
    // Get relative path for gitignore matching
    const relativePath = relative(rootPath, filePath);

    // Check if ignored by gitignore patterns
    if (this.ignorer.ignores(relativePath)) {
      return false;
    }

    // Check file extension
    const ext = this.getExtension(filePath);
    if (!this.supportedExtensions.has(ext)) {
      return false;
    }

    // Check include patterns if specified
    if (this.includePatterns.length > 0) {
      const matchesInclude = this.includePatterns.some((pattern) =>
        this.matchPattern(relativePath, pattern)
      );
      if (!matchesInclude) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the language for a file based on extension
   */
  getLanguage(filePath: string): string | undefined {
    const ext = this.getExtension(filePath);
    return SUPPORTED_EXTENSIONS[ext];
  }

  /**
   * Get file extension (lowercase)
   */
  private getExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1) return '';
    return filePath.slice(lastDot).toLowerCase();
  }

  /**
   * Simple glob pattern matching
   */
  private matchPattern(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Get list of supported extensions
   */
  getSupportedExtensions(): string[] {
    return Array.from(this.supportedExtensions);
  }
}

/**
 * Get language from file path
 */
export function getLanguageFromPath(filePath: string): string | undefined {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return SUPPORTED_EXTENSIONS[ext];
}
