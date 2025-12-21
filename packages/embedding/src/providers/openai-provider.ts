/**
 * OpenAI Embedding Provider
 * Uses OpenAI's text-embedding-3-small model
 */

import OpenAI from 'openai';
import type { IEmbeddingProvider, EmbeddingProviderConfig } from './provider-interface.js';

export interface OpenAIProviderConfig extends EmbeddingProviderConfig {
  apiKey: string;
  model?: string;
  dimensions?: number;
  batchSize?: number;
}

export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  readonly name = 'openai';
  readonly model: string;
  readonly dimensions: number;

  private client: OpenAI;
  private batchSize: number;

  constructor(config: OpenAIProviderConfig) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout ?? 60000,
    });

    this.model = config.model ?? 'text-embedding-3-small';
    this.dimensions = config.dimensions ?? 1536;
    this.batchSize = config.batchSize ?? 100;
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
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
      dimensions: this.dimensions,
    });

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

    // Process in batches to avoid rate limits and payload size limits
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);

      const response = await this.client.embeddings.create({
        model: this.model,
        input: batch,
        dimensions: this.dimensions,
      });

      // Ensure embeddings are in the correct order
      const sortedData = response.data.sort((a, b) => a.index - b.index);
      results.push(...sortedData.map((d) => d.embedding));
    }

    return results;
  }
}

/**
 * Create an OpenAI embedding provider
 */
export function createOpenAIProvider(config: OpenAIProviderConfig): OpenAIEmbeddingProvider {
  return new OpenAIEmbeddingProvider(config);
}
