/**
 * BigModel (智谱) Embedding Provider
 * Uses BigModel's embedding-3 model
 */

import type { IEmbeddingProvider, EmbeddingProviderConfig } from './provider-interface.js';

export interface BigModelProviderConfig extends EmbeddingProviderConfig {
  apiKey: string;
  model?: string;
  dimensions?: number;
  batchSize?: number;
}

interface BigModelEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
    object: string;
  }>;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class BigModelEmbeddingProvider implements IEmbeddingProvider {
  readonly name = 'bigmodel';
  readonly model: string;
  readonly dimensions: number;

  private apiKey: string;
  private baseUrl: string;
  private batchSize: number;
  private timeout: number;

  constructor(config: BigModelProviderConfig) {
    if (!config.apiKey) {
      throw new Error('BigModel API key is required');
    }

    this.apiKey = config.apiKey;
    // Normalize base URL - remove trailing /embeddings if present
    let baseUrl = config.baseUrl ?? 'https://open.bigmodel.cn/api/paas/v4';
    if (baseUrl.endsWith('/embeddings')) {
      baseUrl = baseUrl.slice(0, -'/embeddings'.length);
    }
    this.baseUrl = baseUrl;
    // BigModel only supports 'embedding-3' model, ignore any other model name
    this.model = 'embedding-3';
    // BigModel supports 256, 512, 1024, 2048 dimensions (default 2048)
    this.dimensions = config.dimensions ?? 1024;
    this.batchSize = config.batchSize ?? 64; // BigModel max batch size is 64
    this.timeout = config.timeout ?? 60000;
  }

  /**
   * Get embedding dimensions
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * Embed a single text
   */
  async embed(text: string): Promise<number[]> {
    const response = await this.callAPI([text]);
    return response.data[0].embedding;
  }

  /**
   * Embed multiple texts in a batch
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const results: number[][] = [];

    // Process in batches (BigModel max is 64 items per request)
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const response = await this.callAPI(batch);

      // Ensure embeddings are in the correct order
      const sortedData = response.data.sort((a, b) => a.index - b.index);
      results.push(...sortedData.map((d) => d.embedding));
    }

    return results;
  }

  /**
   * Call BigModel embedding API
   */
  private async callAPI(input: string[]): Promise<BigModelEmbeddingResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input,
          dimensions: this.dimensions,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`BigModel API error (${response.status}): ${errorText}`);
      }

      return (await response.json()) as BigModelEmbeddingResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Create a BigModel embedding provider
 */
export function createBigModelProvider(config: BigModelProviderConfig): BigModelEmbeddingProvider {
  return new BigModelEmbeddingProvider(config);
}
