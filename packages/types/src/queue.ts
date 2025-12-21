/**
 * Job Queue Types
 */

// ============================================
// Job Types
// ============================================

export type JobType = 'FULL_INDEX' | 'INCREMENTAL' | 'REINDEX_FILE';

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

// ============================================
// Index Repository Job
// ============================================

export interface IndexRepoJobData {
  type: 'FULL_INDEX';
  repositoryId: string;
  orgId: string;
  cloneUrl: string;
  branch: string;
  installationId: number;
}

export interface IncrementalSyncJobData {
  type: 'INCREMENTAL';
  repositoryId: string;
  orgId: string;
  commitSha: string;
  previousCommitSha: string;
  changes: Array<{
    path: string;
    status: 'added' | 'modified' | 'removed';
  }>;
  installationId: number;
}

export interface ReindexFileJobData {
  type: 'REINDEX_FILE';
  repositoryId: string;
  filePath: string;
  commitSha: string;
}

export type IndexJobData = IndexRepoJobData | IncrementalSyncJobData | ReindexFileJobData;

// ============================================
// Job Results
// ============================================

export interface IndexJobResult {
  jobId: string;
  success: boolean;
  chunksProcessed: number;
  filesProcessed: number;
  duration: number;
  error?: string;
}

// ============================================
// Job Progress
// ============================================

export interface IndexJobProgress {
  phase: 'cloning' | 'parsing' | 'embedding' | 'indexing';
  current: number;
  total: number;
  currentFile?: string;
}

// ============================================
// Queue Names
// ============================================

export const QUEUE_NAMES = {
  INDEXING: 'context8:indexing',
  WEBHOOKS: 'context8:webhooks',
} as const;
