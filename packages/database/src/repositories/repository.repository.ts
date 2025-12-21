import type { Repository, Prisma, IndexingStatus } from '@prisma/client';
import { prisma } from '../client.js';

export class RepositoryRepository {
  /**
   * Find repository by ID
   */
  async findById(id: string): Promise<Repository | null> {
    return prisma.repository.findUnique({
      where: { id },
    });
  }

  /**
   * Find repository by GitHub repo ID within an organization
   */
  async findByGitHubId(orgId: string, githubRepoId: string): Promise<Repository | null> {
    return prisma.repository.findUnique({
      where: {
        orgId_githubRepoId: { orgId, githubRepoId },
      },
    });
  }

  /**
   * Find repository by full name
   */
  async findByFullName(fullName: string): Promise<Repository | null> {
    return prisma.repository.findFirst({
      where: { fullName },
    });
  }

  /**
   * List all repositories for an organization
   */
  async findByOrgId(orgId: string): Promise<Repository[]> {
    return prisma.repository.findMany({
      where: { orgId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * List repositories by IDs (for permission filtering)
   */
  async findByIds(ids: string[]): Promise<Repository[]> {
    return prisma.repository.findMany({
      where: { id: { in: ids } },
    });
  }

  /**
   * Create a new repository
   */
  async create(data: Prisma.RepositoryCreateInput): Promise<Repository> {
    return prisma.repository.create({ data });
  }

  /**
   * Update repository
   */
  async update(id: string, data: Prisma.RepositoryUpdateInput): Promise<Repository> {
    return prisma.repository.update({
      where: { id },
      data,
    });
  }

  /**
   * Update indexing status
   */
  async updateIndexingStatus(
    id: string,
    status: IndexingStatus,
    extra?: {
      lastIndexedSha?: string;
      chunkCount?: number;
      fileCount?: number;
      indexError?: string | null;
    }
  ): Promise<Repository> {
    return prisma.repository.update({
      where: { id },
      data: {
        indexingStatus: status,
        ...(status === 'READY' ? { indexedAt: new Date() } : {}),
        ...extra,
      },
    });
  }

  /**
   * Delete repository
   */
  async delete(id: string): Promise<void> {
    await prisma.repository.delete({
      where: { id },
    });
  }

  /**
   * Get repositories ready for indexing
   */
  async findPendingIndexing(limit: number = 10): Promise<Repository[]> {
    return prisma.repository.findMany({
      where: { indexingStatus: 'PENDING' },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const repositoryRepository = new RepositoryRepository();
