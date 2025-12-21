/**
 * Task Logger Service
 * Buffers and persists log entries for indexing tasks
 */

import { taskRepository, type CreateTaskLogData } from '@context8/database';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface TaskLoggerOptions {
  /**
   * Flush interval in milliseconds
   * @default 500
   */
  flushIntervalMs?: number;

  /**
   * Also log to console
   * @default false
   */
  console?: boolean;
}

export class TaskLogger {
  private taskId: string;
  private buffer: CreateTaskLogData[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private flushIntervalMs: number;
  private logToConsole: boolean;
  private isClosed = false;

  constructor(taskId: string, options?: TaskLoggerOptions) {
    this.taskId = taskId;
    this.flushIntervalMs = options?.flushIntervalMs ?? 500;
    this.logToConsole = options?.console ?? false;
    this.startAutoFlush();
  }

  /**
   * Start auto-flush interval
   */
  private startAutoFlush(): void {
    if (this.flushInterval) return;

    this.flushInterval = setInterval(() => {
      this.flush().catch((err) => {
        console.error('[TaskLogger] Flush error:', err);
      });
    }, this.flushIntervalMs);
  }

  /**
   * Stop auto-flush interval
   */
  private stopAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Log a message
   */
  log(
    level: LogLevel,
    message: string,
    options?: { phase?: string; filePath?: string }
  ): void {
    if (this.isClosed) {
      console.warn('[TaskLogger] Attempting to log after close');
      return;
    }

    this.buffer.push({
      level,
      message,
      phase: options?.phase,
      filePath: options?.filePath,
    });

    if (this.logToConsole) {
      const prefix = options?.phase ? `[${options.phase}]` : '';
      const suffix = options?.filePath ? ` - ${options.filePath}` : '';
      console.log(`[${level}]${prefix} ${message}${suffix}`);
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, options?: { phase?: string; filePath?: string }): void {
    this.log('DEBUG', message, options);
  }

  /**
   * Log info message
   */
  info(message: string, options?: { phase?: string; filePath?: string }): void {
    this.log('INFO', message, options);
  }

  /**
   * Log warning message
   */
  warn(message: string, options?: { phase?: string; filePath?: string }): void {
    this.log('WARN', message, options);
  }

  /**
   * Log error message
   */
  error(message: string, options?: { phase?: string; filePath?: string }): void {
    this.log('ERROR', message, options);
  }

  /**
   * Flush buffered logs to database
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const logsToFlush = [...this.buffer];
    this.buffer = [];

    try {
      await taskRepository.addLogs(this.taskId, logsToFlush);
    } catch (error) {
      // Re-add logs to buffer on failure
      this.buffer = [...logsToFlush, ...this.buffer];
      throw error;
    }
  }

  /**
   * Close the logger and flush remaining logs
   */
  async close(): Promise<void> {
    if (this.isClosed) return;

    this.isClosed = true;
    this.stopAutoFlush();
    await this.flush();
  }

  /**
   * Get the task ID
   */
  getTaskId(): string {
    return this.taskId;
  }
}

/**
 * Create a task logger for a task
 */
export function createTaskLogger(
  taskId: string,
  options?: TaskLoggerOptions
): TaskLogger {
  return new TaskLogger(taskId, options);
}
