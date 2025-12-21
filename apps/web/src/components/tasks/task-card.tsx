'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle, XCircle, Clock, AlertCircle, FileText, Layers, BookOpen } from 'lucide-react';
import { CancelTaskButton } from './cancel-task-button';

type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
type TaskType = 'FULL_INDEX' | 'INCREMENTAL' | 'REINDEX';

interface Task {
  id: string;
  sourceId: string;
  sourceType: 'LOCAL' | 'REPOSITORY';
  sourceName: string;
  taskType: TaskType;
  status: TaskStatus;
  triggeredBy: 'CLI' | 'WEB';
  filesTotal: number;
  filesProcessed: number;
  chunksCreated: number;
  summariesGenerated: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  latestLog: string | null;
}

interface TaskCardProps {
  task: Task;
  className?: string;
}

const statusConfig: Record<TaskStatus, { icon: typeof Loader2; color: string; bgColor: string; label: string }> = {
  PENDING: { icon: Clock, color: 'text-gray-400', bgColor: 'bg-gray-500/20', label: 'Pending' },
  RUNNING: { icon: Loader2, color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: 'Running' },
  COMPLETED: { icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Completed' },
  FAILED: { icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Failed' },
  CANCELLED: { icon: AlertCircle, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: 'Cancelled' },
};

const taskTypeLabels: Record<TaskType, string> = {
  FULL_INDEX: 'Full Index',
  INCREMENTAL: 'Incremental',
  REINDEX: 'Re-index',
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
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TaskCard({ task, className }: TaskCardProps) {
  const [localStatus, setLocalStatus] = useState<TaskStatus>(task.status);
  const config = statusConfig[localStatus];
  const StatusIcon = config.icon;
  const progress = task.filesTotal > 0 ? (task.filesProcessed / task.filesTotal) * 100 : 0;

  const handleCancelled = () => {
    setLocalStatus('CANCELLED');
  };

  return (
    <Link
      href={`/tasks/${task.id}`}
      className={cn(
        'block bg-card rounded-lg p-4 hover:bg-accent transition-colors border border-border hover:border-border/80',
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium text-foreground">{task.sourceName}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{taskTypeLabels[task.taskType]}</span>
            <span className="text-xs text-muted-foreground/50">|</span>
            <span className="text-xs text-muted-foreground">via {task.triggeredBy}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CancelTaskButton
            taskId={task.id}
            taskStatus={localStatus}
            onCancelled={handleCancelled}
            variant="ghost"
            size="sm"
            showLabel={false}
          />
          <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-full text-xs', config.bgColor, config.color)}>
            <StatusIcon className={cn('w-3.5 h-3.5', localStatus === 'RUNNING' && 'animate-spin')} />
            <span>{config.label}</span>
          </div>
        </div>
      </div>

      {/* Progress bar for running tasks */}
      {(localStatus === 'RUNNING' || localStatus === 'PENDING') && task.filesTotal > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{task.filesProcessed} / {task.filesTotal} files</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
        <div className="flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" />
          <span>{task.filesProcessed} files</span>
        </div>
        <div className="flex items-center gap-1">
          <Layers className="w-3.5 h-3.5" />
          <span>{task.chunksCreated} chunks</span>
        </div>
        <div className="flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5" />
          <span>{task.summariesGenerated} summaries</span>
        </div>
      </div>

      {/* Latest log */}
      {task.latestLog && (
        <div className="text-xs text-muted-foreground truncate bg-muted/50 rounded px-2 py-1 mb-2">
          {task.latestLog}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
        <span>{formatTime(task.createdAt)}</span>
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatDuration(task.startedAt, task.completedAt)}</span>
        </div>
      </div>
    </Link>
  );
}
