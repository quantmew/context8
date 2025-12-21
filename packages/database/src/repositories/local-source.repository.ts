import { prisma } from '../client.js';
import type { LocalSource, IndexingStatus, SnippetStatus, WikiStatus } from '@prisma/client';

export type CreateLocalSourceData = {
  path: string;
  name: string;
};

export type UpdateLocalSourceData = {
  name?: string;
  indexingStatus?: IndexingStatus;
  lastIndexedAt?: Date | null;
  fileCount?: number;
  chunkCount?: number;
  summaryCount?: number;
  indexError?: string | null;
  snippetCount?: number;
  snippetStatus?: SnippetStatus;
  wikiStatus?: WikiStatus;
};

export class LocalSourceRepository {
  async findById(id: string): Promise<LocalSource | null> {
    return prisma.localSource.findUnique({
      where: { id },
    });
  }

  async findByPath(path: string): Promise<LocalSource | null> {
    return prisma.localSource.findUnique({
      where: { path },
    });
  }

  async findAll(): Promise<LocalSource[]> {
    return prisma.localSource.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findByStatus(status: IndexingStatus): Promise<LocalSource[]> {
    return prisma.localSource.findMany({
      where: { indexingStatus: status },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(data: CreateLocalSourceData): Promise<LocalSource> {
    return prisma.localSource.create({
      data,
    });
  }

  async update(id: string, data: UpdateLocalSourceData): Promise<LocalSource> {
    return prisma.localSource.update({
      where: { id },
      data,
    });
  }

  async upsertByPath(
    path: string,
    createData: CreateLocalSourceData,
    updateData: UpdateLocalSourceData
  ): Promise<LocalSource> {
    return prisma.localSource.upsert({
      where: { path },
      create: createData,
      update: updateData,
    });
  }

  async updateIndexingStatus(
    id: string,
    status: IndexingStatus,
    error?: string | null
  ): Promise<LocalSource> {
    return prisma.localSource.update({
      where: { id },
      data: {
        indexingStatus: status,
        indexError: error ?? null,
        ...(status === 'READY' ? { lastIndexedAt: new Date() } : {}),
      },
    });
  }

  async updateStats(
    id: string,
    stats: { fileCount?: number; chunkCount?: number; summaryCount?: number }
  ): Promise<LocalSource> {
    return prisma.localSource.update({
      where: { id },
      data: stats,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.localSource.delete({
      where: { id },
    });
  }

  async deleteByPath(path: string): Promise<void> {
    await prisma.localSource.delete({
      where: { path },
    });
  }
}

export const localSourceRepository = new LocalSourceRepository();
