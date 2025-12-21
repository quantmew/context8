import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tab = searchParams.get('tab') ?? 'recent';
    const search = searchParams.get('search') ?? '';
    const limit = parseInt(searchParams.get('limit') ?? '50');

    // Build where clause for search filter
    const whereClause = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { path: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // Determine sort order based on tab
    type OrderBy = { updatedAt?: 'desc'; searchCount?: 'desc'; name?: 'asc' };
    const orderBy: OrderBy = (() => {
      switch (tab) {
        case 'popular':
          return { searchCount: 'desc' as const };
        case 'all':
          return { name: 'asc' as const };
        case 'recent':
        default:
          return { updatedAt: 'desc' as const };
      }
    })();

    const projects = await prisma.localSource.findMany({
      where: whereClause,
      orderBy,
      take: limit,
    });

    // Get running tasks count for "tasks in progress" link
    const runningTasksCount = await prisma.task.count({
      where: { status: { in: ['PENDING', 'RUNNING'] } },
    });

    // Get total project count
    const totalCount = await prisma.localSource.count();

    return NextResponse.json({
      projects,
      totalCount,
      runningTasksCount,
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
