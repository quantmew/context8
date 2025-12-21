/**
 * Embedding Provider Factory
 */

import type { IEmbeddingProvider, EmbeddingProviderConfig } from './provider-interface.js';
import { MockEmbeddingProvider } from './mock-provider.js';
import { OpenAIEmbeddingProvider } from './openai-provider.js';
import { BigModelEmbeddingProvider } from './bigmodel-provider.js';

export type ProviderName = 'mock' | 'openai' | 'voyage' | 'local' | 'bigmodel';

export interface ProviderFactoryConfig extends EmbeddingProviderConfig {
  provider: ProviderName;
}

/**
 * Create an embedding provider based on configuration
 */
export function createProvider(config: ProviderFactoryConfig): IEmbeddingProvider {
  switch (config.provider) {
    case 'mock':
      return new MockEmbeddingProvider({
        dimensions: config.dimensions,
      });

    case 'openai':
      if (!config.apiKey) {
        throw new Error('OpenAI API key is required');
      }
      return new OpenAIEmbeddingProvider({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        dimensions: config.dimensions,
        timeout: config.timeout,
      });

    case 'bigmodel':
      if (!config.apiKey) {
        throw new Error('BigModel API key is required');
      }
      return new BigModelEmbeddingProvider({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        dimensions: config.dimensions,
        timeout: config.timeout,
      });

    case 'voyage':
      // TODO: Implement Voyage embedding provider
      throw new Error('Voyage embedding provider not yet implemented');

    case 'local':
      // TODO: Implement local embedding provider
      throw new Error('Local embedding provider not yet implemented');

    default:
      throw new Error(`Unknown embedding provider: ${config.provider}`);
  }
}

/**
 * Get available provider names
 */
export function getAvailableProviders(): ProviderName[] {
  return ['mock', 'openai', 'bigmodel'];
}
