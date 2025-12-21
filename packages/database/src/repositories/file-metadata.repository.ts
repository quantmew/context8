import { prisma } from '../client.js';
import type { FileMetadata } from '@prisma/client';

export type CreateFileMetadataData = {
  sourceId: string;
  filePath: string;
  absolutePath: string;
  contentHash: string;
  size: number;
  language?: string | null;
  lastModified: Date;
  lastIndexed: Date;
  chunkCount?: number;
  hasSummary?: boolean;
};

export type UpdateFileMetadataData = {
  contentHash?: string;
  size?: number;
  language?: string | null;
  lastModified?: Date;
  lastIndexed?: Date;
  chunkCount?: number;
  hasSummary?: boolean;
};

export class FileMetadataRepository {
  async findById(id: string): Promise<FileMetadata | null> {
    return prisma.fileMetadata.findUnique({
      where: { id },
    });
  }

  async findBySourceAndPath(
    sourceId: string,
    filePath: string
  ): Promise<FileMetadata | null> {
    return prisma.fileMetadata.findUnique({
      where: {
        sourceId_filePath: { sourceId, filePath },
      },
    });
  }

  async findBySourceId(sourceId: string): Promise<FileMetadata[]> {
    return prisma.fileMetadata.findMany({
      where: { sourceId },
      orderBy: { filePath: 'asc' },
    });
  }

  async findByContentHash(contentHash: string): Promise<FileMetadata[]> {
    return prisma.fileMetadata.findMany({
      where: { contentHash },
    });
  }

  async create(data: CreateFileMetadataData): Promise<FileMetadata> {
    return prisma.fileMetadata.create({
      data,
    });
  }

  async createMany(data: CreateFileMetadataData[]): Promise<number> {
    const result = await prisma.fileMetadata.createMany({
      data,
      skipDuplicates: true,
    });
    return result.count;
  }

  async update(id: string, data: UpdateFileMetadataData): Promise<FileMetadata> {
    return prisma.fileMetadata.update({
      where: { id },
      data,
    });
  }

  async upsert(
    sourceId: string,
    filePath: string,
    data: CreateFileMetadataData
  ): Promise<FileMetadata> {
    return prisma.fileMetadata.upsert({
      where: {
        sourceId_filePath: { sourceId, filePath },
      },
      create: data,
      update: {
        contentHash: data.contentHash,
        size: data.size,
        language: data.language,
        lastModified: data.lastModified,
        lastIndexed: data.lastIndexed,
        chunkCount: data.chunkCount,
        hasSummary: data.hasSummary,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.fileMetadata.delete({
      where: { id },
    });
  }

  async deleteBySourceId(sourceId: string): Promise<number> {
    const result = await prisma.fileMetadata.deleteMany({
      where: { sourceId },
    });
    return result.count;
  }

  async deleteByPaths(sourceId: string, filePaths: string[]): Promise<number> {
    const result = await prisma.fileMetadata.deleteMany({
      where: {
        sourceId,
        filePath: { in: filePaths },
      },
    });
    return result.count;
  }

  async getFilePathsForSource(sourceId: string): Promise<string[]> {
    const files = await prisma.fileMetadata.findMany({
      where: { sourceId },
      select: { filePath: true },
    });
    return files.map((f) => f.filePath);
  }

  async getFileHashMap(
    sourceId: string
  ): Promise<Map<string, { id: string; contentHash: string }>> {
    const files = await prisma.fileMetadata.findMany({
      where: { sourceId },
      select: { id: true, filePath: true, contentHash: true },
    });
    return new Map(files.map((f) => [f.filePath, { id: f.id, contentHash: f.contentHash }]));
  }
}

export const fileMetadataRepository = new FileMetadataRepository();
