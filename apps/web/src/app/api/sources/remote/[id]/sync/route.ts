import { NextRequest, NextResponse } from 'next/server';
import { remoteSourceRepository, taskRepository } from '@context8/database';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const source = await remoteSourceRepository.findById(id);

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Check if already indexing
    if (source.indexingStatus === 'INDEXING') {
      return NextResponse.json(
        { error: 'Source is already being indexed' },
        { status: 409 }
      );
    }

    // Create a new task for syncing
    const task = await taskRepository.create({
      sourceId: source.id,
      sourceType: 'REMOTE',
      taskType: source.lastClonedAt ? 'INCREMENTAL' : 'FULL_INDEX',
      triggeredBy: 'WEB',
    });

    // Update source status
    await remoteSourceRepository.updateIndexingStatus(id, 'PENDING');

    return NextResponse.json({
      task: {
        id: task.id,
        status: task.status,
        taskType: task.taskType,
      },
      message: 'Sync task created',
    });
  } catch (error) {
    console.error('Error triggering sync:', error);
    return NextResponse.json(
      { error: 'Failed to trigger sync' },
      { status: 500 }
    );
  }
}
