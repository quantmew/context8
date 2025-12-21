import { prisma } from '../client.js';
import type { LLMGeneration, GenerationType } from '@prisma/client';

export type CreateLLMGenerationData = {
  sourceId: string;
  chunkId: string;
  contentHash: string;
  generationType: GenerationType;
  provider: string;
  model: string;
  input: string;
  output: string;
  promptTokens?: number;
  completionTokens?: number;
};

export class LLMGenerationRepository {
  async findById(id: string): Promise<LLMGeneration | null> {
    return prisma.lLMGeneration.findUnique({
      where: { id },
    });
  }

  async findByChunkAndType(
    chunkId: string,
    generationType: GenerationType,
    contentHash: string
  ): Promise<LLMGeneration | null> {
    return prisma.lLMGeneration.findUnique({
      where: {
        chunkId_generationType_contentHash: {
          chunkId,
          generationType,
          contentHash,
        },
      },
    });
  }

  async findBySourceId(sourceId: string): Promise<LLMGeneration[]> {
    return prisma.lLMGeneration.findMany({
      where: { sourceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySourceAndType(
    sourceId: string,
    generationType: GenerationType
  ): Promise<LLMGeneration[]> {
    return prisma.lLMGeneration.findMany({
      where: { sourceId, generationType },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByChunkId(chunkId: string): Promise<LLMGeneration[]> {
    return prisma.lLMGeneration.findMany({
      where: { chunkId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateLLMGenerationData): Promise<LLMGeneration> {
    return prisma.lLMGeneration.create({
      data,
    });
  }

  async createMany(data: CreateLLMGenerationData[]): Promise<number> {
    const result = await prisma.lLMGeneration.createMany({
      data,
      skipDuplicates: true,
    });
    return result.count;
  }

  async upsert(data: CreateLLMGenerationData): Promise<LLMGeneration> {
    return prisma.lLMGeneration.upsert({
      where: {
        chunkId_generationType_contentHash: {
          chunkId: data.chunkId,
          generationType: data.generationType,
          contentHash: data.contentHash,
        },
      },
      create: data,
      update: {
        output: data.output,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.lLMGeneration.delete({
      where: { id },
    });
  }

  async deleteBySourceId(sourceId: string): Promise<number> {
    const result = await prisma.lLMGeneration.deleteMany({
      where: { sourceId },
    });
    return result.count;
  }

  async deleteByChunkIds(chunkIds: string[]): Promise<number> {
    const result = await prisma.lLMGeneration.deleteMany({
      where: { chunkId: { in: chunkIds } },
    });
    return result.count;
  }

  async getTokenUsage(sourceId: string): Promise<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }> {
    const result = await prisma.lLMGeneration.aggregate({
      where: { sourceId },
      _sum: {
        promptTokens: true,
        completionTokens: true,
      },
    });
    const promptTokens = result._sum.promptTokens ?? 0;
    const completionTokens = result._sum.completionTokens ?? 0;
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }

  async countBySourceAndType(
    sourceId: string,
    generationType: GenerationType
  ): Promise<number> {
    return prisma.lLMGeneration.count({
      where: { sourceId, generationType },
    });
  }
}

export const llmGenerationRepository = new LLMGenerationRepository();
