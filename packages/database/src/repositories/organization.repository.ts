import type { Organization, Prisma } from '@prisma/client';
import { prisma } from '../client.js';

export class OrganizationRepository {
  /**
   * Find organization by GitHub installation ID
   */
  async findByInstallId(githubInstallId: string): Promise<Organization | null> {
    return prisma.organization.findUnique({
      where: { githubInstallId },
    });
  }

  /**
   * Find organization by ID
   */
  async findById(id: string): Promise<Organization | null> {
    return prisma.organization.findUnique({
      where: { id },
    });
  }

  /**
   * Create a new organization
   */
  async create(data: Prisma.OrganizationCreateInput): Promise<Organization> {
    return prisma.organization.create({ data });
  }

  /**
   * Update organization
   */
  async update(
    id: string,
    data: Prisma.OrganizationUpdateInput
  ): Promise<Organization> {
    return prisma.organization.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete organization and all related data
   */
  async delete(id: string): Promise<void> {
    await prisma.organization.delete({
      where: { id },
    });
  }

  /**
   * Get organizations for a user
   */
  async findByUserId(userId: string): Promise<Organization[]> {
    const userOrgs = await prisma.userOrganization.findMany({
      where: { userId },
      include: { org: true },
    });
    return userOrgs.map((uo) => uo.org);
  }
}

export const organizationRepository = new OrganizationRepository();
