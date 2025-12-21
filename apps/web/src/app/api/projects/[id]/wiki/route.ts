import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readPageFromDisk } from '@/lib/wiki-files';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');

    // Verify project exists
    const project = await prisma.localSource.findUnique({
      where: { id },
      select: { id: true, name: true, wikiStatus: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get wiki structure with pages
    const wikiStructure = await prisma.wikiStructure.findUnique({
      where: {
        sourceId_sourceType: { sourceId: id, sourceType: 'LOCAL' },
      },
      include: {
        pages: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!wikiStructure) {
      return NextResponse.json({
        project: {
          id: project.id,
          name: project.name,
          wikiStatus: project.wikiStatus,
        },
        wiki: null,
      });
    }

    // If pageId is specified, return only that page
    if (pageId) {
      const page = wikiStructure.pages.find((p) => p.pageId === pageId);
      if (!page) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404 });
      }

      // Try to read content from disk, fall back to database
      const diskContent = await readPageFromDisk(id, pageId);
      const content = diskContent ?? page.content;

      return NextResponse.json({
        project: {
          id: project.id,
          name: project.name,
          wikiStatus: project.wikiStatus,
        },
        wiki: {
          structure: {
            id: wikiStructure.id,
            title: wikiStructure.title,
            description: wikiStructure.description,
            status: wikiStructure.status,
          },
          page: { ...page, content },
        },
      });
    }

    // Return full wiki structure with all pages (read content from disk)
    const pagesWithContent = await Promise.all(
      wikiStructure.pages.map(async (p) => {
        const diskContent = await readPageFromDisk(id, p.pageId);
        return {
          id: p.id,
          pageId: p.pageId,
          title: p.title,
          content: diskContent ?? p.content, // Fall back to database
          importance: p.importance,
          order: p.order,
          filePaths: p.filePaths,
          relatedPageIds: p.relatedPageIds,
          parentPageId: p.parentPageId,
          isSection: p.isSection,
        };
      })
    );

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        wikiStatus: project.wikiStatus,
      },
      wiki: {
        structure: {
          id: wikiStructure.id,
          title: wikiStructure.title,
          description: wikiStructure.description,
          status: wikiStructure.status,
        },
        pages: pagesWithContent,
      },
    });
  } catch (error) {
    console.error('Error fetching wiki:', error);
    return NextResponse.json({ error: 'Failed to fetch wiki' }, { status: 500 });
  }
}
