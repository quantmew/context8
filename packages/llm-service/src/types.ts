/**
 * LLM Service Types
 */

export interface LLMProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: 'stop' | 'length' | 'error';
}


export interface CodeSummary {
  summary: string;
  keywords: string[];
  complexity?: 'low' | 'medium' | 'high';
}

export interface CookbookEntry {
  title: string;
  description: string;
  codeExample: string;
  relatedSymbols: string[];
  category: 'getting-started' | 'common-patterns' | 'advanced' | 'best-practices';
}

export interface APIDocumentation {
  symbolName: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
  }>;
  returnType: string;
  returnDescription: string;
  examples: string[];
  throws?: string[];
}

export interface SummarizeOptions {
  language: string;
  symbolName?: string;
  chunkType?: string;
}
