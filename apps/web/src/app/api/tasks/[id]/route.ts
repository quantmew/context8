import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Get source info
    let sourceName = 'Unknown';
    let sourceExists = false;

    if (task.sourceType === 'LOCAL') {
      const source = await prisma.localSource.findUnique({
        where: { id: task.sourceId },
        select: { id: true, name: true },
      });
      if (source) {
        sourceName = source.name;
        sourceExists = true;
      } else {
        sourceName = 'Deleted Project';
      }
    } else if (task.sourceType === 'REMOTE') {
      const source = await prisma.remoteSource.findUnique({
        where: { id: task.sourceId },
        select: { id: true, fullName: true },
      });
      if (source) {
        sourceName = source.fullName;
        sourceExists = true;
      } else {
        sourceName = 'Deleted Source';
      }
    }

    return NextResponse.json({
      id: task.id,
      sourceId: task.sourceId,
      sourceType: task.sourceType,
      sourceName,
      sourceExists,
      taskType: task.taskType,
      status: task.status,
      triggeredBy: task.triggeredBy,
      filesTotal: task.filesTotal,
      filesProcessed: task.filesProcessed,
      chunksCreated: task.chunksCreated,
      summariesGenerated: task.summariesGenerated,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      errorMessage: task.errorMessage,
      createdAt: task.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}
