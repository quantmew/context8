import { prisma } from '../client.js';
import type { WikiStructure, WikiPage, WikiStatus, WikiImportance, SourceType } from '@prisma/client';

export type CreateWikiStructureData = {
  sourceId: string;
  sourceType: SourceType;
  title: string;
  description: string;
  status?: WikiStatus;
  errorMessage?: string | null;
};

export type UpdateWikiStructureData = {
  title?: string;
  description?: string;
  status?: WikiStatus;
  errorMessage?: string | null;
};

export type CreateWikiPageData = {
  structureId: string;
  pageId: string;
  title: string;
  content: string;
  importance?: WikiImportance;
  order?: number;
  filePaths?: string[];
  relatedPageIds?: string[];
  parentPageId?: string | null;
  isSection?: boolean;
  vectorId?: string | null;
};

export type UpdateWikiPageData = {
  title?: string;
  content?: string;
  importance?: WikiImportance;
  order?: number;
  filePaths?: string[];
  relatedPageIds?: string[];
  parentPageId?: string | null;
  isSection?: boolean;
  vectorId?: string | null;
};

export class WikiRepository {
  // ========================================
  // WikiStructure Methods
  // ========================================

  async findStructureById(id: string): Promise<WikiStructure | null> {
    return prisma.wikiStructure.findUnique({
      where: { id },
    });
  }

  async findStructureBySourceId(
    sourceId: string,
    sourceType: SourceType
  ): Promise<WikiStructure | null> {
    return prisma.wikiStructure.findUnique({
      where: {
        sourceId_sourceType: { sourceId, sourceType },
      },
    });
  }

  async findStructureWithPages(
    sourceId: string,
    sourceType: SourceType
  ): Promise<(WikiStructure & { pages: WikiPage[] }) | null> {
    return prisma.wikiStructure.findUnique({
      where: {
        sourceId_sourceType: { sourceId, sourceType },
      },
      include: {
        pages: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async createStructure(data: CreateWikiStructureData): Promise<WikiStructure> {
    return prisma.wikiStructure.create({
      data: {
        sourceId: data.sourceId,
        sourceType: data.sourceType,
        title: data.title,
        description: data.description,
        status: data.status ?? 'PENDING',
        errorMessage: data.errorMessage,
      },
    });
  }

  async upsertStructure(data: CreateWikiStructureData): Promise<WikiStructure> {
    return prisma.wikiStructure.upsert({
      where: {
        sourceId_sourceType: { sourceId: data.sourceId, sourceType: data.sourceType },
      },
      create: {
        sourceId: data.sourceId,
        sourceType: data.sourceType,
        title: data.title,
        description: data.description,
        status: data.status ?? 'PENDING',
        errorMessage: data.errorMessage,
      },
      update: {
        title: data.title,
        description: data.description,
        status: data.status ?? 'PENDING',
        errorMessage: data.errorMessage,
      },
    });
  }

  async updateStructure(id: string, data: UpdateWikiStructureData): Promise<WikiStructure> {
    return prisma.wikiStructure.update({
      where: { id },
      data,
    });
  }

  async updateStructureStatus(
    id: string,
    status: WikiStatus,
    errorMessage?: string | null
  ): Promise<WikiStructure> {
    return prisma.wikiStructure.update({
      where: { id },
      data: { status, errorMessage },
    });
  }

  async deleteStructure(id: string): Promise<void> {
    await prisma.wikiStructure.delete({
      where: { id },
    });
  }

  async deleteStructureBySourceId(sourceId: string, sourceType: SourceType): Promise<void> {
    await prisma.wikiStructure.deleteMany({
      where: { sourceId, sourceType },
    });
  }

  // ========================================
  // WikiPage Methods
  // ========================================

  async findPageById(id: string): Promise<WikiPage | null> {
    return prisma.wikiPage.findUnique({
      where: { id },
    });
  }

  async findPageByPageId(structureId: string, pageId: string): Promise<WikiPage | null> {
    return prisma.wikiPage.findUnique({
      where: {
        structureId_pageId: { structureId, pageId },
      },
    });
  }

  async findPagesByStructureId(structureId: string): Promise<WikiPage[]> {
    return prisma.wikiPage.findMany({
      where: { structureId },
      orderBy: { order: 'asc' },
    });
  }

  async findPagesByImportance(
    structureId: string,
    importance: WikiImportance
  ): Promise<WikiPage[]> {
    return prisma.wikiPage.findMany({
      where: { structureId, importance },
      orderBy: { order: 'asc' },
    });
  }

  async findRootPages(structureId: string): Promise<WikiPage[]> {
    return prisma.wikiPage.findMany({
      where: {
        structureId,
        parentPageId: null,
      },
      orderBy: { order: 'asc' },
    });
  }

  async findChildPages(structureId: string, parentPageId: string): Promise<WikiPage[]> {
    return prisma.wikiPage.findMany({
      where: { structureId, parentPageId },
      orderBy: { order: 'asc' },
    });
  }

  async createPage(data: CreateWikiPageData): Promise<WikiPage> {
    return prisma.wikiPage.create({
      data: {
        structureId: data.structureId,
        pageId: data.pageId,
        title: data.title,
        content: data.content,
        importance: data.importance ?? 'MEDIUM',
        order: data.order ?? 0,
        filePaths: data.filePaths ?? [],
        relatedPageIds: data.relatedPageIds ?? [],
        parentPageId: data.parentPageId,
        isSection: data.isSection ?? false,
        vectorId: data.vectorId,
      },
    });
  }

  async createManyPages(data: CreateWikiPageData[]): Promise<number> {
    const result = await prisma.wikiPage.createMany({
      data: data.map((d) => ({
        structureId: d.structureId,
        pageId: d.pageId,
        title: d.title,
        content: d.content,
        importance: d.importance ?? 'MEDIUM',
        order: d.order ?? 0,
        filePaths: d.filePaths ?? [],
        relatedPageIds: d.relatedPageIds ?? [],
        parentPageId: d.parentPageId,
        isSection: d.isSection ?? false,
        vectorId: d.vectorId,
      })),
    });
    return result.count;
  }

  async updatePage(id: string, data: UpdateWikiPageData): Promise<WikiPage> {
    return prisma.wikiPage.update({
      where: { id },
      data,
    });
  }

  async updatePageVectorId(id: string, vectorId: string): Promise<WikiPage> {
    return prisma.wikiPage.update({
      where: { id },
      data: { vectorId },
    });
  }

  async deletePage(id: string): Promise<void> {
    await prisma.wikiPage.delete({
      where: { id },
    });
  }

  async deletePagesByStructureId(structureId: string): Promise<number> {
    const result = await prisma.wikiPage.deleteMany({
      where: { structureId },
    });
    return result.count;
  }

  async countPagesByStructureId(structureId: string): Promise<number> {
    return prisma.wikiPage.count({
      where: { structureId },
    });
  }

  async countPagesByImportance(
    structureId: string,
    importance: WikiImportance
  ): Promise<number> {
    return prisma.wikiPage.count({
      where: { structureId, importance },
    });
  }

  // ========================================
  // Combined Methods
  // ========================================

  async getFullWiki(
    sourceId: string,
    sourceType: SourceType
  ): Promise<{
    structure: WikiStructure;
    pages: WikiPage[];
  } | null> {
    const structure = await this.findStructureWithPages(sourceId, sourceType);
    if (!structure) return null;

    const { pages, ...structureWithoutPages } = structure;
    return {
      structure: structureWithoutPages as WikiStructure,
      pages,
    };
  }

  async getWikiStats(structureId: string): Promise<{
    pageCount: number;
    byImportance: Record<WikiImportance, number>;
    sectionCount: number;
  }> {
    const [pageCount, byImportance, sectionCount] = await Promise.all([
      this.countPagesByStructureId(structureId),
      prisma.wikiPage.groupBy({
        by: ['importance'],
        where: { structureId },
        _count: { id: true },
      }),
      prisma.wikiPage.count({
        where: { structureId, isSection: true },
      }),
    ]);

    const importanceMap = byImportance.reduce(
      (acc, item) => {
        acc[item.importance] = item._count.id;
        return acc;
      },
      {} as Record<WikiImportance, number>
    );

    return {
      pageCount,
      byImportance: importanceMap,
      sectionCount,
    };
  }
}

export const wikiRepository = new WikiRepository();
