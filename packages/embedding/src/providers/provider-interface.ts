/**
 * Embedding Provider Interface
 */

import type { EmbeddingProviderConfig } from '../types.js';

export interface IEmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dimensions: number;

  /**
   * Embed a single text
   */
  embed(text: string): Promise<number[]>;

  /**
   * Embed multiple texts in a batch
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Get embedding dimensions
   */
  getDimensions(): number;
}

export type { EmbeddingProviderConfig };
