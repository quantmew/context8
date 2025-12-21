'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { LogViewer, TaskStatusBar } from '@/components/tasks';
import { ArrowLeft, ExternalLink } from 'lucide-react';

type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

interface TaskDetails {
  id: string;
  sourceId: string;
  sourceType: 'LOCAL' | 'REMOTE' | 'REPOSITORY';
  sourceName: string;
  sourceExists: boolean;
  taskType: 'FULL_INDEX' | 'INCREMENTAL' | 'REINDEX';
  status: TaskStatus;
  triggeredBy: 'CLI' | 'WEB';
  createdAt: string;
}

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;

  const [taskDetails, setTaskDetails] = useState<TaskDetails | null>(null);
  const [status, setStatus] = useState<TaskStatus>('PENDING');
  const isRunning = status === 'RUNNING' || status === 'PENDING';

  useEffect(() => {
    const fetchTaskDetails = async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}`);
        if (response.ok) {
          const task = await response.json();
          setTaskDetails(task);
        }
      } catch (err) {
        console.error('Error fetching task details:', err);
      }
    };

    fetchTaskDetails();
  }, [taskId]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tasks
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {taskDetails?.sourceName || 'Task Details'}
            </h1>
            {taskDetails && (
              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span>{taskDetails.taskType.replace('_', ' ')}</span>
                <span className="text-muted-foreground/50">|</span>
                <span>Triggered by {taskDetails.triggeredBy}</span>
                <span className="text-muted-foreground/50">|</span>
                <span>{new Date(taskDetails.createdAt).toLocaleString()}</span>
              </div>
            )}
          </div>

          {taskDetails && taskDetails.sourceExists && (
            <Link
              href={`/projects/${taskDetails.sourceId}`}
              className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-muted-foreground transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              View Project
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status bar on the left */}
        <div className="lg:col-span-1">
          <TaskStatusBar
            taskId={taskId}
            onStatusChange={setStatus}
          />
        </div>

        {/* Log viewer takes more space */}
        <div className="lg:col-span-2">
          <LogViewer
            taskId={taskId}
            isRunning={isRunning}
            maxHeight="500px"
          />
        </div>
      </div>
    </div>
  );
}
