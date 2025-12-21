'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { CancelTaskButton } from './cancel-task-button';

type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

interface TaskInfo {
  id: string;
  status: TaskStatus;
  filesTotal: number;
  filesProcessed: number;
  chunksCreated: number;
  summariesGenerated: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

interface TaskStatusBarProps {
  taskId: string;
  className?: string;
  onStatusChange?: (status: TaskStatus) => void;
  onCancelled?: () => void;
}

const statusConfig: Record<TaskStatus, { icon: typeof Loader2; color: string; bgColor: string; label: string }> = {
  PENDING: { icon: Clock, color: 'text-gray-400', bgColor: 'bg-gray-500', label: 'Pending' },
  RUNNING: { icon: Loader2, color: 'text-blue-400', bgColor: 'bg-blue-500', label: 'Running' },
  COMPLETED: { icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500', label: 'Completed' },
  FAILED: { icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-500', label: 'Failed' },
  CANCELLED: { icon: AlertCircle, color: 'text-yellow-400', bgColor: 'bg-yellow-500', label: 'Cancelled' },
};

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '-';

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const durationMs = end - start;

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function TaskStatusBar({ taskId, className, onStatusChange, onCancelled }: TaskStatusBarProps) {
  const [task, setTask] = useState<TaskInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('-');

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}/logs`);
        if (!response.ok) {
          throw new Error('Failed to fetch task');
        }
        const data = await response.json();
        setTask(data.task);
        setError(null);

        if (onStatusChange) {
          onStatusChange(data.task.status);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTask();

    // Poll for updates if task is running or pending
    const interval = setInterval(fetchTask, 2000);
    return () => clearInterval(interval);
  }, [taskId, onStatusChange]);

  // Update elapsed time every second when running
  useEffect(() => {
    if (!task?.startedAt || task.status === 'COMPLETED' || task.status === 'FAILED' || task.status === 'CANCELLED') {
      setElapsedTime(formatDuration(task?.startedAt ?? null, task?.completedAt ?? null));
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(formatDuration(task.startedAt, null));
    }, 1000);

    return () => clearInterval(interval);
  }, [task?.startedAt, task?.completedAt, task?.status]);

  if (isLoading) {
    return (
      <div className={cn('bg-card border border-border rounded-lg p-4', className)}>
        <div className="text-muted-foreground text-sm">Loading task status...</div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className={cn('bg-card border border-border rounded-lg p-4', className)}>
        <div className="text-destructive text-sm">Error: {error || 'Task not found'}</div>
      </div>
    );
  }

  const config = statusConfig[task.status];
  const StatusIcon = config.icon;
  const progress = task.filesTotal > 0 ? (task.filesProcessed / task.filesTotal) * 100 : 0;

  return (
    <div className={cn('bg-card border border-border rounded-lg p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusIcon
            className={cn(
              'w-5 h-5',
              config.color,
              task.status === 'RUNNING' && 'animate-spin'
            )}
          />
          <span className={cn('font-medium', config.color)}>{config.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <CancelTaskButton
            taskId={taskId}
            taskStatus={task.status}
            onCancelled={() => {
              setTask(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
              onStatusChange?.('CANCELLED');
              onCancelled?.();
            }}
          />
          <div className="text-muted-foreground text-sm">
            <Clock className="w-4 h-4 inline mr-1" />
            {elapsedTime}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Files: {task.filesProcessed} / {task.filesTotal || '?'}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all duration-300', config.bgColor)}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-muted/50 rounded p-2">
          <div className="text-muted-foreground text-xs">Chunks</div>
          <div className="text-foreground font-medium">{task.chunksCreated}</div>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <div className="text-muted-foreground text-xs">Summaries</div>
          <div className="text-foreground font-medium">{task.summariesGenerated}</div>
        </div>
      </div>

      {/* Error message */}
      {task.errorMessage && (
        <div className="mt-3 p-2 bg-destructive/10 border border-destructive/50 rounded text-destructive text-sm">
          {task.errorMessage}
        </div>
      )}
    </div>
  );
}
