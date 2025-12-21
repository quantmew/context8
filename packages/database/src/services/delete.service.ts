import { prisma } from '../client.js';
import {
  localSourceRepository,
  remoteSourceRepository,
  taskRepository,
  wikiRepository,
} from '../repositories/index.js';
import type { SourceType } from '@prisma/client';

export interface DeleteProjectOptions {
  sourceId: string;
  sourceType: SourceType;
  cancelRunningTasks?: boolean;
}

export interface DeleteProjectResult {
  success: boolean;
  sourceId: string;
  sourceType: SourceType;
  deletedCounts: {
    tasks: number;
    wikiPages: number;
  };
  errors: string[];
}

export class DeleteService {
  private vectorDeleteFn?: (sourceId: string) => Promise<void>;

  /**
   * Set the vector deletion function (injected by caller)
   */
  setVectorDeleteFn(fn: (sourceId: string) => Promise<void>): void {
    this.vectorDeleteFn = fn;
  }

  /**
   * Check if source has running tasks
   */
  async hasRunningTasks(sourceId: string): Promise<{ running: boolean; taskIds: string[] }> {
    const tasks = await prisma.task.findMany({
      where: {
        sourceId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      select: { id: true },
    });
    return {
      running: tasks.length > 0,
      taskIds: tasks.map((t) => t.id),
    };
  }

  /**
   * Cancel all pending/running tasks for a source
   */
  async cancelSourceTasks(sourceId: string): Promise<number> {
    const tasks = await prisma.task.findMany({
      where: {
        sourceId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      select: { id: true },
    });

    for (const task of tasks) {
      await taskRepository.cancel(task.id);
    }

    return tasks.length;
  }

  /**
   * Delete a project and all related data
   *
   * Deletion order:
   * 1. Check for running tasks (reject if found, unless cancelRunningTasks=true)
   * 2. Cancel running tasks (if force mode)
   * 3. Delete WikiStructure/WikiPages
   * 4. Delete Qdrant vectors (via callback)
   * 5. Delete Tasks
   * 6. Delete Source (cascades FileMetadata, LLMGeneration, Snippet for LOCAL)
   */
  async deleteProject(options: DeleteProjectOptions): Promise<DeleteProjectResult> {
    const { sourceId, sourceType, cancelRunningTasks = false } = options;
    const errors: string[] = [];
    const deletedCounts = {
      tasks: 0,
      wikiPages: 0,
    };

    // 1. Check for running tasks
    const { running, taskIds } = await this.hasRunningTasks(sourceId);
    if (running) {
      if (cancelRunningTasks) {
        const cancelledCount = await this.cancelSourceTasks(sourceId);
        deletedCounts.tasks = cancelledCount;
        // Wait briefly for cancellation to take effect
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        return {
          success: false,
          sourceId,
          sourceType,
          deletedCounts,
          errors: [
            `Cannot delete: ${taskIds.length} task(s) are still running. Use force=true to cancel them first.`,
          ],
        };
      }
    }

    // 2. Delete wiki structure and pages (before source deletion)
    try {
      const wiki = await wikiRepository.findStructureBySourceId(sourceId, sourceType);
      if (wiki) {
        deletedCounts.wikiPages = await wikiRepository.countPagesByStructureId(wiki.id);
        await wikiRepository.deleteStructureBySourceId(sourceId, sourceType);
      }
    } catch (err) {
      errors.push(`Wiki deletion error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    // 3. Delete vectors from Qdrant
    if (this.vectorDeleteFn) {
      try {
        await this.vectorDeleteFn(sourceId);
      } catch (err) {
        errors.push(`Vector deletion error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    // 4. Delete all tasks for this source
    try {
      const tasks = await taskRepository.findBySourceId(sourceId, 1000);
      deletedCounts.tasks = tasks.length;
      await taskRepository.deleteBySourceId(sourceId);
    } catch (err) {
      errors.push(`Task deletion error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    // 5. Delete the source itself (cascades FileMetadata, LLMGeneration, Snippet for LOCAL)
    try {
      if (sourceType === 'LOCAL') {
        await localSourceRepository.delete(sourceId);
      } else {
        await remoteSourceRepository.delete(sourceId);
      }
    } catch (err) {
      errors.push(`Source deletion error: ${err instanceof Error ? err.message : 'Unknown'}`);
      return {
        success: false,
        sourceId,
        sourceType,
        deletedCounts,
        errors,
      };
    }

    return {
      success: errors.length === 0,
      sourceId,
      sourceType,
      deletedCounts,
      errors,
    };
  }
}

export const deleteService = new DeleteService();
