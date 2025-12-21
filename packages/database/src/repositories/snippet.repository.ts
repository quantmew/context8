import { prisma } from '../client.js';
import type { Snippet, SnippetCategory, SourceType } from '@prisma/client';

export type CreateSnippetData = {
  sourceId: string;
  sourceType?: SourceType;
  title: string;
  description: string;
  content: string;
  language: string;
  sourceUrl?: string | null;
  sourceFilePath: string;
  startLine?: number | null;
  endLine?: number | null;
  sourceChunkIds?: string[];
  category?: SnippetCategory;
  keywords?: string[];
  tokenCount?: number;
  vectorId?: string | null;
};

export type UpdateSnippetData = {
  title?: string;
  description?: string;
  content?: string;
  language?: string;
  sourceUrl?: string | null;
  category?: SnippetCategory;
  keywords?: string[];
  tokenCount?: number;
  vectorId?: string | null;
};

export type SnippetFilter = {
  sourceId?: string;
  sourceType?: SourceType;
  category?: SnippetCategory;
  language?: string;
  keywords?: string[];
};

export class SnippetRepository {
  async findById(id: string): Promise<Snippet | null> {
    return prisma.snippet.findUnique({
      where: { id },
    });
  }

  async findBySourceId(sourceId: string, sourceType?: SourceType): Promise<Snippet[]> {
    return prisma.snippet.findMany({
      where: {
        sourceId,
        ...(sourceType ? { sourceType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByCategory(
    sourceId: string,
    category: SnippetCategory
  ): Promise<Snippet[]> {
    return prisma.snippet.findMany({
      where: {
        sourceId,
        category,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByFilter(filter: SnippetFilter): Promise<Snippet[]> {
    return prisma.snippet.findMany({
      where: {
        ...(filter.sourceId ? { sourceId: filter.sourceId } : {}),
        ...(filter.sourceType ? { sourceType: filter.sourceType } : {}),
        ...(filter.category ? { category: filter.category } : {}),
        ...(filter.language ? { language: filter.language } : {}),
        ...(filter.keywords?.length
          ? { keywords: { hasSome: filter.keywords } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(): Promise<Snippet[]> {
    return prisma.snippet.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateSnippetData): Promise<Snippet> {
    return prisma.snippet.create({
      data: {
        sourceId: data.sourceId,
        sourceType: data.sourceType ?? 'LOCAL',
        title: data.title,
        description: data.description,
        content: data.content,
        language: data.language,
        sourceUrl: data.sourceUrl,
        sourceFilePath: data.sourceFilePath,
        startLine: data.startLine,
        endLine: data.endLine,
        sourceChunkIds: data.sourceChunkIds ?? [],
        category: data.category ?? 'OTHER',
        keywords: data.keywords ?? [],
        tokenCount: data.tokenCount ?? 0,
        vectorId: data.vectorId,
      },
    });
  }

  async createMany(data: CreateSnippetData[]): Promise<number> {
    const result = await prisma.snippet.createMany({
      data: data.map((d) => ({
        sourceId: d.sourceId,
        sourceType: d.sourceType ?? 'LOCAL',
        title: d.title,
        description: d.description,
        content: d.content,
        language: d.language,
        sourceUrl: d.sourceUrl,
        sourceFilePath: d.sourceFilePath,
        startLine: d.startLine,
        endLine: d.endLine,
        sourceChunkIds: d.sourceChunkIds ?? [],
        category: d.category ?? 'OTHER',
        keywords: d.keywords ?? [],
        tokenCount: d.tokenCount ?? 0,
        vectorId: d.vectorId,
      })),
    });
    return result.count;
  }

  async update(id: string, data: UpdateSnippetData): Promise<Snippet> {
    return prisma.snippet.update({
      where: { id },
      data,
    });
  }

  async updateVectorId(id: string, vectorId: string): Promise<Snippet> {
    return prisma.snippet.update({
      where: { id },
      data: { vectorId },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.snippet.delete({
      where: { id },
    });
  }

  async deleteBySourceId(sourceId: string): Promise<number> {
    const result = await prisma.snippet.deleteMany({
      where: { sourceId },
    });
    return result.count;
  }

  async countBySourceId(sourceId: string): Promise<number> {
    return prisma.snippet.count({
      where: { sourceId },
    });
  }

  async countByCategory(
    sourceId: string,
    category: SnippetCategory
  ): Promise<number> {
    return prisma.snippet.count({
      where: { sourceId, category },
    });
  }

  async getStatsBySourceId(sourceId: string): Promise<{
    total: number;
    byCategory: Record<SnippetCategory, number>;
    totalTokens: number;
  }> {
    const [total, byCategory, tokenSum] = await Promise.all([
      this.countBySourceId(sourceId),
      prisma.snippet.groupBy({
        by: ['category'],
        where: { sourceId },
        _count: { id: true },
      }),
      prisma.snippet.aggregate({
        where: { sourceId },
        _sum: { tokenCount: true },
      }),
    ]);

    const categoryMap = byCategory.reduce(
      (acc, item) => {
        acc[item.category] = item._count.id;
        return acc;
      },
      {} as Record<SnippetCategory, number>
    );

    return {
      total,
      byCategory: categoryMap,
      totalTokens: tokenSum._sum.tokenCount ?? 0,
    };
  }
}

export const snippetRepository = new SnippetRepository();
