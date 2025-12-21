import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Reset source status when stuck in a generating state after task cancellation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Find the source
    const source = await prisma.localSource.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        wikiStatus: true,
        snippetStatus: true,
        indexingStatus: true,
      },
    });

    if (!source) {
      // Try remote source
      const remoteSource = await prisma.remoteSource.findUnique({
        where: { id },
        select: {
          id: true,
          fullName: true,
          wikiStatus: true,
          snippetStatus: true,
          indexingStatus: true,
        },
      });

      if (!remoteSource) {
        return NextResponse.json({ error: 'Source not found' }, { status: 404 });
      }

      // Check if there are any running tasks for this source
      const runningTasks = await prisma.task.findFirst({
        where: {
          sourceId: id,
          status: { in: ['RUNNING', 'PENDING'] },
        },
      });

      if (runningTasks) {
        return NextResponse.json(
          { error: 'Cannot reset status while tasks are still running' },
          { status: 400 }
        );
      }

      // Reset stuck statuses
      const updates: Record<string, string> = {};
      if (remoteSource.wikiStatus === 'GENERATING_STRUCTURE' || remoteSource.wikiStatus === 'GENERATING_PAGES') {
        updates.wikiStatus = 'PENDING';
      }
      if (remoteSource.snippetStatus === 'GENERATING') {
        updates.snippetStatus = 'PENDING';
      }
      if (remoteSource.indexingStatus === 'INDEXING') {
        updates.indexingStatus = 'PENDING';
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ message: 'No stuck statuses found', source: remoteSource });
      }

      const updated = await prisma.remoteSource.update({
        where: { id },
        data: updates,
      });

      return NextResponse.json({
        message: 'Status reset successfully',
        previousStatus: {
          wikiStatus: remoteSource.wikiStatus,
          snippetStatus: remoteSource.snippetStatus,
          indexingStatus: remoteSource.indexingStatus,
        },
        currentStatus: {
          wikiStatus: updated.wikiStatus,
          snippetStatus: updated.snippetStatus,
          indexingStatus: updated.indexingStatus,
        },
      });
    }

    // Check if there are any running tasks for this source
    const runningTasks = await prisma.task.findFirst({
      where: {
        sourceId: id,
        status: { in: ['RUNNING', 'PENDING'] },
      },
    });

    if (runningTasks) {
      return NextResponse.json(
        { error: 'Cannot reset status while tasks are still running' },
        { status: 400 }
      );
    }

    // Reset stuck statuses
    const updates: Record<string, string | null> = {};
    if (source.wikiStatus === 'GENERATING_STRUCTURE' || source.wikiStatus === 'GENERATING_PAGES') {
      updates.wikiStatus = 'PENDING';
    }
    if (source.snippetStatus === 'GENERATING') {
      updates.snippetStatus = 'PENDING';
    }
    if (source.indexingStatus === 'INDEXING') {
      updates.indexingStatus = 'PENDING';
      updates.indexError = null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'No stuck statuses found', source });
    }

    const updated = await prisma.localSource.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({
      message: 'Status reset successfully',
      previousStatus: {
        wikiStatus: source.wikiStatus,
        snippetStatus: source.snippetStatus,
        indexingStatus: source.indexingStatus,
      },
      currentStatus: {
        wikiStatus: updated.wikiStatus,
        snippetStatus: updated.snippetStatus,
        indexingStatus: updated.indexingStatus,
      },
    });
  } catch (error) {
    console.error('Failed to reset status:', error);
    return NextResponse.json(
      { error: 'Failed to reset status' },
      { status: 500 }
    );
  }
}
