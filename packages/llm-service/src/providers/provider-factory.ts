/**
 * LLM Provider Factory
 */

import type { ILLMProvider } from './provider-interface.js';
import type { LLMProviderConfig } from '../types.js';
import { DeepSeekProvider } from './deepseek-provider.js';

export type ProviderName = 'deepseek' | 'openai' | 'anthropic';

export interface ProviderFactoryConfig extends LLMProviderConfig {
  provider: ProviderName;
}

/**
 * Create an LLM provider based on configuration
 */
export function createProvider(config: ProviderFactoryConfig): ILLMProvider {
  switch (config.provider) {
    case 'deepseek':
      return new DeepSeekProvider(config);

    case 'openai':
      // TODO: Implement OpenAI provider
      throw new Error('OpenAI provider not yet implemented');

    case 'anthropic':
      // TODO: Implement Anthropic provider
      throw new Error('Anthropic provider not yet implemented');

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Get available provider names
 */
export function getAvailableProviders(): ProviderName[] {
  return ['deepseek'];
}
