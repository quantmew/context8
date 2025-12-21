import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  const sourceId = searchParams.get('sourceId');
  const limit = parseInt(searchParams.get('limit') ?? '50');

  try {
    const tasks = await prisma.task.findMany({
      where: {
        ...(status ? { status: status as 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' } : {}),
        ...(sourceId ? { sourceId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Get source names for local sources
    const localSourceIds = Array.from(
      new Set(tasks.filter(t => t.sourceType === 'LOCAL').map(t => t.sourceId))
    );
    const localSources = await prisma.localSource.findMany({
      where: { id: { in: localSourceIds } },
      select: { id: true, name: true },
    });
    const sourceMap = new Map(localSources.map(s => [s.id, s.name]));

    const tasksWithSourceNames = tasks.map(t => ({
      id: t.id,
      sourceId: t.sourceId,
      sourceType: t.sourceType,
      sourceName: sourceMap.get(t.sourceId) ?? 'Unknown',
      taskType: t.taskType,
      status: t.status,
      triggeredBy: t.triggeredBy,
      filesTotal: t.filesTotal,
      filesProcessed: t.filesProcessed,
      chunksCreated: t.chunksCreated,
      summariesGenerated: t.summariesGenerated,
      startedAt: t.startedAt?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      errorMessage: t.errorMessage,
      createdAt: t.createdAt.toISOString(),
      latestLog: t.logs[0]?.message ?? null,
    }));

    return NextResponse.json({ tasks: tasksWithSourceNames });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}
