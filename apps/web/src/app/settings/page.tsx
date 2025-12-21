'use client';

import { useEffect, useState, useCallback } from 'react';
import { ProviderCard, ModelProviderConfig } from '@/components/settings/provider-card';
import { AgentModelCard } from '@/components/settings/agent-model-card';
import { Loader2 } from 'lucide-react';

interface AgentConfig {
  model: string;
}

interface WikiAgentConfig extends AgentConfig {
  concurrency?: number;
}

interface SettingsData {
  embedding: ModelProviderConfig;
  llm: ModelProviderConfig;
  reranker: ModelProviderConfig;
  snippetAgent: AgentConfig;
  wikiAgent: WikiAgentConfig;
}

const EMBEDDING_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'voyage', label: 'Voyage AI' },
  { value: 'bigmodel', label: 'BigModel (智谱)' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
];

const EMBEDDING_MODELS = [
  {
    provider: 'openai',
    models: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
  },
  { provider: 'voyage', models: ['voyage-3', 'voyage-code-3', 'voyage-3-lite'] },
  { provider: 'bigmodel', models: ['embedding-3'] },
];

const LLM_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
];

const LLM_MODELS = [
  { provider: 'openai', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  {
    provider: 'anthropic',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  },
  { provider: 'deepseek', models: ['deepseek-chat', 'deepseek-coder'] },
];

const RERANKER_PROVIDERS = [
  { value: 'none', label: 'Disabled' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'bigmodel', label: 'BigModel (智谱)' },
];

const RERANKER_MODELS = [
  {
    provider: 'cohere',
    models: ['rerank-v3.5', 'rerank-english-v3.0', 'rerank-multilingual-v3.0'],
  },
  {
    provider: 'bigmodel',
    models: ['rerank'],
  },
];

const CLAUDE_AGENT_MODELS = [
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (Fast, economical)' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Balanced) - Recommended' },
  { value: 'claude-opus-4-5', label: 'Claude Opus 4.5 (Most capable)' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (type: 'embedding' | 'llm' | 'reranker', config: Partial<ModelProviderConfig>) => {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [type]: config }),
    });

    if (!response.ok) throw new Error('Failed to save settings');

    const data = await response.json();
    setSettings(data);
  };

  const handleAgentSave = async (type: 'snippetAgent' | 'wikiAgent', model: string) => {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [type]: { model } }),
    });

    if (!response.ok) throw new Error('Failed to save settings');

    const data = await response.json();
    setSettings(data);
  };

  const handleWikiConcurrencySave = async (concurrency: number) => {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wikiAgent: { concurrency } }),
    });

    if (!response.ok) throw new Error('Failed to save settings');

    const data = await response.json();
    setSettings(data);
  };

  const handleTest = async (type: 'embedding' | 'llm' | 'reranker') => {
    const response = await fetch('/api/settings/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });

    return response.json();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500 mb-2">Error loading settings</p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure AI model providers for embedding, LLM, and reranking.
        </p>
      </div>

      <ProviderCard
        title="Embedding Provider"
        description="Used for generating vector embeddings of code chunks for semantic search."
        type="embedding"
        providers={EMBEDDING_PROVIDERS}
        models={EMBEDDING_MODELS}
        config={settings.embedding}
        onSave={(config) => handleSave('embedding', config)}
        onTest={() => handleTest('embedding')}
      />

      <ProviderCard
        title="LLM Provider"
        description="Used for generating code summaries and answering questions."
        type="llm"
        providers={LLM_PROVIDERS}
        models={LLM_MODELS}
        config={settings.llm}
        onSave={(config) => handleSave('llm', config)}
        onTest={() => handleTest('llm')}
      />

      <ProviderCard
        title="Reranker Provider"
        description="Used for reranking search results for better relevance (optional)."
        type="reranker"
        providers={RERANKER_PROVIDERS}
        models={RERANKER_MODELS}
        config={settings.reranker}
        onSave={(config) => handleSave('reranker', config)}
        onTest={() => handleTest('reranker')}
      />

      <div className="border-t pt-6 mt-2">
        <h2 className="text-xl font-semibold mb-4">Claude Agent SDK</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Configure Claude models for code analysis. Uses ANTHROPIC_API_KEY from environment.
        </p>
        <div className="space-y-4">
          <AgentModelCard
            title="Snippet Generation Agent"
            description="Claude model for generating code snippets and context."
            models={CLAUDE_AGENT_MODELS}
            selectedModel={settings.snippetAgent.model}
            onSave={(model) => handleAgentSave('snippetAgent', model)}
          />

          <AgentModelCard
            title="Wiki Generation Agent"
            description="Claude model for generating wiki documentation."
            models={CLAUDE_AGENT_MODELS}
            selectedModel={settings.wikiAgent.model}
            onSave={(model) => handleAgentSave('wikiAgent', model)}
          />

          {/* Wiki Concurrency Setting */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-medium">Wiki Concurrency</h3>
                <p className="text-sm text-muted-foreground">
                  Number of pages to generate in parallel. Higher values = faster, but may hit API limits.
                </p>
              </div>
              <span className="text-2xl font-semibold text-primary">
                {settings.wikiAgent.concurrency ?? 5}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <span className="text-sm text-muted-foreground">1</span>
              <input
                type="range"
                min="1"
                max="10"
                value={settings.wikiAgent.concurrency ?? 5}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          wikiAgent: { ...prev.wikiAgent, concurrency: value },
                        }
                      : prev
                  );
                }}
                onMouseUp={(e) => {
                  const value = parseInt((e.target as HTMLInputElement).value, 10);
                  handleWikiConcurrencySave(value);
                }}
                onTouchEnd={(e) => {
                  const value = parseInt((e.target as HTMLInputElement).value, 10);
                  handleWikiConcurrencySave(value);
                }}
                className="flex-1 h-2 appearance-none rounded-lg bg-muted cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
              />
              <span className="text-sm text-muted-foreground">10</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
