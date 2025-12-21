/**
 * Embedding Service Types
 */

export interface EmbeddingProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  dimensions?: number;
  timeout?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  usage?: {
    totalTokens: number;
  };
}
