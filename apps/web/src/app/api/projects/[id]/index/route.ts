import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Trigger indexing for a project
 *
 * Note: This creates a PENDING task record. The actual indexing
 * should be handled by running the CLI or a background worker:
 *   context8 index --path /path/to/project
 *
 * For production, implement a job queue (e.g., BullMQ, Temporal).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const force = body.force ?? false;

    // Get the project
    const project = await prisma.localSource.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if already indexing
    if (project.indexingStatus === 'INDEXING') {
      // Find the running task
      const runningTask = await prisma.task.findFirst({
        where: {
          sourceId: id,
          status: 'RUNNING',
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(
        {
          error: 'Project is already being indexed',
          taskId: runningTask?.id,
        },
        { status: 409 }
      );
    }

    // Create a task record
    const task = await prisma.task.create({
      data: {
        sourceId: id,
        sourceType: 'LOCAL',
        taskType: force ? 'FULL_INDEX' : 'INCREMENTAL',
        triggeredBy: 'WEB',
        status: 'PENDING',
      },
    });

    // Update project status to pending
    await prisma.localSource.update({
      where: { id },
      data: {
        indexingStatus: 'PENDING',
        indexError: null,
      },
    });

    // Add initial log
    await prisma.taskLog.create({
      data: {
        taskId: task.id,
        level: 'INFO',
        message: `Indexing requested via Web UI (force=${force})`,
        phase: 'pending',
      },
    });

    return NextResponse.json({
      taskId: task.id,
      message: 'Task created. Run CLI to start indexing.',
      hint: `context8 index --path "${project.path}"${force ? ' --force' : ''}`,
      projectId: project.id,
      projectName: project.name,
    });
  } catch (error) {
    console.error('Error creating indexing task:', error);
    return NextResponse.json(
      { error: 'Failed to create indexing task', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
