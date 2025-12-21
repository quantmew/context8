/**
 * Code Summarizer - generates natural language summaries for code chunks
 */

import type { ILLMProvider } from '../providers/provider-interface.js';
import type { CodeSummary, SummarizeOptions } from '../types.js';
import {
  SUMMARY_SYSTEM_PROMPT,
  buildSummaryPrompt,
  parseSummaryResponse,
} from '../prompts/summary-prompts.js';

export interface CodeSummarizerConfig {
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Temperature for generation */
  temperature?: number;
  /** Batch size for parallel processing */
  batchSize?: number;
}

export class CodeSummarizer {
  private provider: ILLMProvider;
  private config: CodeSummarizerConfig;

  constructor(provider: ILLMProvider, config: CodeSummarizerConfig = {}) {
    this.provider = provider;
    this.config = {
      maxTokens: config.maxTokens ?? 256,
      temperature: config.temperature ?? 0.2,
      batchSize: config.batchSize ?? 10,
    };
  }

  /**
   * Summarize a single code chunk
   */
  async summarize(code: string, options: SummarizeOptions): Promise<CodeSummary> {
    const prompt = buildSummaryPrompt(code, options.language, options.symbolName);

    const response = await this.provider.generate({
      prompt,
      systemPrompt: SUMMARY_SYSTEM_PROMPT,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    return parseSummaryResponse(response.content);
  }

  /**
   * Summarize multiple code chunks in batches
   */
  async summarizeBatch(
    items: Array<{ code: string; options: SummarizeOptions }>
  ): Promise<CodeSummary[]> {
    const results: CodeSummary[] = [];
    const batchSize = this.config.batchSize!;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      // Process batch sequentially (rate limiting handled by provider)
      for (const item of batch) {
        try {
          const summary = await this.summarize(item.code, item.options);
          results.push(summary);
        } catch (error) {
          // Return empty summary on error
          console.error('Failed to summarize code:', error);
          results.push({
            summary: '',
            keywords: [],
          });
        }
      }
    }

    return results;
  }

  /**
   * Check if code is worth summarizing (based on size/complexity)
   */
  shouldSummarize(code: string): boolean {
    // Skip very short code
    if (code.length < 50) return false;

    // Skip code that's mostly whitespace/comments
    const nonWhitespace = code.replace(/\s+/g, '').length;
    if (nonWhitespace < 30) return false;

    return true;
  }
}
