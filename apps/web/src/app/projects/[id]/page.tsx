import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/projects/status-badge';
import { ProjectTabs } from '@/components/projects/project-tabs';
import { DeleteProjectButton } from '@/components/projects/delete-project-button';
import { formatDate, formatNumber } from '@/lib/utils';
import {
  Folder,
  FileCode,
  Layers,
  Clock,
  AlertCircle,
  FolderOpen,
  Search,
  BookOpen,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getProject(id: string) {
  const project = await prisma.localSource.findUnique({
    where: { id },
    include: {
      files: {
        orderBy: { filePath: 'asc' },
        take: 10,
      },
      _count: {
        select: {
          files: true,
          llmGenerations: true,
        },
      },
    },
  });

  return project;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  // Get language breakdown
  const languageStats = await prisma.fileMetadata.groupBy({
    by: ['language'],
    where: { sourceId: id },
    _count: { language: true },
    orderBy: { _count: { language: 'desc' } },
    take: 5,
  });

  // Get wiki structure for page count
  const wikiStructure = await prisma.wikiStructure.findUnique({
    where: {
      sourceId_sourceType: { sourceId: id, sourceType: 'LOCAL' },
    },
    include: {
      _count: { select: { pages: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Folder className="h-8 w-8 text-primary" />
            {project.name}
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{project.path}</p>
        </div>
        <StatusBadge status={project.indexingStatus as 'PENDING' | 'INDEXING' | 'READY' | 'ERROR'} />
      </div>

      {project.indexError && (
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-4 rounded-lg">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{project.indexError}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Files</CardTitle>
            <FileCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(project.fileCount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chunks</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(project.chunkCount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Snippets</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(project.snippetCount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Summaries</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(project.summaryCount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Indexed</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {project.lastIndexedAt ? formatDate(project.lastIndexedAt) : 'Never'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Section */}
      <ProjectTabs
        projectId={project.id}
        projectName={project.name}
        projectPath={project.path}
        indexingStatus={project.indexingStatus}
        snippetCount={project.snippetCount ?? 0}
        snippetStatus={project.snippetStatus ?? 'PENDING'}
        wikiPageCount={wikiStructure?._count.pages ?? 0}
        wikiStatus={project.wikiStatus ?? 'PENDING'}
        languageStats={languageStats}
        recentFiles={project.files}
      />

      <div className="flex gap-4">
        <Button asChild>
          <Link href={`/projects/${project.id}/files`}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Browse All Files
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/search?project=${project.id}`}>
            <Search className="mr-2 h-4 w-4" />
            Search This Project
          </Link>
        </Button>
        <div className="flex-1" />
        <DeleteProjectButton projectId={project.id} projectName={project.name} />
      </div>
    </div>
  );
}
