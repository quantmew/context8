import type { ApiKey, Prisma } from '@prisma/client';
import { prisma } from '../client.js';

export class ApiKeyRepository {
  /**
   * Find API key by hash
   */
  async findByHash(keyHash: string): Promise<ApiKey | null> {
    return prisma.apiKey.findUnique({
      where: { keyHash },
    });
  }

  /**
   * Find API key by ID
   */
  async findById(id: string): Promise<ApiKey | null> {
    return prisma.apiKey.findUnique({
      where: { id },
    });
  }

  /**
   * List API keys for a user
   */
  async findByUserId(userId: string): Promise<ApiKey[]> {
    return prisma.apiKey.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * List API keys for an organization
   */
  async findByOrgId(orgId: string): Promise<ApiKey[]> {
    return prisma.apiKey.findMany({
      where: {
        orgId,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new API key
   */
  async create(data: Prisma.ApiKeyCreateInput): Promise<ApiKey> {
    return prisma.apiKey.create({ data });
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(id: string): Promise<void> {
    await prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  /**
   * Revoke API key
   */
  async revoke(id: string): Promise<ApiKey> {
    return prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Check if API key is valid (not revoked, not expired)
   */
  async isValid(keyHash: string): Promise<boolean> {
    const apiKey = await this.findByHash(keyHash);
    if (!apiKey) return false;
    if (apiKey.revokedAt) return false;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return false;
    return true;
  }

  /**
   * Delete API key
   */
  async delete(id: string): Promise<void> {
    await prisma.apiKey.delete({
      where: { id },
    });
  }
}

export const apiKeyRepository = new ApiKeyRepository();
