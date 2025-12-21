/**
 * Cookbook Generator - generates usage guides from code
 */

import type { ILLMProvider } from '../providers/provider-interface.js';
import type { CookbookEntry } from '../types.js';
import {
  COOKBOOK_SYSTEM_PROMPT,
  buildCookbookPrompt,
  parseCookbookResponse,
} from '../prompts/cookbook-prompts.js';

export interface SymbolInfo {
  name: string;
  type: string;
  signature?: string;
  docstring?: string;
  code: string;
}

export interface CookbookGeneratorConfig {
  maxTokens?: number;
  temperature?: number;
}

export class CookbookGenerator {
  private provider: ILLMProvider;
  private config: CookbookGeneratorConfig;

  constructor(provider: ILLMProvider, config: CookbookGeneratorConfig = {}) {
    this.provider = provider;
    this.config = {
      maxTokens: config.maxTokens ?? 1024,
      temperature: config.temperature ?? 0.5,
    };
  }

  /**
   * Generate cookbook entries from symbols
   */
  async generate(symbols: SymbolInfo[], filePath: string): Promise<CookbookEntry | null> {
    if (symbols.length === 0) {
      return null;
    }

    const prompt = buildCookbookPrompt(symbols, filePath);

    const response = await this.provider.generate({
      prompt,
      systemPrompt: COOKBOOK_SYSTEM_PROMPT,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    return parseCookbookResponse(response.content);
  }

  /**
   * Generate cookbook entries for multiple symbol groups
   */
  async generateBatch(
    items: Array<{ symbols: SymbolInfo[]; filePath: string }>
  ): Promise<Array<CookbookEntry | null>> {
    const results: Array<CookbookEntry | null> = [];

    for (const item of items) {
      try {
        const entry = await this.generate(item.symbols, item.filePath);
        results.push(entry);
      } catch (error) {
        console.error('Failed to generate cookbook entry:', error);
        results.push(null);
      }
    }

    return results;
  }

  /**
   * Group related symbols for cookbook generation
   */
  groupRelatedSymbols(symbols: SymbolInfo[]): SymbolInfo[][] {
    const groups: SymbolInfo[][] = [];
    const classMap = new Map<string, SymbolInfo[]>();

    // Group methods with their classes
    for (const symbol of symbols) {
      if (symbol.type === 'class') {
        if (!classMap.has(symbol.name)) {
          classMap.set(symbol.name, []);
        }
        classMap.get(symbol.name)!.unshift(symbol);
      } else if (symbol.type === 'method' && symbol.name.includes('.')) {
        const className = symbol.name.split('.')[0];
        if (!classMap.has(className)) {
          classMap.set(className, []);
        }
        classMap.get(className)!.push(symbol);
      } else {
        // Standalone functions go into their own group
        groups.push([symbol]);
      }
    }

    // Add class groups
    for (const classSymbols of classMap.values()) {
      if (classSymbols.length > 0) {
        groups.push(classSymbols);
      }
    }

    return groups;
  }
}
