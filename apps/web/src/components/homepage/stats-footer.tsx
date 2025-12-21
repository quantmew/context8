'use client';

import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StatsFooterProps {
  totalProjects: number;
  runningTasks: number;
  onAddRemote?: () => void;
}

export function StatsFooter({ totalProjects, runningTasks, onAddRemote }: StatsFooterProps) {
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t border-border">
      <div className="flex items-center gap-4">
        <span>
          {totalProjects} {totalProjects === 1 ? 'library' : 'libraries'}
        </span>
        {onAddRemote && (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onAddRemote}>
            <Plus className="h-3 w-3" />
            Add Remote Repository
          </Button>
        )}
      </div>
      {runningTasks > 0 && (
        <Link
          href="/tasks"
          className="flex items-center gap-1 text-primary hover:underline"
        >
          SEE TASKS IN PROGRESS ({runningTasks})
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
