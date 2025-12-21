/**
 * DeepSeek LLM Provider
 */

import type { ILLMProvider } from './provider-interface.js';
import type { LLMRequest, LLMResponse, LLMProviderConfig } from '../types.js';
import { RateLimiter } from '../batch/rate-limiter.js';

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = 'deepseek-chat';
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_TIMEOUT = 60000; // 60 seconds

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekChatRequest {
  model: string;
  messages: DeepSeekMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface DeepSeekChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class DeepSeekProvider implements ILLMProvider {
  readonly name = 'deepseek';
  readonly model: string;

  private apiKey: string;
  private baseUrl: string;
  private maxTokens: number;
  private temperature: number;
  private timeout: number;
  private rateLimiter: RateLimiter;

  constructor(config: LLMProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.temperature = config.temperature ?? DEFAULT_TEMPERATURE;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;

    // Rate limit: 5 requests per second by default
    this.rateLimiter = new RateLimiter({ requestsPerSecond: 5 });
  }

  /**
   * Generate a response for a single request
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    await this.rateLimiter.acquire();

    const messages: DeepSeekMessage[] = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    messages.push({ role: 'user', content: request.prompt });

    const requestBody: DeepSeekChatRequest = {
      model: this.model,
      messages,
      max_tokens: request.maxTokens ?? this.maxTokens,
      temperature: request.temperature ?? this.temperature,
      stream: false,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as DeepSeekChatResponse;
      return this.parseResponse(data);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`DeepSeek API request timed out after ${this.timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Generate responses for multiple requests (sequential with rate limiting)
   */
  async generateBatch(requests: LLMRequest[]): Promise<LLMResponse[]> {
    const results: LLMResponse[] = [];

    for (const request of requests) {
      try {
        const response = await this.generate(request);
        results.push(response);
      } catch (error) {
        // Return error response for failed requests
        results.push({
          content: '',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          model: this.model,
          finishReason: 'error',
        });
      }
    }

    return results;
  }

  /**
   * Estimate token count for text (rough approximation)
   * ~4 characters per token for English, ~2 for Chinese
   */
  estimateTokens(text: string): number {
    // Simple heuristic: count words and Chinese characters
    const englishWords = text.match(/[a-zA-Z]+/g)?.length ?? 0;
    const chineseChars = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
    const numbers = text.match(/\d+/g)?.length ?? 0;
    const symbols = text.match(/[^\w\s\u4e00-\u9fff]/g)?.length ?? 0;

    // Rough estimation
    return Math.ceil(englishWords * 1.3 + chineseChars + numbers + symbols * 0.5);
  }

  /**
   * Parse DeepSeek API response
   */
  private parseResponse(data: DeepSeekChatResponse): LLMResponse {
    const choice = data.choices[0];

    return {
      content: choice?.message?.content ?? '',
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      model: data.model,
      finishReason: this.mapFinishReason(choice?.finish_reason),
    };
  }

  /**
   * Map DeepSeek finish reason to our enum
   */
  private mapFinishReason(reason: string): 'stop' | 'length' | 'error' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      default:
        return 'error';
    }
  }
}

/**
 * Create a DeepSeek provider with default configuration
 */
export function createDeepSeekProvider(apiKey: string, options?: Partial<LLMProviderConfig>): DeepSeekProvider {
  return new DeepSeekProvider({
    apiKey,
    ...options,
  });
}
