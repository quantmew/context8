'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface TaskLog {
  id: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  phase?: string | null;
  message: string;
  filePath?: string | null;
  createdAt: string;
}

interface LogViewerProps {
  taskId: string;
  isRunning?: boolean;
  className?: string;
  maxHeight?: string;
}

const levelColors: Record<string, string> = {
  DEBUG: 'text-muted-foreground',
  INFO: 'text-blue-500 dark:text-blue-400',
  WARN: 'text-yellow-600 dark:text-yellow-400',
  ERROR: 'text-red-500 dark:text-red-400',
};

const phaseColors: Record<string, string> = {
  collecting: 'text-purple-400',
  parsing: 'text-cyan-400',
  summarizing: 'text-green-400',
  embedding: 'text-orange-400',
  storing: 'text-pink-400',
  pending: 'text-gray-400',
  completed: 'text-green-500',
  failed: 'text-red-500',
};

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function LogViewer({ taskId, isRunning = false, className, maxHeight = '400px' }: LogViewerProps) {
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastLogTimeRef = useRef<string | null>(null);

  const fetchLogs = useCallback(async (since?: string) => {
    try {
      const url = since
        ? `/api/tasks/${taskId}/logs?since=${encodeURIComponent(since)}`
        : `/api/tasks/${taskId}/logs`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await response.json();

      if (since) {
        // Append new logs
        if (data.logs.length > 0) {
          setLogs(prev => [...prev, ...data.logs]);
          lastLogTimeRef.current = data.logs[data.logs.length - 1].createdAt;
        }
      } else {
        // Initial load
        setLogs(data.logs);
        if (data.logs.length > 0) {
          lastLogTimeRef.current = data.logs[data.logs.length - 1].createdAt;
        }
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  // Initial fetch
  useEffect(() => {
    setIsLoading(true);
    setLogs([]);
    lastLogTimeRef.current = null;
    fetchLogs();
  }, [taskId, fetchLogs]);

  // Polling for new logs when task is running
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (lastLogTimeRef.current) {
        fetchLogs(lastLogTimeRef.current);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, fetchLogs]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Detect manual scroll
  const handleScroll = () => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  if (isLoading && logs.length === 0) {
    return (
      <div className={cn('bg-card border border-border rounded-lg p-4', className)} style={{ maxHeight }}>
        <div className="text-muted-foreground text-sm">Loading logs...</div>
      </div>
    );
  }

  if (error && logs.length === 0) {
    return (
      <div className={cn('bg-card border border-border rounded-lg p-4', className)} style={{ maxHeight }}>
        <div className="text-destructive text-sm">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className={cn('bg-card border border-border rounded-lg overflow-hidden', className)}>
      <div className="flex items-center justify-between px-3 py-2 bg-muted border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-muted-foreground text-xs font-mono ml-2">Task Logs</span>
        </div>
        {isRunning && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-400 text-xs">Live</span>
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-auto font-mono text-sm"
        style={{ maxHeight }}
      >
        {logs.length === 0 ? (
          <div className="p-4 text-muted-foreground text-center">No logs yet</div>
        ) : (
          <div className="p-2">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-2 py-0.5 hover:bg-muted/50">
                <span className="text-muted-foreground shrink-0">{formatTime(log.createdAt)}</span>
                <span className={cn('shrink-0 w-12', levelColors[log.level] || 'text-muted-foreground')}>
                  [{log.level}]
                </span>
                {log.phase && (
                  <span className={cn('shrink-0', phaseColors[log.phase] || 'text-muted-foreground')}>
                    [{log.phase}]
                  </span>
                )}
                <span className="text-foreground break-all">{log.message}</span>
                {log.filePath && (
                  <span className="text-muted-foreground text-xs shrink-0 ml-auto">
                    {log.filePath}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
        >
          Scroll to bottom
        </button>
      )}
    </div>
  );
}
