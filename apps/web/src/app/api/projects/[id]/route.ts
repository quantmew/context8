import { NextRequest, NextResponse } from 'next/server';
import {
  deleteService,
  localSourceRepository,
  remoteSourceRepository,
} from '@context8/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try local source first
    const localSource = await localSourceRepository.findById(id);
    if (localSource) {
      return NextResponse.json({
        project: {
          ...localSource,
          sourceType: 'LOCAL',
        },
      });
    }

    // Try remote source
    const remoteSource = await remoteSourceRepository.findById(id);
    if (remoteSource) {
      return NextResponse.json({
        project: {
          ...remoteSource,
          sourceType: 'REMOTE',
        },
      });
    }

    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    // Determine source type
    let sourceType: 'LOCAL' | 'REMOTE';
    let sourceName: string;

    const localSource = await localSourceRepository.findById(id);
    if (localSource) {
      sourceType = 'LOCAL';
      sourceName = localSource.name;
    } else {
      const remoteSource = await remoteSourceRepository.findById(id);
      if (remoteSource) {
        sourceType = 'REMOTE';
        sourceName = remoteSource.fullName;
      } else {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    // Use the delete service
    const result = await deleteService.deleteProject({
      sourceId: id,
      sourceType,
      cancelRunningTasks: force,
    });

    if (!result.success) {
      const hasRunningTasks = result.errors.some((e) => e.includes('running'));
      return NextResponse.json(
        {
          error: result.errors[0] || 'Failed to delete project',
          errors: result.errors,
          hint: hasRunningTasks
            ? 'Use force=true query parameter to cancel running tasks and delete anyway.'
            : undefined,
        },
        { status: hasRunningTasks ? 409 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted project "${sourceName}"`,
      deletedCounts: result.deletedCounts,
      warnings: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
