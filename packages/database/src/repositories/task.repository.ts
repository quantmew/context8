import { prisma } from '../client.js';
import type {
  Task,
  TaskLog,
  TaskStatus,
  TaskType,
  SourceType,
  TriggerType,
  LogLevel,
  Prisma,
} from '@prisma/client';

export type CreateTaskData = {
  sourceId: string;
  sourceType: SourceType;
  taskType: TaskType;
  triggeredBy?: TriggerType;
  filesTotal?: number;
};

export type UpdateTaskData = {
  status?: TaskStatus;
  filesTotal?: number;
  filesProcessed?: number;
  chunksCreated?: number;
  summariesGenerated?: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string | null;
};

export type CreateTaskLogData = {
  level?: LogLevel;
  phase?: string;
  message: string;
  filePath?: string;
  metadata?: Prisma.InputJsonValue;
};

export class TaskRepository {
  /**
   * Create a new task
   */
  async create(data: CreateTaskData): Promise<Task> {
    return prisma.task.create({
      data: {
        sourceId: data.sourceId,
        sourceType: data.sourceType,
        taskType: data.taskType,
        triggeredBy: data.triggeredBy ?? 'CLI',
        filesTotal: data.filesTotal ?? 0,
      },
    });
  }

  /**
   * Find task by ID
   */
  async findById(id: string): Promise<Task | null> {
    return prisma.task.findUnique({
      where: { id },
    });
  }

  /**
   * Find task by ID with logs
   */
  async findByIdWithLogs(id: string): Promise<(Task & { logs: TaskLog[] }) | null> {
    return prisma.task.findUnique({
      where: { id },
      include: {
        logs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  /**
   * Find tasks by source ID
   */
  async findBySourceId(sourceId: string, limit = 10): Promise<Task[]> {
    return prisma.task.findMany({
      where: { sourceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Find running tasks
   */
  async findRunning(): Promise<Task[]> {
    return prisma.task.findMany({
      where: { status: 'RUNNING' },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Find recent tasks with latest log
   */
  async findRecent(limit = 50): Promise<(Task & { logs: TaskLog[] })[]> {
    return prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  /**
   * Find tasks by status
   */
  async findByStatus(status: TaskStatus, limit = 50): Promise<Task[]> {
    return prisma.task.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Update task
   */
  async update(id: string, data: UpdateTaskData): Promise<Task> {
    return prisma.task.update({
      where: { id },
      data,
    });
  }

  /**
   * Update task status with auto-timestamps
   */
  async updateStatus(
    id: string,
    status: TaskStatus,
    data?: Partial<Pick<Task, 'errorMessage' | 'filesProcessed' | 'chunksCreated' | 'summariesGenerated'>>
  ): Promise<Task> {
    return prisma.task.update({
      where: { id },
      data: {
        status,
        ...data,
        ...(status === 'RUNNING' ? { startedAt: new Date() } : {}),
        ...(status === 'COMPLETED' || status === 'FAILED' ? { completedAt: new Date() } : {}),
      },
    });
  }

  /**
   * Update task progress
   */
  async updateProgress(
    id: string,
    progress: {
      filesTotal?: number;
      filesProcessed?: number;
      chunksCreated?: number;
      summariesGenerated?: number;
    }
  ): Promise<Task> {
    return prisma.task.update({
      where: { id },
      data: progress,
    });
  }

  /**
   * Add a log entry to a task
   */
  async addLog(taskId: string, data: CreateTaskLogData): Promise<TaskLog> {
    return prisma.taskLog.create({
      data: {
        taskId,
        level: data.level ?? 'INFO',
        phase: data.phase,
        message: data.message,
        filePath: data.filePath,
        metadata: data.metadata,
      },
    });
  }

  /**
   * Add multiple log entries to a task (batch insert)
   */
  async addLogs(taskId: string, logs: CreateTaskLogData[]): Promise<number> {
    const result = await prisma.taskLog.createMany({
      data: logs.map((log) => ({
        taskId,
        level: log.level ?? 'INFO',
        phase: log.phase,
        message: log.message,
        filePath: log.filePath,
        metadata: log.metadata,
      })),
    });
    return result.count;
  }

  /**
   * Get logs for a task
   */
  async getLogs(
    taskId: string,
    options?: { since?: Date; limit?: number }
  ): Promise<TaskLog[]> {
    return prisma.taskLog.findMany({
      where: {
        taskId,
        ...(options?.since ? { createdAt: { gt: options.since } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: options?.limit ?? 1000,
    });
  }

  /**
   * Get latest log for a task
   */
  async getLatestLog(taskId: string): Promise<TaskLog | null> {
    return prisma.taskLog.findFirst({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete a task and its logs
   */
  async delete(id: string): Promise<void> {
    await prisma.task.delete({
      where: { id },
    });
  }

  /**
   * Delete all tasks for a source
   */
  async deleteBySourceId(sourceId: string): Promise<void> {
    await prisma.task.deleteMany({
      where: { sourceId },
    });
  }

  /**
   * Cancel a task by ID
   */
  async cancel(id: string): Promise<Task> {
    return prisma.task.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        errorMessage: 'Task cancelled by user',
      },
    });
  }

  /**
   * Mark all running tasks as cancelled (stale task recovery on worker restart)
   */
  async cancelAllRunning(): Promise<number> {
    // Find all running tasks to get their details for source status reset
    const runningTasks = await prisma.task.findMany({
      where: { status: 'RUNNING' },
      select: {
        id: true,
        sourceId: true,
        sourceType: true,
        taskType: true,
      },
    });

    if (runningTasks.length === 0) {
      return 0;
    }

    // Mark all as CANCELLED
    await prisma.task.updateMany({
      where: { status: 'RUNNING' },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        errorMessage: 'Task cancelled: worker restarted',
      },
    });

    // Reset source statuses based on task type
    for (const task of runningTasks) {
      try {
        if (task.taskType === 'SNIPPET_GENERATE') {
          if (task.sourceType === 'REMOTE') {
            await prisma.remoteSource.update({
              where: { id: task.sourceId },
              data: { snippetStatus: 'PENDING' },
            });
          } else {
            await prisma.localSource.update({
              where: { id: task.sourceId },
              data: { snippetStatus: 'PENDING' },
            });
          }
        } else if (task.taskType === 'WIKI_GENERATE') {
          if (task.sourceType === 'REMOTE') {
            await prisma.remoteSource.update({
              where: { id: task.sourceId },
              data: { wikiStatus: 'PENDING' },
            });
          } else {
            await prisma.localSource.update({
              where: { id: task.sourceId },
              data: { wikiStatus: 'PENDING' },
            });
          }
        } else {
          // Indexing tasks
          if (task.sourceType === 'REMOTE') {
            await prisma.remoteSource.update({
              where: { id: task.sourceId },
              data: { indexingStatus: 'PENDING', indexError: null },
            });
          } else {
            await prisma.localSource.update({
              where: { id: task.sourceId },
              data: { indexingStatus: 'PENDING', indexError: null },
            });
          }
        }
      } catch (err) {
        // Source might have been deleted, ignore
        console.error(`[TaskRepository] Failed to reset source status for task ${task.id}:`, err);
      }
    }

    return runningTasks.length;
  }

  /**
   * Check if a task is cancelled
   */
  async isCancelled(id: string): Promise<boolean> {
    const task = await prisma.task.findUnique({
      where: { id },
      select: { status: true },
    });
    return task?.status === 'CANCELLED';
  }
}

export const taskRepository = new TaskRepository();
