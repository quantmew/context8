import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { FileList } from '@/components/files/file-list';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FolderOpen, ArrowLeft, Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}

async function getProjectWithFiles(id: string, search?: string) {
  const project = await prisma.localSource.findUnique({
    where: { id },
    select: { id: true, name: true, path: true },
  });

  if (!project) return null;

  const files = await prisma.fileMetadata.findMany({
    where: {
      sourceId: id,
      ...(search && {
        filePath: { contains: search, mode: 'insensitive' },
      }),
    },
    orderBy: { filePath: 'asc' },
  });

  return { project, files };
}

export default async function ProjectFilesPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { q } = await searchParams;
  const data = await getProjectWithFiles(id, q);

  if (!data) {
    notFound();
  }

  const { project, files } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/projects/${project.id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FolderOpen className="h-8 w-8 text-primary" />
            {project.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse {files.length} files
          </p>
        </div>
      </div>

      <form className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            name="q"
            placeholder="Filter files by name..."
            defaultValue={q}
            className="pl-10"
          />
        </div>
        <Button type="submit">Filter</Button>
        {q && (
          <Button asChild variant="ghost">
            <Link href={`/projects/${project.id}/files`}>Clear</Link>
          </Button>
        )}
      </form>

      <FileList files={files} projectId={project.id} />
    </div>
  );
}
