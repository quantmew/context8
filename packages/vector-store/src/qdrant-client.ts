import { QdrantClient as BaseQdrantClient } from '@qdrant/js-client-rest';
import type {
  QdrantConfig,
  SearchOptions,
  SearchResult,
  UpsertPoint,
  SparseVector,
  CodeChunkPayload,
} from './types.js';

/**
 * Qdrant client wrapper for Context8
 */
export class QdrantClient {
  private client: BaseQdrantClient;
  private collectionName: string;

  constructor(config: QdrantConfig, collectionName: string = 'codebase_v1') {
    this.client = new BaseQdrantClient({
      host: config.host,
      port: config.port,
      apiKey: config.apiKey,
      https: config.https,
    });
    this.collectionName = collectionName;
  }

  /**
   * Get the underlying Qdrant client
   */
  getClient(): BaseQdrantClient {
    return this.client;
  }

  /**
   * Check if collection exists
   */
  async collectionExists(): Promise<boolean> {
    try {
      const response = await this.client.collectionExists(this.collectionName);
      return response.exists;
    } catch {
      return false;
    }
  }

  /**
   * Upsert vectors with payloads
   */
  async upsert(points: UpsertPoint[]): Promise<void> {
    const batchSize = 100;

    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);

      await this.client.upsert(this.collectionName, {
        points: batch.map((p) => ({
          id: p.id,
          // Use named vectors format for Qdrant collection with named vector config
          vector: p.vector.sparse
            ? {
                dense: p.vector.dense,
                sparse: {
                  indices: p.vector.sparse.indices,
                  values: p.vector.sparse.values,
                },
              }
            : {
                dense: p.vector.dense,
              },
          payload: p.payload as unknown as Record<string, unknown>,
        })),
        wait: true,
      });
    }
  }

  /**
   * Dense vector search
   */
  async searchDense(
    vector: number[],
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const response = await this.client.search(this.collectionName, {
      vector: {
        name: 'dense',
        vector,
      },
      limit: options.limit,
      filter: options.filter,
      with_payload: options.includePayload ?? true,
      score_threshold: options.scoreThreshold,
    });

    return response.map((r) => ({
      id: r.id as string,
      score: r.score,
      payload: r.payload as unknown as CodeChunkPayload,
    }));
  }

  /**
   * Hybrid search with RRF fusion
   */
  async searchHybrid(
    denseVector: number[],
    sparseVector: SparseVector,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const response = await this.client.query(this.collectionName, {
      prefetch: [
        {
          query: {
            values: sparseVector.values,
            indices: sparseVector.indices,
          },
          using: 'sparse',
          limit: options.limit * 2,
          filter: options.filter,
        },
        {
          query: denseVector,
          using: 'dense',
          limit: options.limit * 2,
          filter: options.filter,
        },
      ],
      query: {
        fusion: 'rrf',
      },
      limit: options.limit,
      with_payload: options.includePayload ?? true,
    });

    return response.points.map((p) => ({
      id: p.id as string,
      score: p.score ?? 0,
      payload: p.payload as unknown as CodeChunkPayload,
    }));
  }

  /**
   * Delete points by repository ID
   */
  async deleteByRepoId(repoId: string): Promise<void> {
    await this.client.delete(this.collectionName, {
      filter: {
        must: [{ key: 'repo_id', match: { value: repoId } }],
      },
      wait: true,
    });
  }

  /**
   * Delete points by source ID (IVectorStore interface)
   */
  async deleteBySourceId(sourceId: string): Promise<void> {
    await this.client.delete(this.collectionName, {
      filter: {
        must: [{ key: 'source_id', match: { value: sourceId } }],
      },
      wait: true,
    });
  }

  /**
   * Delete points by file paths (IVectorStore interface)
   */
  async deleteByFilePaths(sourceId: string, filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      await this.client.delete(this.collectionName, {
        filter: {
          must: [
            { key: 'source_id', match: { value: sourceId } },
            { key: 'file_path', match: { value: filePath } },
          ],
        },
        wait: true,
      });
    }
  }

  /**
   * Delete points by file path within a repository
   */
  async deleteByFilePath(repoId: string, filePath: string): Promise<void> {
    await this.client.delete(this.collectionName, {
      filter: {
        must: [
          { key: 'repo_id', match: { value: repoId } },
          { key: 'file_path', match: { value: filePath } },
        ],
      },
      wait: true,
    });
  }

  /**
   * Delete points by IDs
   */
  async deleteByIds(ids: string[]): Promise<void> {
    await this.client.delete(this.collectionName, {
      points: ids,
      wait: true,
    });
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(): Promise<{
    pointsCount: number;
    segmentsCount: number;
    status: string;
  }> {
    const info = await this.client.getCollection(this.collectionName);
    return {
      pointsCount: info.points_count ?? 0,
      segmentsCount: info.segments_count ?? 0,
      status: info.status,
    };
  }

  /**
   * Count points by repository ID
   */
  async countByRepoId(repoId: string): Promise<number> {
    const result = await this.client.count(this.collectionName, {
      filter: {
        must: [{ key: 'repo_id', match: { value: repoId } }],
      },
      exact: true,
    });
    return result.count;
  }

  /**
   * Scroll through points with filter
   */
  async scroll(options: {
    filter?: { must: Array<{ key: string; match: { value: string } }> };
    limit?: number;
    withPayload?: boolean;
    withVector?: boolean;
    offset?: string | number;
  }): Promise<{
    points: Array<{
      id: string | number;
      payload: Record<string, unknown>;
    }>;
    nextPageOffset?: string | number;
  }> {
    const response = await this.client.scroll(this.collectionName, {
      filter: options.filter,
      limit: options.limit ?? 100,
      with_payload: options.withPayload ?? true,
      with_vector: options.withVector ?? false,
      offset: options.offset,
    });

    const nextOffset = response.next_page_offset;
    return {
      points: response.points.map((p) => ({
        id: p.id,
        payload: p.payload as Record<string, unknown>,
      })),
      nextPageOffset: typeof nextOffset === 'string' || typeof nextOffset === 'number'
        ? nextOffset
        : undefined,
    };
  }
}
