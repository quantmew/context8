import { QdrantClient as BaseQdrantClient } from '@qdrant/js-client-rest';
import type { QdrantConfig } from './types.js';

/**
 * Collection configuration for Context8
 */
export interface CollectionConfig {
  name: string;
  denseVectorSize: number;
  onDisk?: boolean;
}

const DEFAULT_CONFIG: CollectionConfig = {
  name: 'codebase_v1',
  denseVectorSize: 1024, // Voyage code-3 dimension
  onDisk: true,
};

/**
 * Manages Qdrant collection lifecycle
 */
export class CollectionManager {
  private client: BaseQdrantClient;
  private config: CollectionConfig;

  constructor(qdrantConfig: QdrantConfig, collectionConfig?: Partial<CollectionConfig>) {
    this.client = new BaseQdrantClient({
      host: qdrantConfig.host,
      port: qdrantConfig.port,
      apiKey: qdrantConfig.apiKey,
      https: qdrantConfig.https,
    });
    this.config = { ...DEFAULT_CONFIG, ...collectionConfig };
  }

  /**
   * Initialize collection with hybrid vector configuration
   */
  async initialize(): Promise<void> {
    const exists = await this.client.collectionExists(this.config.name);

    if (!exists.exists) {
      await this.createCollection();
      await this.createPayloadIndexes();
    }
  }

  /**
   * Create collection with dense and sparse vectors
   */
  private async createCollection(): Promise<void> {
    await this.client.createCollection(this.config.name, {
      vectors: {
        dense: {
          size: this.config.denseVectorSize,
          distance: 'Cosine',
          on_disk: this.config.onDisk,
          hnsw_config: {
            m: 16,
            ef_construct: 100,
          },
        },
      },
      sparse_vectors: {
        sparse: {
          modifier: 'idf',
        },
      },
      optimizers_config: {
        memmap_threshold: 20000,
        indexing_threshold: 20000,
      },
      shard_number: 2,
      replication_factor: 1,
    });

    console.log(`Created collection: ${this.config.name}`);
  }

  /**
   * Create payload indexes for efficient filtering
   */
  private async createPayloadIndexes(): Promise<void> {
    const indexes = [
      { field: 'repo_id', type: 'keyword' as const },
      { field: 'org_id', type: 'keyword' as const },
      { field: 'file_path', type: 'keyword' as const },
      { field: 'language', type: 'keyword' as const },
      { field: 'chunk_type', type: 'keyword' as const },
      { field: 'chunk_level', type: 'keyword' as const },
      { field: 'symbol_name', type: 'text' as const },
      { field: 'commit_sha', type: 'keyword' as const },
      { field: 'content_hash', type: 'keyword' as const },
    ];

    for (const index of indexes) {
      await this.client.createPayloadIndex(this.config.name, {
        field_name: index.field,
        field_schema: index.type,
      });
    }

    console.log(`Created ${indexes.length} payload indexes`);
  }

  /**
   * Drop and recreate collection (use with caution!)
   */
  async recreate(): Promise<void> {
    const exists = await this.client.collectionExists(this.config.name);

    if (exists.exists) {
      await this.client.deleteCollection(this.config.name);
      console.log(`Deleted collection: ${this.config.name}`);
    }

    await this.createCollection();
    await this.createPayloadIndexes();
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{
    name: string;
    pointsCount: number;
    segmentsCount: number;
    status: string;
    vectorsSize: number;
  }> {
    const info = await this.client.getCollection(this.config.name);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vectors = info.config?.params?.vectors as any;
    const vectorsSize = vectors?.dense?.size ?? vectors?.size ?? 0;
    return {
      name: this.config.name,
      pointsCount: info.points_count ?? 0,
      segmentsCount: info.segments_count ?? 0,
      status: info.status,
      vectorsSize,
    };
  }
}
