'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Folder, Loader2, CheckCircle, AlertCircle, Clock, Trash2 } from 'lucide-react';
import { formatRelativeTime, formatNumber, cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { DeleteProjectDialog } from '@/components/projects/delete-project-dialog';

export interface Project {
  id: string;
  name: string;
  path: string;
  indexingStatus: 'PENDING' | 'INDEXING' | 'READY' | 'ERROR';
  fileCount: number;
  chunkCount: number;
  summaryCount: number;
  lastIndexedAt: string | Date | null;
  searchCount: number;
  indexError: string | null;
}

interface ProjectTableProps {
  projects: Project[];
  isLoading?: boolean;
  onProjectDeleted?: () => void;
}

const statusIcons: Record<Project['indexingStatus'], React.ReactNode> = {
  PENDING: <Clock className="h-4 w-4 text-muted-foreground" />,
  INDEXING: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  READY: <CheckCircle className="h-4 w-4 text-green-500" />,
  ERROR: <AlertCircle className="h-4 w-4 text-red-500" />,
};

function ProjectTableRow({
  project,
  onDelete,
}: {
  project: Project;
  onDelete: (project: Project) => void;
}) {
  const router = useRouter();

  return (
    <tr
      className="hover:bg-muted/50 cursor-pointer transition-colors border-b border-border last:border-b-0"
      onClick={() => router.push(`/projects/${project.id}`)}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-primary hover:underline">
            {project.name}
          </span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="text-sm text-muted-foreground truncate max-w-[200px] inline-block" title={project.path}>
          {project.path}
        </span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="text-sm">{formatNumber(project.chunkCount)}</span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="text-sm">{formatNumber(project.fileCount)}</span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="text-sm text-muted-foreground">
          {formatRelativeTime(project.lastIndexedAt)}
        </span>
      </td>
      <td className="py-3 px-4 text-center">
        <div className="flex justify-center" title={project.indexingStatus}>
          {statusIcons[project.indexingStatus]}
        </div>
      </td>
      <td className="py-3 px-4 text-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(project);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          <td className="py-3 px-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
            </div>
          </td>
          <td className="py-3 px-4">
            <Skeleton className="h-4 w-32" />
          </td>
          <td className="py-3 px-4 text-center">
            <Skeleton className="h-4 w-8 mx-auto" />
          </td>
          <td className="py-3 px-4 text-center">
            <Skeleton className="h-4 w-8 mx-auto" />
          </td>
          <td className="py-3 px-4 text-center">
            <Skeleton className="h-4 w-16 mx-auto" />
          </td>
          <td className="py-3 px-4 text-center">
            <Skeleton className="h-4 w-4 mx-auto" />
          </td>
          <td className="py-3 px-4 text-center">
            <Skeleton className="h-8 w-8 mx-auto" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function ProjectTable({ projects, isLoading, onProjectDeleted }: ProjectTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  if (!isLoading && projects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No projects indexed yet</p>
        <p className="text-sm mt-1">
          Use the CLI to index your first project: <code className="bg-muted px-2 py-1 rounded">context8 index --path /your/project</code>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr className="text-left text-sm text-muted-foreground">
              <th className="py-3 px-4 font-medium">Name</th>
              <th className="py-3 px-4 font-medium">Source</th>
              <th className="py-3 px-4 font-medium text-center">Chunks</th>
              <th className="py-3 px-4 font-medium text-center">Files</th>
              <th className="py-3 px-4 font-medium text-center">Updated</th>
              <th className="py-3 px-4 font-medium text-center">Status</th>
              <th className="py-3 px-4 font-medium text-center w-16"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton />
            ) : (
              projects.map((project) => (
                <ProjectTableRow
                  key={project.id}
                  project={project}
                  onDelete={setDeleteTarget}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <DeleteProjectDialog
        open={deleteTarget !== null}
        projectId={deleteTarget?.id ?? ''}
        projectName={deleteTarget?.name ?? ''}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null);
          onProjectDeleted?.();
        }}
      />
    </>
  );
}
