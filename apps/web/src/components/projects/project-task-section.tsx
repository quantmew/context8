'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogViewer, TaskStatusBar, CancelTaskButton } from '@/components/tasks';
import { RefreshCw, Play, ExternalLink, Loader2, BookOpen, BookText } from 'lucide-react';

type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

interface Task {
  id: string;
  status: TaskStatus;
  taskType: string;
  createdAt: string;
}

interface ProjectTaskSectionProps {
  projectId: string;
  projectName: string;
  projectPath: string;
  indexingStatus: string;
  snippetStatus: string;
  wikiStatus: string;
}

export function ProjectTaskSection({
  projectId,
  projectName,
  projectPath,
  indexingStatus,
  snippetStatus,
  wikiStatus,
}: ProjectTaskSectionProps) {
  const router = useRouter();
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isGeneratingSnippets, setIsGeneratingSnippets] = useState(false);
  const [isGeneratingWiki, setIsGeneratingWiki] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);

  // Fetch the latest task for this project
  const fetchLatestTask = useCallback(async () => {
    try {
      const response = await fetch(`/api/tasks?sourceId=${projectId}&limit=1`);
      if (response.ok) {
        const data = await response.json();
        if (data.tasks.length > 0) {
          setCurrentTask(data.tasks[0]);
          setTaskStatus(data.tasks[0].status);
        }
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  }, [projectId]);

  useEffect(() => {
    fetchLatestTask();
  }, [fetchLatestTask]);

  // Poll when task is running
  useEffect(() => {
    if (taskStatus === 'RUNNING' || taskStatus === 'PENDING') {
      const interval = setInterval(fetchLatestTask, 5000);
      return () => clearInterval(interval);
    }
  }, [taskStatus, fetchLatestTask]);

  const triggerIndex = async (force: boolean = false) => {
    setIsTriggering(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger indexing');
      }

      // Set the new task
      setCurrentTask({
        id: data.taskId,
        status: 'PENDING',
        taskType: force ? 'FULL_INDEX' : 'INCREMENTAL',
        createdAt: new Date().toISOString(),
      });
      setTaskStatus('PENDING');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsTriggering(false);
    }
  };

  const triggerSnippetGeneration = async () => {
    setIsGeneratingSnippets(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/snippets/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger snippet generation');
      }

      // Set the new task
      setCurrentTask({
        id: data.task.id,
        status: 'PENDING',
        taskType: 'SNIPPET_GENERATE',
        createdAt: new Date().toISOString(),
      });
      setTaskStatus('PENDING');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGeneratingSnippets(false);
    }
  };

  const triggerWikiGeneration = async () => {
    setIsGeneratingWiki(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/wiki/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger wiki generation');
      }

      // Set the new task
      setCurrentTask({
        id: data.task.id,
        status: 'PENDING',
        taskType: 'WIKI_GENERATE',
        createdAt: new Date().toISOString(),
      });
      setTaskStatus('PENDING');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGeneratingWiki(false);
    }
  };

  const isWikiGenerating =
    wikiStatus === 'GENERATING_STRUCTURE' || wikiStatus === 'GENERATING_PAGES';

  const isActive = taskStatus === 'RUNNING' || taskStatus === 'PENDING';
  const showTaskStatus = currentTask && (isActive || taskStatus === 'COMPLETED' || taskStatus === 'FAILED');

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => triggerIndex(false)}
          disabled={isTriggering || isActive}
        >
          {isTriggering ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          {isActive ? 'Indexing...' : 'Index Project'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => triggerIndex(true)}
          disabled={isTriggering || isActive}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Force Re-index
        </Button>
        <Button
          variant="outline"
          onClick={triggerSnippetGeneration}
          disabled={isGeneratingSnippets || isActive || indexingStatus !== 'READY' || snippetStatus === 'GENERATING'}
        >
          {isGeneratingSnippets || snippetStatus === 'GENERATING' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <BookOpen className="mr-2 h-4 w-4" />
          )}
          {snippetStatus === 'GENERATING' ? 'Generating...' : 'Generate Snippets'}
        </Button>
        <Button
          variant="outline"
          onClick={triggerWikiGeneration}
          disabled={isGeneratingWiki || isActive || indexingStatus !== 'READY' || isWikiGenerating}
        >
          {isGeneratingWiki || isWikiGenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <BookText className="mr-2 h-4 w-4" />
          )}
          {isWikiGenerating ? 'Generating Wiki...' : 'Generate Wiki'}
        </Button>
        {currentTask && isActive && (
          <CancelTaskButton
            taskId={currentTask.id}
            taskStatus={taskStatus || 'PENDING'}
            onCancelled={() => {
              setTaskStatus('CANCELLED');
              fetchLatestTask();
              // Refresh the page to get updated source status (e.g., wikiStatus, snippetStatus)
              router.refresh();
            }}
          />
        )}
        {currentTask && (
          <Button variant="outline" asChild>
            <Link href={`/tasks/${currentTask.id}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              View Task
            </Link>
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Task status hint */}
      {currentTask && !isActive && indexingStatus === 'PENDING' && (
        <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg text-yellow-300 text-sm">
          <p>Task created but not started. Run the CLI to start indexing:</p>
          <code className="block mt-2 bg-gray-900 p-2 rounded text-xs">
            context8 index --path &quot;{projectPath}&quot;
          </code>
        </div>
      )}

      {/* Task progress display */}
      {showTaskStatus && currentTask && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>
                {isActive ? 'Indexing in Progress' : taskStatus === 'COMPLETED' ? 'Last Indexing' : 'Last Task'}
              </span>
              <Link
                href={`/tasks/${currentTask.id}`}
                className="text-sm text-blue-400 hover:text-blue-300 font-normal"
              >
                View Details
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TaskStatusBar
              taskId={currentTask.id}
              onStatusChange={setTaskStatus}
              onCancelled={() => {
                // Refresh the page to get updated source status (e.g., wikiStatus, snippetStatus)
                router.refresh();
              }}
            />
            {isActive && (
              <LogViewer
                taskId={currentTask.id}
                isRunning={isActive}
                maxHeight="300px"
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
