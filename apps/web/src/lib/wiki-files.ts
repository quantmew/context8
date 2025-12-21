/**
 * Wiki file utilities for reading wiki pages from disk
 *
 * Storage structure:
 * ~/.context8/wikis/{sourceId}/
 * ├── _meta.json
 * ├── page-id-1.md
 * └── page-id-2.md
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

const WIKI_BASE_PATH = path.join(os.homedir(), '.context8', 'wikis');

/**
 * Get the wiki directory path for a source
 */
export function getWikiPath(sourceId: string): string {
  return path.join(WIKI_BASE_PATH, sourceId);
}

/**
 * Get the path to a specific page file
 */
export function getPagePath(sourceId: string, pageId: string): string {
  return path.join(getWikiPath(sourceId), `${pageId}.md`);
}

/**
 * Read a single page content from disk
 */
export async function readPageFromDisk(sourceId: string, pageId: string): Promise<string | null> {
  try {
    const filePath = getPagePath(sourceId, pageId);
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    // File not found or other error
    return null;
  }
}

/**
 * Check if wiki exists on disk
 */
export async function wikiExistsOnDisk(sourceId: string): Promise<boolean> {
  try {
    const metaPath = path.join(getWikiPath(sourceId), '_meta.json');
    await fs.access(metaPath);
    return true;
  } catch {
    return false;
  }
}
