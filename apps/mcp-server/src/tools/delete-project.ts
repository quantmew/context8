import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Config } from '../config.js';
import {
  deleteService,
  localSourceRepository,
  remoteSourceRepository,
} from '@context8/database';
import { QdrantClient } from '@context8/vector-store';
import { parseLibraryId } from '../utils/library-id-parser.js';

interface DeleteProjectArgs {
  projectId: string;
  force?: boolean;
}

/**
 * delete-project tool implementation
 *
 * Deletes a project and all its related data including:
 * - Database records (source, files, snippets, wiki, tasks)
 * - Vector embeddings from Qdrant
 */
export async function deleteProjectTool(
  args: DeleteProjectArgs,
  _extra: unknown,
  config: Config
): Promise<CallToolResult> {
  const { projectId, force = false } = args;

  try {
    // Parse the project ID (could be /local/{uuid}, /remote/{owner}/{repo}, or raw UUID)
    let sourceId: string;
    let sourceType: 'LOCAL' | 'REMOTE';

    const parsed = parseLibraryId(projectId);
    if (parsed) {
      if (parsed.type === 'local') {
        sourceId = parsed.id;
        sourceType = 'LOCAL';
      } else {
        // Remote format: /{owner}/{repo} - need to find by URL pattern
        const remoteSource = await remoteSourceRepository.findByUrl(
          `https://github.com/${parsed.owner}/${parsed.repo}`
        );
        if (remoteSource) {
          sourceId = remoteSource.id;
          sourceType = 'REMOTE';
        } else {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: `Remote project not found: ${projectId}`,
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
    } else {
      // Raw UUID - try to find it in both tables
      const localSource = await localSourceRepository.findById(projectId);
      if (localSource) {
        sourceId = projectId;
        sourceType = 'LOCAL';
      } else {
        const remoteSource = await remoteSourceRepository.findById(projectId);
        if (remoteSource) {
          sourceId = projectId;
          sourceType = 'REMOTE';
        } else {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: `Project not found: ${projectId}`,
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
    }

    // Get source details for response
    const source =
      sourceType === 'LOCAL'
        ? await localSourceRepository.findById(sourceId)
        : await remoteSourceRepository.findById(sourceId);

    if (!source) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: `Project not found: ${sourceId}`,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Setup Qdrant client for vector deletion
    let host = config.qdrant.host;
    let https = false;
    if (host.startsWith('https://')) {
      host = host.replace('https://', '');
      https = true;
    } else if (host.startsWith('http://')) {
      host = host.replace('http://', '');
    }

    const qdrantClient = new QdrantClient(
      {
        host,
        port: config.qdrant.port,
        apiKey: config.qdrant.apiKey,
        https,
      },
      config.qdrant.collectionName
    );

    // Inject vector deletion function
    deleteService.setVectorDeleteFn(async (sid: string) => {
      await qdrantClient.deleteBySourceId(sid);
    });

    // Perform deletion
    const result = await deleteService.deleteProject({
      sourceId,
      sourceType,
      cancelRunningTasks: force,
    });

    const sourceName = 'name' in source ? source.name : 'fullName' in source ? source.fullName : sourceId;

    if (!result.success) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                projectId: sourceId,
                projectName: sourceName,
                sourceType,
                errors: result.errors,
                hint: result.errors.some((e) => e.includes('running'))
                  ? 'Use force=true to cancel running tasks and delete anyway.'
                  : undefined,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Successfully deleted project "${sourceName}"`,
              projectId: sourceId,
              projectName: sourceName,
              sourceType,
              deletedCounts: result.deletedCounts,
              warnings: result.errors.length > 0 ? result.errors : undefined,
            },
            null,
            2
          ),
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
              success: false,
              error: message,
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
