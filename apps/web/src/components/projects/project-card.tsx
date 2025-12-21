import Link from 'next/link';
import { Folder, FileCode, Layers, Clock } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './status-badge';
import { formatRelativeTime, formatNumber } from '@/lib/utils';

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    path: string;
    indexingStatus: 'PENDING' | 'INDEXING' | 'READY' | 'ERROR';
    fileCount: number;
    chunkCount: number;
    summaryCount: number;
    lastIndexedAt: Date | null;
    indexError: string | null;
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{project.name}</CardTitle>
          </div>
          <StatusBadge status={project.indexingStatus} />
        </div>
        <p className="text-xs text-muted-foreground truncate mt-1" title={project.path}>
          {project.path}
        </p>
      </CardHeader>
      <CardContent className="flex-1 pb-2">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="flex items-center gap-1.5">
            <FileCode className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Files:</span>
            <span className="font-medium">{formatNumber(project.fileCount)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Chunks:</span>
            <span className="font-medium">{formatNumber(project.chunkCount)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatRelativeTime(project.lastIndexedAt)}</span>
          </div>
        </div>
        {project.indexError && (
          <p className="mt-2 text-xs text-destructive truncate" title={project.indexError}>
            {project.indexError}
          </p>
        )}
      </CardContent>
      <CardFooter className="pt-2 gap-2">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <Link href={`/projects/${project.id}`}>View Details</Link>
        </Button>
        <Button asChild variant="secondary" size="sm" className="flex-1">
          <Link href={`/projects/${project.id}/files`}>Browse Files</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
