import { prisma } from '../client.js';
import type { Settings } from '@prisma/client';

export class SettingsRepository {
  /**
   * Get a setting by key
   */
  async get(key: string): Promise<string | null> {
    const setting = await prisma.settings.findUnique({
      where: { key },
    });
    return setting?.value ?? null;
  }

  /**
   * Set a setting value (upsert)
   */
  async set(key: string, value: string): Promise<Settings> {
    return prisma.settings.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  /**
   * Get all settings as a key-value map
   */
  async getAll(): Promise<Record<string, string>> {
    const settings = await prisma.settings.findMany();
    return settings.reduce(
      (acc, s) => {
        acc[s.key] = s.value;
        return acc;
      },
      {} as Record<string, string>
    );
  }

  /**
   * Get settings by key prefix (e.g., "embedding." returns all embedding settings)
   */
  async getByPrefix(prefix: string): Promise<Record<string, string>> {
    const settings = await prisma.settings.findMany({
      where: {
        key: { startsWith: prefix },
      },
    });
    return settings.reduce(
      (acc, s) => {
        // Remove prefix from key for convenience
        const shortKey = s.key.substring(prefix.length);
        acc[shortKey] = s.value;
        return acc;
      },
      {} as Record<string, string>
    );
  }

  /**
   * Delete a setting by key
   */
  async delete(key: string): Promise<void> {
    await prisma.settings.delete({
      where: { key },
    }).catch(() => {
      // Ignore if not found
    });
  }

  /**
   * Delete all settings with a given prefix
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    await prisma.settings.deleteMany({
      where: {
        key: { startsWith: prefix },
      },
    });
  }

  /**
   * Set multiple settings at once
   */
  async setMany(settings: Record<string, string>): Promise<void> {
    const operations = Object.entries(settings).map(([key, value]) =>
      prisma.settings.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    );
    await prisma.$transaction(operations);
  }
}

export const settingsRepository = new SettingsRepository();
