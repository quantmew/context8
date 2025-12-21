import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const indexingProjects = await prisma.localSource.findMany({
      where: { indexingStatus: 'INDEXING' },
      select: {
        id: true,
        name: true,
        indexingStatus: true,
      },
    });

    return NextResponse.json({
      indexingProjects: indexingProjects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.indexingStatus,
      })),
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
