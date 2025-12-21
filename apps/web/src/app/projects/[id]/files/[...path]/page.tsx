import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { qdrantClient } from '@/lib/qdrant';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChunkCard } from '@/components/chunks/chunk-card';
import { formatDate, getLanguageColor, formatNumber } from '@/lib/utils';
import { FileCode, ArrowLeft, Layers, Clock, HardDrive } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string; path: string[] }>;
}

async function getFileWithChunks(projectId: string, filePath: string) {
  // Get file metadata
  const file = await prisma.fileMetadata.findFirst({
    where: {
      sourceId: projectId,
      filePath: filePath,
    },
    include: {
      source: {
        select: { id: true, name: true },
      },
    },
  });

  if (!file) return null;

  // Get chunks from Qdrant
  let chunks: Array<{
    id: string | number;
    payload: Record<string, unknown>;
    score: number;
  }> = [];

  try {
    // Use scroll to get all chunks for this file
    const scrollResult = await qdrantClient.scroll({
      filter: {
        must: [
          { key: 'source_id', match: { value: projectId } },
          { key: 'file_path', match: { value: filePath } },
        ],
      },
      limit: 100,
      withPayload: true,
    });
    chunks = scrollResult.points.map((p) => ({
      id: p.id,
      payload: p.payload as Record<string, unknown>,
      score: 1,
    }));
  } catch (error) {
    console.error('Error fetching chunks from Qdrant:', error);
  }

  // Get LLM summaries for these chunks
  const chunkIds = chunks.map((c) => String(c.id));
  const summaries = await prisma.lLMGeneration.findMany({
    where: {
      sourceId: projectId,
      chunkId: { in: chunkIds },
      generationType: 'SUMMARY',
    },
  });

  const summaryMap = new Map(
    summaries.map((s) => {
      let parsed: { summary?: string; keywords?: string[] } = {};
      try {
        parsed = JSON.parse(s.output);
      } catch {
        parsed = { summary: s.output, keywords: [] };
      }
      return [
        s.chunkId,
        {
          text: parsed.summary ?? s.output,
          keywords: parsed.keywords ?? [],
        },
      ];
    })
  );

  return {
    file,
    project: file.source,
    chunks: chunks
      .map((c) => ({
        id: String(c.id),
        chunkType: (c.payload.chunk_type as string) ?? 'code',
        symbolName: c.payload.symbol_name as string | null,
        startLine: (c.payload.start_line as number) ?? 1,
        endLine: (c.payload.end_line as number) ?? 1,
        content: (c.payload.content as string) ?? '',
        language: (c.payload.language as string) ?? file.language ?? 'text',
        summary: summaryMap.get(String(c.id)) ?? null,
      }))
      .sort((a, b) => a.startLine - b.startLine),
  };
}

export default async function FileDetailPage({ params }: PageProps) {
  const { id, path } = await params;
  const filePath = path.join('/');
  const data = await getFileWithChunks(id, filePath);

  if (!data) {
    notFound();
  }

  const { file, project, chunks } = data;
  const summaryCount = chunks.filter((c) => c.summary).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/projects/${project.id}/files`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 truncate">
            <FileCode className="h-6 w-6 text-primary flex-shrink-0" />
            <span className="font-mono truncate" title={file.filePath}>
              {file.filePath}
            </span>
          </h1>
          <p className="text-muted-foreground mt-1">
            {project.name}
          </p>
        </div>
        {file.language && (
          <Badge
            variant="outline"
            className="text-base"
            style={{
              borderColor: getLanguageColor(file.language),
              color: getLanguageColor(file.language),
            }}
          >
            {file.language}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Chunks:</span>
          <span className="font-medium">{formatNumber(file.chunkCount)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Summaries:</span>
          <span className="font-medium">{summaryCount}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <HardDrive className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Size:</span>
          <span className="font-medium">{formatNumber(file.size)} bytes</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Indexed:</span>
          <span className="font-medium">{formatDate(file.lastIndexed)}</span>
        </div>
      </div>

      {chunks.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Code Chunks ({chunks.length})
          </h2>
          {chunks.map((chunk) => (
            <ChunkCard key={chunk.id} chunk={chunk} summary={chunk.summary} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">No chunks found for this file</p>
          <p className="text-muted-foreground text-sm mt-2">
            The file may not have been fully indexed yet
          </p>
        </div>
      )}
    </div>
  );
}
