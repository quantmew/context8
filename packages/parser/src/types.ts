import type { SupportedLanguage, ChunkType, ChunkLevel } from '@context8/types';

/**
 * Parser Types
 */

export interface ParsedFile {
  filePath: string;
  language: SupportedLanguage;
  content: string;
}

export interface ExtractedSymbol {
  name: string;
  type: ChunkType;
  signature: string;
  docstring: string | null;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  bodyStartLine: number;
  decorators: string[];
  visibility: 'public' | 'private' | 'protected';
  parentSymbol: string | null;
}

export interface CodeChunkData {
  id: string;
  repositoryId: string;
  level: ChunkLevel;
  type: ChunkType;
  language: SupportedLanguage;
  content: string;
  signature: string | null;
  symbolName: string | null;
  filePath: string;
  startLine: number;
  endLine: number;
  commitSha: string;
  contentHash: string;
  imports: string[];
  exports: string[];
  parentChunkId: string | null;
  childChunkIds: string[];
}

export interface ChunkingOptions {
  maxChunkTokens: number;
  minChunkTokens: number;
  overlapTokens: number;
  includeSignatureInBody: boolean;
}

export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  maxChunkTokens: 512,
  minChunkTokens: 50,
  overlapTokens: 50,
  includeSignatureInBody: true,
};
