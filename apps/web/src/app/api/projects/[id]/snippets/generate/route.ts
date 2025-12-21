import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify project exists
    const project = await prisma.localSource.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        indexingStatus: true,
        snippetStatus: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if project is indexed
    if (project.indexingStatus !== 'READY') {
      return NextResponse.json(
        { error: 'Project must be indexed first before generating snippets' },
        { status: 400 }
      );
    }

    // Check if already generating
    if (project.snippetStatus === 'GENERATING') {
      return NextResponse.json(
        { error: 'Snippet generation is already in progress' },
        { status: 400 }
      );
    }

    // Create SNIPPET_GENERATE task
    const task = await prisma.task.create({
      data: {
        sourceId: id,
        sourceType: 'LOCAL',
        taskType: 'SNIPPET_GENERATE',
        triggeredBy: 'WEB',
        status: 'PENDING',
      },
    });

    // Update snippetStatus to PENDING
    await prisma.localSource.update({
      where: { id },
      data: { snippetStatus: 'PENDING' },
    });

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        taskType: task.taskType,
        status: task.status,
      },
      message: 'Snippet generation task created',
    });
  } catch (error) {
    console.error('Error creating snippet generation task:', error);
    return NextResponse.json(
      { error: 'Failed to create snippet generation task' },
      { status: 500 }
    );
  }
}
