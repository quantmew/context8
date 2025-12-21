/**
 * File Change Detector - detects changes between indexed files and current state
 */

import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { FileChange } from '../types.js';
import { getLanguageFromPath } from '../collectors/file-filter.js';

export interface StoredFileInfo {
  id: string;
  filePath: string;
  contentHash: string;
}

export interface ChangeDetectionResult {
  added: FileChange[];
  modified: FileChange[];
  removed: FileChange[];
  unchanged: string[];
}

export class FileChangeDetector {
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  /**
   * Detect changes between stored file metadata and current files on disk
   */
  async detectChanges(
    storedFiles: Map<string, StoredFileInfo>,
    currentFilePaths: string[]
  ): Promise<ChangeDetectionResult> {
    const result: ChangeDetectionResult = {
      added: [],
      modified: [],
      removed: [],
      unchanged: [],
    };

    const currentPathSet = new Set(currentFilePaths);
    const processedPaths = new Set<string>();

    // Check current files against stored
    for (const filePath of currentFilePaths) {
      const absolutePath = join(this.rootPath, filePath);
      const stored = storedFiles.get(filePath);

      if (!stored) {
        // New file
        const change = await this.buildFileChange(filePath, absolutePath, 'added');
        if (change) {
          result.added.push(change);
        }
      } else {
        // Existing file - check if modified
        const currentHash = await this.computeFileHash(absolutePath);

        if (currentHash !== stored.contentHash) {
          const change = await this.buildFileChange(filePath, absolutePath, 'modified');
          if (change) {
            result.modified.push(change);
          }
        } else {
          result.unchanged.push(filePath);
        }
      }

      processedPaths.add(filePath);
    }

    // Find removed files
    for (const [filePath] of storedFiles) {
      if (!currentPathSet.has(filePath)) {
        result.removed.push({
          filePath,
          absolutePath: join(this.rootPath, filePath),
          status: 'removed',
        });
      }
    }

    return result;
  }

  /**
   * Build a FileChange object
   */
  private async buildFileChange(
    filePath: string,
    absolutePath: string,
    status: 'added' | 'modified'
  ): Promise<FileChange | null> {
    try {
      const [content, fileStat] = await Promise.all([
        readFile(absolutePath, 'utf-8'),
        stat(absolutePath),
      ]);

      const contentHash = this.computeHash(content);
      const language = getLanguageFromPath(filePath);

      return {
        filePath,
        absolutePath,
        status,
        contentHash,
        size: fileStat.size,
        language,
      };
    } catch (error) {
      console.error(`Failed to read file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Compute hash of file content from disk
   */
  private async computeFileHash(absolutePath: string): Promise<string> {
    try {
      const content = await readFile(absolutePath, 'utf-8');
      return this.computeHash(content);
    } catch {
      return '';
    }
  }

  /**
   * Compute SHA-256 hash
   */
  private computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}

/**
 * Create a stored files map from database records
 */
export function createStoredFilesMap(
  files: Array<{ id: string; filePath: string; contentHash: string }>
): Map<string, StoredFileInfo> {
  return new Map(
    files.map((f) => [
      f.filePath,
      { id: f.id, filePath: f.filePath, contentHash: f.contentHash },
    ])
  );
}
