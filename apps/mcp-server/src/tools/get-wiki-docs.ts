import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Config } from '../config.js';
import { prisma, localSourceRepository } from '@context8/database';
import { parseLibraryId } from '../utils/library-id-parser.js';
import { readPageFromDisk } from '../utils/wiki-files.js';

interface GetWikiDocsArgs {
  context7CompatibleLibraryID: string;
  pageId?: string;
  includeContent?: boolean;
}

interface WikiPageOutput {
  id: string;
  pageId: string;
  title: string;
  importance: string;
  isSection: boolean;
  parentPageId?: string | null;
  order: number;
  content?: string;
  filePaths?: string[];
  relatedPageIds?: string[];
}

/**
 * get-wiki-docs tool implementation
 *
 * Fetches wiki documentation generated for a library.
 * Use context7CompatibleLibraryID from resolve-library-id.
 * Optionally specify pageId to get a specific page's content.
 */
export async function getWikiDocsTool(
  args: GetWikiDocsArgs,
  _extra: unknown,
  _config: Config
): Promise<CallToolResult> {
  const { context7CompatibleLibraryID, pageId, includeContent = true } = args;

  try {
    // Parse the library ID
    const parsed = parseLibraryId(context7CompatibleLibraryID);
    if (!parsed) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: 'Invalid library ID format',
                message: `Expected format: /local/{uuid} or /{owner}/{repo}. Got: ${context7CompatibleLibraryID}`,
                suggestion: 'Use resolve-library-id first to get a valid library ID',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Currently only support local sources
    if (parsed.type !== 'local') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: 'Remote sources not yet supported',
                message: 'Currently only local sources (/local/{uuid}) are supported.',
                libraryId: context7CompatibleLibraryID,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Verify the local source exists
    const source = await localSourceRepository.findById(parsed.id);
    if (!source) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: 'Library not found',
                message: `No library found with ID: ${parsed.id}`,
                suggestion: 'Use resolve-library-id to find the correct library ID',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Get wiki structure for this source
    const wikiStructure = await prisma.wikiStructure.findUnique({
      where: {
        sourceId_sourceType: { sourceId: source.id, sourceType: 'LOCAL' },
      },
      include: {
        pages: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!wikiStructure) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: 'Wiki not generated',
                message: `No wiki documentation has been generated for ${source.name}`,
                wikiStatus: source.wikiStatus,
                suggestion:
                  source.wikiStatus === 'GENERATING_STRUCTURE' ||
                  source.wikiStatus === 'GENERATING_PAGES'
                    ? 'Wiki generation is in progress. Please try again later.'
                    : 'Run wiki generation for this library first.',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Check wiki status
    if (wikiStructure.status !== 'READY') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: 'Wiki not ready',
                message: `Wiki is currently in ${wikiStructure.status} status`,
                suggestion:
                  wikiStructure.status === 'ERROR'
                    ? `Wiki generation failed: ${wikiStructure.errorMessage}`
                    : 'Wiki generation is in progress. Please try again later.',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // If specific page requested
    if (pageId) {
      const page = wikiStructure.pages.find((p) => p.pageId === pageId);
      if (!page) {
        const availablePages = wikiStructure.pages.map((p) => ({
          pageId: p.pageId,
          title: p.title,
        }));
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'Page not found',
                  message: `No wiki page found with ID: ${pageId}`,
                  availablePages,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      // Try to read content from disk, fall back to database
      const diskContent = await readPageFromDisk(source.id, pageId);
      const pageContent = diskContent ?? page.content;

      // Return single page with full content
      const output = {
        library: {
          id: context7CompatibleLibraryID,
          name: source.name,
          path: source.path,
        },
        wiki: {
          title: wikiStructure.title,
          description: wikiStructure.description,
        },
        page: {
          id: page.id,
          pageId: page.pageId,
          title: page.title,
          importance: page.importance,
          isSection: page.isSection,
          parentPageId: page.parentPageId,
          order: page.order,
          content: pageContent,
          filePaths: page.filePaths,
          relatedPageIds: page.relatedPageIds,
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(output, null, 2),
          },
        ],
      };
    }

    // Return wiki structure with optional content (read from disk)
    const pages: WikiPageOutput[] = await Promise.all(
      wikiStructure.pages.map(async (p) => {
        const baseOutput = {
          id: p.id,
          pageId: p.pageId,
          title: p.title,
          importance: p.importance,
          isSection: p.isSection,
          parentPageId: p.parentPageId,
          order: p.order,
        };

        if (includeContent) {
          const diskContent = await readPageFromDisk(source.id, p.pageId);
          return {
            ...baseOutput,
            content: diskContent ?? p.content, // Fall back to database
            filePaths: p.filePaths,
            relatedPageIds: p.relatedPageIds,
          };
        }

        return baseOutput;
      })
    );

    // Calculate stats
    const stats = {
      totalPages: pages.length,
      byImportance: {
        HIGH: pages.filter((p) => p.importance === 'HIGH').length,
        MEDIUM: pages.filter((p) => p.importance === 'MEDIUM').length,
        LOW: pages.filter((p) => p.importance === 'LOW').length,
      },
      sections: pages.filter((p) => p.isSection).length,
    };

    const output = {
      library: {
        id: context7CompatibleLibraryID,
        name: source.name,
        path: source.path,
      },
      wiki: {
        title: wikiStructure.title,
        description: wikiStructure.description,
        status: wikiStructure.status,
        stats,
      },
      pages,
      usage: {
        getSpecificPage: `Call get-wiki-docs with pageId parameter to get a specific page's full content`,
        example: `get-wiki-docs(context7CompatibleLibraryID="${context7CompatibleLibraryID}", pageId="${pages[0]?.pageId || 'getting-started'}")`,
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(output, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: 'Failed to fetch wiki documentation',
              message,
              libraryId: context7CompatibleLibraryID,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
