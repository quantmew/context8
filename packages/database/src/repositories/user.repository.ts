import type { User, Prisma } from '@prisma/client';
import { prisma } from '../client.js';

export class UserRepository {
  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find user by GitHub ID
   */
  async findByGitHubId(githubId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { githubId },
    });
  }

  /**
   * Create a new user
   */
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  }

  /**
   * Update user
   */
  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * Create or update user (upsert)
   */
  async upsert(
    githubId: string,
    data: Omit<Prisma.UserCreateInput, 'githubId'>
  ): Promise<User> {
    return prisma.user.upsert({
      where: { githubId },
      create: { githubId, ...data },
      update: data,
    });
  }

  /**
   * Add user to organization
   */
  async addToOrganization(
    userId: string,
    orgId: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER'
  ): Promise<void> {
    await prisma.userOrganization.upsert({
      where: {
        userId_orgId: { userId, orgId },
      },
      create: { userId, orgId, role },
      update: { role },
    });
  }

  /**
   * Remove user from organization
   */
  async removeFromOrganization(userId: string, orgId: string): Promise<void> {
    await prisma.userOrganization.delete({
      where: {
        userId_orgId: { userId, orgId },
      },
    });
  }

  /**
   * Check if user belongs to organization
   */
  async isInOrganization(userId: string, orgId: string): Promise<boolean> {
    const membership = await prisma.userOrganization.findUnique({
      where: {
        userId_orgId: { userId, orgId },
      },
    });
    return membership !== null;
  }
}

export const userRepository = new UserRepository();
