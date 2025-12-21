/**
 * Mock Embedding Provider - placeholder implementation
 *
 * This generates random embeddings for testing purposes.
 * Replace with a real provider (OpenAI, Voyage, etc.) for production.
 */

import type { IEmbeddingProvider } from './provider-interface.js';

export interface MockProviderConfig {
  dimensions?: number;
  /** Simulate latency in ms */
  latency?: number;
}

export class MockEmbeddingProvider implements IEmbeddingProvider {
  readonly name = 'mock';
  readonly model = 'mock-embedding';
  readonly dimensions: number;

  private latency: number;

  constructor(config: MockProviderConfig = {}) {
    this.dimensions = config.dimensions ?? 1024;
    this.latency = config.latency ?? 10;
  }

  /**
   * Generate a mock embedding (random vector)
   */
  async embed(text: string): Promise<number[]> {
    await this.simulateLatency();

    // Generate deterministic-ish embedding based on text hash
    const hash = this.simpleHash(text);
    return this.generateVector(hash);
  }

  /**
   * Generate mock embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    await this.simulateLatency();

    return texts.map((text) => {
      const hash = this.simpleHash(text);
      return this.generateVector(hash);
    });
  }

  /**
   * Get embedding dimensions
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * Simple hash function for deterministic embeddings
   */
  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Generate a normalized vector from a seed
   */
  private generateVector(seed: number): number[] {
    const vector: number[] = [];

    // Use a simple PRNG
    let current = seed;
    for (let i = 0; i < this.dimensions; i++) {
      current = (current * 1103515245 + 12345) & 0x7fffffff;
      vector.push((current / 0x7fffffff) * 2 - 1);
    }

    // Normalize the vector
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return vector.map((v) => v / magnitude);
  }

  /**
   * Simulate network latency
   */
  private simulateLatency(): Promise<void> {
    if (this.latency <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, this.latency));
  }
}

/**
 * Create a mock embedding provider
 */
export function createMockProvider(config?: MockProviderConfig): MockEmbeddingProvider {
  return new MockEmbeddingProvider(config);
}
