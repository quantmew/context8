/**
 * Wiki file utilities for reading/writing wiki pages to disk
 *
 * Storage structure:
 * ~/.context8/wikis/
 * ├── {sourceId}/
 * │   ├── _meta.json
 * │   ├── page-id-1.md
 * │   └── page-id-2.md
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

const WIKI_BASE_PATH = path.join(os.homedir(), '.context8', 'wikis');

export interface WikiMeta {
  title: string;
  description: string;
  sourceId: string;
  sourceType: string;
  generatedAt: string;
  pages: Array<{
    pageId: string;
    title: string;
    importance: string;
    order: number;
    parentPageId?: string;
    isSection: boolean;
  }>;
}

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
 * Get the path to the metadata file
 */
export function getMetaPath(sourceId: string): string {
  return path.join(getWikiPath(sourceId), '_meta.json');
}

/**
 * Ensure the wiki directory exists
 */
async function ensureWikiDir(sourceId: string): Promise<void> {
  await fs.mkdir(getWikiPath(sourceId), { recursive: true });
}

/**
 * Write a wiki page to disk
 */
export async function writePageToDisk(
  sourceId: string,
  pageId: string,
  content: string
): Promise<void> {
  await ensureWikiDir(sourceId);
  const filePath = getPagePath(sourceId, pageId);
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Write wiki metadata to disk
 */
export async function writeMetaToDisk(sourceId: string, meta: WikiMeta): Promise<void> {
  await ensureWikiDir(sourceId);
  const filePath = getMetaPath(sourceId);
  await fs.writeFile(filePath, JSON.stringify(meta, null, 2), 'utf-8');
}

/**
 * Read a single page content from disk
 */
export async function readPageFromDisk(sourceId: string, pageId: string): Promise<string | null> {
  try {
    const filePath = getPagePath(sourceId, pageId);
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    // File not found or other error
    return null;
  }
}

/**
 * Read wiki metadata from disk
 */
export async function readMetaFromDisk(sourceId: string): Promise<WikiMeta | null> {
  try {
    const filePath = getMetaPath(sourceId);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as WikiMeta;
  } catch (error) {
    // File not found or parse error
    return null;
  }
}

/**
 * Check if wiki exists on disk
 */
export async function wikiExistsOnDisk(sourceId: string): Promise<boolean> {
  try {
    const metaPath = getMetaPath(sourceId);
    await fs.access(metaPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete wiki from disk
 */
export async function deleteWikiFromDisk(sourceId: string): Promise<void> {
  try {
    const wikiPath = getWikiPath(sourceId);
    await fs.rm(wikiPath, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }
}

/**
 * List all page files in a wiki directory
 */
export async function listPagesOnDisk(sourceId: string): Promise<string[]> {
  try {
    const wikiPath = getWikiPath(sourceId);
    const files = await fs.readdir(wikiPath);
    return files
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace('.md', ''));
  } catch {
    return [];
  }
}
