import { prisma } from '../client.js';
import type { RemoteSource, IndexingStatus, RemoteProvider, SnippetStatus, WikiStatus } from '@prisma/client';

export type CreateRemoteSourceData = {
  provider: RemoteProvider;
  repoUrl: string;
  fullName: string;
  description?: string;
  defaultBranch?: string;
  credentialId?: string;
};

export type UpdateRemoteSourceData = {
  description?: string;
  localPath?: string;
  defaultBranch?: string;
  lastClonedAt?: Date | null;
  lastCommitSha?: string | null;
  indexingStatus?: IndexingStatus;
  fileCount?: number;
  chunkCount?: number;
  summaryCount?: number;
  indexError?: string | null;
  syncEnabled?: boolean;
  syncIntervalHrs?: number;
  lastSyncAt?: Date | null;
  credentialId?: string | null;
  snippetCount?: number;
  snippetStatus?: SnippetStatus;
  wikiStatus?: WikiStatus;
};

export class RemoteSourceRepository {
  async findById(id: string): Promise<RemoteSource | null> {
    return prisma.remoteSource.findUnique({
      where: { id },
      include: { credential: true },
    });
  }

  async findByUrl(repoUrl: string): Promise<RemoteSource | null> {
    return prisma.remoteSource.findUnique({
      where: { repoUrl },
      include: { credential: true },
    });
  }

  async findAll(): Promise<RemoteSource[]> {
    return prisma.remoteSource.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { credential: true },
    });
  }

  async findByProvider(provider: RemoteProvider): Promise<RemoteSource[]> {
    return prisma.remoteSource.findMany({
      where: { provider },
      orderBy: { updatedAt: 'desc' },
      include: { credential: true },
    });
  }

  async findByStatus(status: IndexingStatus): Promise<RemoteSource[]> {
    return prisma.remoteSource.findMany({
      where: { indexingStatus: status },
      orderBy: { updatedAt: 'desc' },
      include: { credential: true },
    });
  }

  async findPendingSync(): Promise<RemoteSource[]> {
    const now = new Date();
    return prisma.remoteSource.findMany({
      where: {
        syncEnabled: true,
        indexingStatus: 'READY',
        OR: [
          { lastSyncAt: null },
          {
            lastSyncAt: {
              lt: new Date(now.getTime() - 1000 * 60 * 60), // At least 1 hour ago
            },
          },
        ],
      },
      include: { credential: true },
    });
  }

  async create(data: CreateRemoteSourceData): Promise<RemoteSource> {
    return prisma.remoteSource.create({
      data,
      include: { credential: true },
    });
  }

  async update(id: string, data: UpdateRemoteSourceData): Promise<RemoteSource> {
    return prisma.remoteSource.update({
      where: { id },
      data,
      include: { credential: true },
    });
  }

  async updateIndexingStatus(
    id: string,
    status: IndexingStatus,
    error?: string | null
  ): Promise<RemoteSource> {
    return prisma.remoteSource.update({
      where: { id },
      data: {
        indexingStatus: status,
        indexError: error ?? null,
      },
      include: { credential: true },
    });
  }

  async updateStats(
    id: string,
    stats: { fileCount?: number; chunkCount?: number; summaryCount?: number }
  ): Promise<RemoteSource> {
    return prisma.remoteSource.update({
      where: { id },
      data: stats,
      include: { credential: true },
    });
  }

  async updateCloneInfo(
    id: string,
    data: { localPath: string; lastClonedAt: Date; lastCommitSha: string }
  ): Promise<RemoteSource> {
    return prisma.remoteSource.update({
      where: { id },
      data,
      include: { credential: true },
    });
  }

  async updateLastSync(id: string): Promise<RemoteSource> {
    return prisma.remoteSource.update({
      where: { id },
      data: { lastSyncAt: new Date() },
      include: { credential: true },
    });
  }

  async incrementSearchCount(id: string): Promise<void> {
    await prisma.remoteSource.update({
      where: { id },
      data: { searchCount: { increment: 1 } },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.remoteSource.delete({
      where: { id },
    });
  }
}

export const remoteSourceRepository = new RemoteSourceRepository();
