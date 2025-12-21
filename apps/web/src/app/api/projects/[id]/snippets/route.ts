import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    // Verify project exists
    const project = await prisma.localSource.findUnique({
      where: { id },
      select: { id: true, name: true, snippetCount: true, snippetStatus: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Build where clause
    const where: Record<string, unknown> = { sourceId: id };
    if (category && category !== 'all') {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { keywords: { hasSome: [search.toLowerCase()] } },
      ];
    }

    // Get snippets
    const snippets = await prisma.snippet.findMany({
      where,
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    });

    // Calculate total tokens
    const totalTokens = snippets.reduce((sum, s) => sum + s.tokenCount, 0);

    // Format as llms.txt
    const llmsTxt = snippets
      .map((s) => {
        const source = s.sourceUrl || s.sourceFilePath;
        return `### ${s.title}
Source: ${source}
${s.description}
\`\`\`${s.language}
${s.content}
\`\`\`
--------------------------------`;
      })
      .join('\n\n');

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        snippetCount: project.snippetCount,
        snippetStatus: project.snippetStatus,
      },
      snippets,
      totalTokens,
      llmsTxt,
    });
  } catch (error) {
    console.error('Error fetching snippets:', error);
    return NextResponse.json({ error: 'Failed to fetch snippets' }, { status: 500 });
  }
}
