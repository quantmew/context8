import { taskRepository } from '@context8/database';

/**
 * Error thrown when a task is cancelled
 */
export class TaskCancelledException extends Error {
  constructor(taskId: string) {
    super(`Task ${taskId} was cancelled`);
    this.name = 'TaskCancelledException';
  }
}

/**
 * CancellationToken for polling task cancellation status
 * and providing an AbortSignal for pipeline integration
 */
export class CancellationToken {
  private taskId: string;
  private pollIntervalMs: number;
  private pollTimer: NodeJS.Timeout | null = null;
  private abortController: AbortController;
  private _isCancelled: boolean = false;

  constructor(taskId: string, pollIntervalMs: number = 2000) {
    this.taskId = taskId;
    this.pollIntervalMs = pollIntervalMs;
    this.abortController = new AbortController();
  }

  /**
   * Get the AbortSignal for pipeline integration
   */
  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  /**
   * Check if the task has been cancelled
   */
  get isCancelled(): boolean {
    return this._isCancelled;
  }

  /**
   * Start polling the database for cancellation status
   */
  startPolling(): void {
    if (this.pollTimer) {
      return; // Already polling
    }

    this.pollTimer = setInterval(async () => {
      try {
        const cancelled = await taskRepository.isCancelled(this.taskId);
        if (cancelled && !this._isCancelled) {
          this._isCancelled = true;
          this.abortController.abort();
          this.stopPolling();
        }
      } catch (err) {
        // Ignore polling errors - task may have been deleted
        console.error(`[CancellationToken] Error checking cancellation for task ${this.taskId}:`, err);
      }
    }, this.pollIntervalMs);
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Perform a single check for cancellation
   */
  async checkOnce(): Promise<boolean> {
    if (this._isCancelled) {
      return true;
    }

    try {
      const cancelled = await taskRepository.isCancelled(this.taskId);
      if (cancelled) {
        this._isCancelled = true;
        this.abortController.abort();
      }
      return this._isCancelled;
    } catch {
      return false;
    }
  }

  /**
   * Throw TaskCancelledException if cancelled
   */
  throwIfCancelled(): void {
    if (this._isCancelled) {
      throw new TaskCancelledException(this.taskId);
    }
  }
}
