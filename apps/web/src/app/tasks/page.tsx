'use client';

import { useEffect, useState } from 'react';
import { TaskCard } from '@/components/tasks';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw } from 'lucide-react';

type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

interface Task {
  id: string;
  sourceId: string;
  sourceType: 'LOCAL' | 'REPOSITORY';
  sourceName: string;
  taskType: 'FULL_INDEX' | 'INCREMENTAL' | 'REINDEX';
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

type TabValue = 'all' | 'running' | 'completed' | 'failed';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>('all');

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/tasks?limit=100');
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      const data = await response.json();
      setTasks(data.tasks);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    // Poll for updates when there are running tasks
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredTasks = tasks.filter(task => {
    switch (activeTab) {
      case 'running':
        return task.status === 'RUNNING' || task.status === 'PENDING';
      case 'completed':
        return task.status === 'COMPLETED';
      case 'failed':
        return task.status === 'FAILED' || task.status === 'CANCELLED';
      default:
        return true;
    }
  });

  const runningCount = tasks.filter(t => t.status === 'RUNNING' || t.status === 'PENDING').length;
  const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;
  const failedCount = tasks.filter(t => t.status === 'FAILED' || t.status === 'CANCELLED').length;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground mt-1">Monitor indexing progress and history</p>
        </div>
        <button
          onClick={fetchTasks}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-muted-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="all">
            All ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="running">
            Running ({runningCount})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedCount})
          </TabsTrigger>
          <TabsTrigger value="failed">
            Failed ({failedCount})
          </TabsTrigger>
        </TabsList>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/50 rounded-lg text-destructive">
            Error: {error}
          </div>
        )}

        <TabsContent value={activeTab}>
          {isLoading && tasks.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No tasks found</p>
              <p className="text-sm mt-2">
                {activeTab === 'all'
                  ? 'Start by indexing a project from the CLI or Web UI'
                  : `No ${activeTab} tasks`}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
