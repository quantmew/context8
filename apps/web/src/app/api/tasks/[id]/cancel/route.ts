import { NextRequest, NextResponse } from 'next/server';
import { taskRepository } from '@context8/database';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Get current task status
    const task = await taskRepository.findById(id);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Only allow cancelling pending or running tasks
    if (task.status !== 'PENDING' && task.status !== 'RUNNING') {
      return NextResponse.json(
        { error: `Cannot cancel task with status: ${task.status}` },
        { status: 400 }
      );
    }

    // Cancel the task
    const cancelledTask = await taskRepository.cancel(id);

    // Add log entry
    await taskRepository.addLog(id, {
      level: 'INFO',
      message: 'Task cancellation requested by user',
      phase: 'cancelled',
    });

    return NextResponse.json({
      success: true,
      task: {
        id: cancelledTask.id,
        status: cancelledTask.status,
      },
    });
  } catch (error) {
    console.error('Error cancelling task:', error);
    return NextResponse.json(
      { error: 'Failed to cancel task' },
      { status: 500 }
    );
  }
}
