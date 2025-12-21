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
        wikiStatus: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if project is indexed
    if (project.indexingStatus !== 'READY') {
      return NextResponse.json(
        { error: 'Project must be indexed first before generating wiki' },
        { status: 400 }
      );
    }

    // Check if already generating
    if (
      project.wikiStatus === 'GENERATING_STRUCTURE' ||
      project.wikiStatus === 'GENERATING_PAGES'
    ) {
      return NextResponse.json(
        { error: 'Wiki generation is already in progress' },
        { status: 400 }
      );
    }

    // Create WIKI_GENERATE task
    const task = await prisma.task.create({
      data: {
        sourceId: id,
        sourceType: 'LOCAL',
        taskType: 'WIKI_GENERATE',
        triggeredBy: 'WEB',
        status: 'PENDING',
      },
    });

    // Update wikiStatus to PENDING
    await prisma.localSource.update({
      where: { id },
      data: { wikiStatus: 'PENDING' },
    });

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        taskType: task.taskType,
        status: task.status,
      },
      message: 'Wiki generation task created',
    });
  } catch (error) {
    console.error('Error creating wiki generation task:', error);
    return NextResponse.json(
      { error: 'Failed to create wiki generation task' },
      { status: 500 }
    );
  }
}
