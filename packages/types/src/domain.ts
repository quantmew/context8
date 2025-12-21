/**
 * Core domain types for Context8
 */

// ============================================
// Organization & User
// ============================================

export interface Organization {
  id: string;
  githubInstallId: string;
  name: string;
  planTier: PlanTier;
  createdAt: Date;
  updatedAt: Date;
}

export type PlanTier = 'FREE' | 'PRO' | 'ENTERPRISE';

export interface User {
  id: string;
  githubId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}

// ============================================
// Repository
// ============================================

export interface Repository {
  id: string;
  orgId: string;
  githubRepoId: string;
  fullName: string;
  defaultBranch: string;
  lastIndexedSha: string | null;
  indexingStatus: IndexingStatus;
  chunkCount: number;
  fileCount: number;
  indexedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type IndexingStatus = 'PENDING' | 'INDEXING' | 'READY' | 'ERROR';

// ============================================
// Code Chunks
// ============================================

export interface CodeChunk {
  id: string;
  repositoryId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  language: SupportedLanguage;
  chunkType: ChunkType;
  chunkLevel: ChunkLevel;
  symbolName: string | null;
  signature: string | null;
  content: string;
  commitSha: string;
  contentHash: string;
  imports: string[];
  exports: string[];
  parentChunkId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SupportedLanguage = 'typescript' | 'python';

export type ChunkType =
  | 'function'
  | 'method'
  | 'class'
  | 'interface'
  | 'type_alias'
  | 'module'
  | 'file_summary';

export type ChunkLevel = 'summary' | 'implementation';

// ============================================
// Source Location
// ============================================

export interface SourceLocation {
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

// ============================================
// Dependencies
// ============================================

export interface DependencyInfo {
  imports: ImportStatement[];
  exports: ExportStatement[];
  calls: FunctionCall[];
  references: string[];
}

export interface ImportStatement {
  source: string;
  specifiers: string[];
  isTypeOnly: boolean;
}

export interface ExportStatement {
  name: string;
  isDefault: boolean;
  isTypeOnly: boolean;
}

export interface FunctionCall {
  name: string;
  isExternal: boolean;
}

// ============================================
// Search & Retrieval
// ============================================

export interface SearchResult {
  chunk: CodeChunk;
  score: number;
  matchType: 'semantic' | 'keyword' | 'hybrid';
  highlights?: Array<{
    startOffset: number;
    endOffset: number;
  }>;
}

export interface SearchFilter {
  repoIds?: string[];
  languages?: SupportedLanguage[];
  chunkTypes?: ChunkType[];
  chunkLevels?: ChunkLevel[];
}

// ============================================
// User Permissions
// ============================================

export interface UserPermissionContext {
  userId: string;
  organizationId: string;
  accessibleRepoIds: string[];
  scopes: string[];
  tokenExpiry: Date;
}

// ============================================
// API Key
// ============================================

export interface ApiKey {
  id: string;
  userId: string;
  orgId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}
