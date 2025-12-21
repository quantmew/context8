/**
 * LLM Provider Interface
 */

import type { LLMRequest, LLMResponse, LLMProviderConfig } from '../types.js';

export interface ILLMProvider {
  /** Provider name (e.g., 'deepseek', 'openai') */
  readonly name: string;

  /** Model being used */
  readonly model: string;

  /**
   * Generate a response for a single request
   */
  generate(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Generate responses for multiple requests (batch)
   */
  generateBatch(requests: LLMRequest[]): Promise<LLMResponse[]>;

  /**
   * Estimate token count for a text
   */
  estimateTokens(text: string): number;
}

export type { LLMProviderConfig };
