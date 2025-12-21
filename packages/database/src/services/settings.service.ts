import { settingsRepository } from '../repositories/settings.repository.js';

/**
 * Model provider configuration
 */
export interface ModelProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  /** Whether the API key comes from environment variable */
  apiKeyFromEnv?: boolean;
}

/**
 * Claude Agent SDK configuration (for snippet/wiki generation)
 */
export interface AgentConfig {
  model: string;
}

/**
 * Wiki Agent SDK configuration (extends AgentConfig with concurrency)
 */
export interface WikiAgentConfig extends AgentConfig {
  /** Number of concurrent page generations (default: 5) */
  concurrency?: number;
}

/**
 * Environment variable fallback mapping
 */
const ENV_FALLBACKS = {
  // Embedding
  'embedding.provider': ['EMBEDDING_PROVIDER'],
  'embedding.apiKey': ['OPENAI_API_KEY', 'VOYAGE_API_KEY', 'BIGMODEL_API_KEY'],
  'embedding.baseUrl': ['OPENAI_BASE_URL', 'EMBEDDING_BASE_URL'],
  'embedding.model': ['EMBEDDING_MODEL'],

  // LLM
  'llm.provider': ['LLM_PROVIDER'],
  'llm.apiKey': ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY'],
  'llm.baseUrl': ['LLM_BASE_URL', 'OPENAI_BASE_URL', 'DEEPSEEK_BASE_URL'],
  'llm.model': ['LLM_MODEL', 'DEEPSEEK_MODEL'],

  // Reranker
  'reranker.provider': ['RERANKER_PROVIDER'],
  'reranker.apiKey': ['COHERE_API_KEY', 'BIGMODEL_API_KEY'],
  'reranker.model': ['RERANKER_MODEL'],

  // Claude Agent SDK - Snippet Generation
  'snippetAgent.model': ['SNIPPET_AGENT_MODEL', 'CLAUDE_AGENT_MODEL'],

  // Claude Agent SDK - Wiki Generation
  'wikiAgent.model': ['WIKI_AGENT_MODEL', 'CLAUDE_AGENT_MODEL'],
  'wikiAgent.concurrency': ['WIKI_AGENT_CONCURRENCY'],
} as const;

/**
 * Default values
 */
const DEFAULTS = {
  'embedding.provider': 'openai',
  'embedding.model': 'text-embedding-3-small',
  'llm.provider': 'openai',
  'llm.model': 'gpt-4o-mini',
  'reranker.provider': 'none',
  'reranker.model': 'rerank-v3.5',
  'snippetAgent.model': 'claude-sonnet-4-5',
  'wikiAgent.model': 'claude-sonnet-4-5',
  'wikiAgent.concurrency': '5',
} as const;

/**
 * Get a setting value with environment variable fallback
 */
async function getWithFallback(key: string): Promise<{ value: string | undefined; fromEnv: boolean }> {
  // First, try database
  const dbValue = await settingsRepository.get(key);
  if (dbValue !== null) {
    return { value: dbValue, fromEnv: false };
  }

  // Then, try environment variables
  const envKeys = ENV_FALLBACKS[key as keyof typeof ENV_FALLBACKS];
  if (envKeys) {
    for (const envKey of envKeys) {
      const envValue = process.env[envKey];
      if (envValue) {
        return { value: envValue, fromEnv: true };
      }
    }
  }

  // Finally, use default
  const defaultValue = DEFAULTS[key as keyof typeof DEFAULTS];
  return { value: defaultValue, fromEnv: false };
}

/**
 * Settings service with typed access to provider configurations
 */
export class SettingsService {
  /**
   * Get embedding provider configuration
   */
  async getEmbeddingConfig(): Promise<ModelProviderConfig> {
    const [provider, apiKey, baseUrl, model] = await Promise.all([
      getWithFallback('embedding.provider'),
      getWithFallback('embedding.apiKey'),
      getWithFallback('embedding.baseUrl'),
      getWithFallback('embedding.model'),
    ]);

    return {
      provider: provider.value ?? 'openai',
      apiKey: apiKey.value,
      baseUrl: baseUrl.value,
      model: model.value,
      apiKeyFromEnv: apiKey.fromEnv,
    };
  }

  /**
   * Get LLM provider configuration
   */
  async getLLMConfig(): Promise<ModelProviderConfig> {
    const [provider, apiKey, baseUrl, model] = await Promise.all([
      getWithFallback('llm.provider'),
      getWithFallback('llm.apiKey'),
      getWithFallback('llm.baseUrl'),
      getWithFallback('llm.model'),
    ]);

    return {
      provider: provider.value ?? 'openai',
      apiKey: apiKey.value,
      baseUrl: baseUrl.value,
      model: model.value,
      apiKeyFromEnv: apiKey.fromEnv,
    };
  }

  /**
   * Get reranker provider configuration
   */
  async getRerankerConfig(): Promise<ModelProviderConfig> {
    const [provider, apiKey, model] = await Promise.all([
      getWithFallback('reranker.provider'),
      getWithFallback('reranker.apiKey'),
      getWithFallback('reranker.model'),
    ]);

    return {
      provider: provider.value ?? 'none',
      apiKey: apiKey.value,
      model: model.value,
      apiKeyFromEnv: apiKey.fromEnv,
    };
  }

  /**
   * Set embedding provider configuration
   */
  async setEmbeddingConfig(config: Partial<ModelProviderConfig>): Promise<void> {
    const settings: Record<string, string> = {};
    if (config.provider !== undefined) settings['embedding.provider'] = config.provider;
    if (config.apiKey !== undefined) settings['embedding.apiKey'] = config.apiKey;
    if (config.baseUrl !== undefined) settings['embedding.baseUrl'] = config.baseUrl;
    if (config.model !== undefined) settings['embedding.model'] = config.model;

    if (Object.keys(settings).length > 0) {
      await settingsRepository.setMany(settings);
    }
  }

  /**
   * Set LLM provider configuration
   */
  async setLLMConfig(config: Partial<ModelProviderConfig>): Promise<void> {
    const settings: Record<string, string> = {};
    if (config.provider !== undefined) settings['llm.provider'] = config.provider;
    if (config.apiKey !== undefined) settings['llm.apiKey'] = config.apiKey;
    if (config.baseUrl !== undefined) settings['llm.baseUrl'] = config.baseUrl;
    if (config.model !== undefined) settings['llm.model'] = config.model;

    if (Object.keys(settings).length > 0) {
      await settingsRepository.setMany(settings);
    }
  }

  /**
   * Set reranker provider configuration
   */
  async setRerankerConfig(config: Partial<ModelProviderConfig>): Promise<void> {
    const settings: Record<string, string> = {};
    if (config.provider !== undefined) settings['reranker.provider'] = config.provider;
    if (config.apiKey !== undefined) settings['reranker.apiKey'] = config.apiKey;
    if (config.model !== undefined) settings['reranker.model'] = config.model;

    if (Object.keys(settings).length > 0) {
      await settingsRepository.setMany(settings);
    }
  }

  /**
   * Get snippet agent configuration (Claude Agent SDK)
   */
  async getSnippetAgentConfig(): Promise<AgentConfig> {
    const model = await getWithFallback('snippetAgent.model');
    return { model: model.value ?? 'claude-sonnet-4-5' };
  }

  /**
   * Get wiki agent configuration (Claude Agent SDK)
   */
  async getWikiAgentConfig(): Promise<WikiAgentConfig> {
    const [model, concurrency] = await Promise.all([
      getWithFallback('wikiAgent.model'),
      getWithFallback('wikiAgent.concurrency'),
    ]);
    return {
      model: model.value ?? 'claude-sonnet-4-5',
      concurrency: concurrency.value ? parseInt(concurrency.value, 10) : 5,
    };
  }

  /**
   * Set snippet agent configuration
   */
  async setSnippetAgentConfig(config: Partial<AgentConfig>): Promise<void> {
    if (config.model) {
      await settingsRepository.set('snippetAgent.model', config.model);
    }
  }

  /**
   * Set wiki agent configuration
   */
  async setWikiAgentConfig(config: Partial<WikiAgentConfig>): Promise<void> {
    const settings: Record<string, string> = {};
    if (config.model) {
      settings['wikiAgent.model'] = config.model;
    }
    if (config.concurrency !== undefined) {
      settings['wikiAgent.concurrency'] = String(config.concurrency);
    }
    if (Object.keys(settings).length > 0) {
      await settingsRepository.setMany(settings);
    }
  }

  /**
   * Get all settings (for API response)
   */
  async getAllConfigs(): Promise<{
    embedding: ModelProviderConfig;
    llm: ModelProviderConfig;
    reranker: ModelProviderConfig;
    snippetAgent: AgentConfig;
    wikiAgent: WikiAgentConfig;
  }> {
    const [embedding, llm, reranker, snippetAgent, wikiAgent] = await Promise.all([
      this.getEmbeddingConfig(),
      this.getLLMConfig(),
      this.getRerankerConfig(),
      this.getSnippetAgentConfig(),
      this.getWikiAgentConfig(),
    ]);
    return { embedding, llm, reranker, snippetAgent, wikiAgent };
  }

  /**
   * Mask an API key for display (show first 4 and last 4 characters)
   */
  maskApiKey(apiKey: string | undefined): string | undefined {
    if (!apiKey || apiKey.length < 12) return apiKey;
    return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
  }

  /**
   * Get all configs with masked API keys (for UI display)
   */
  async getAllConfigsMasked(): Promise<{
    embedding: ModelProviderConfig;
    llm: ModelProviderConfig;
    reranker: ModelProviderConfig;
    snippetAgent: AgentConfig;
    wikiAgent: WikiAgentConfig;
  }> {
    const configs = await this.getAllConfigs();
    return {
      embedding: {
        ...configs.embedding,
        apiKey: this.maskApiKey(configs.embedding.apiKey),
      },
      llm: {
        ...configs.llm,
        apiKey: this.maskApiKey(configs.llm.apiKey),
      },
      reranker: {
        ...configs.reranker,
        apiKey: this.maskApiKey(configs.reranker.apiKey),
      },
      snippetAgent: configs.snippetAgent,
      wikiAgent: configs.wikiAgent,
    };
  }

  /**
   * Clear a setting (to fall back to env var)
   */
  async clearSetting(key: string): Promise<void> {
    await settingsRepository.delete(key);
  }

  /**
   * Clear all settings for a provider type
   */
  async clearProviderSettings(type: 'embedding' | 'llm' | 'reranker'): Promise<void> {
    await settingsRepository.deleteByPrefix(`${type}.`);
  }
}

export const settingsService = new SettingsService();
