'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';

export interface ModelProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  apiKeyFromEnv?: boolean;
}

interface ProviderOption {
  value: string;
  label: string;
}

interface ModelOption {
  provider: string;
  models: string[];
}

// Default base URLs for providers
const PROVIDER_BASE_URLS: Record<string, string> = {
  bigmodel: 'https://open.bigmodel.cn/api/paas/v4',
};

// Helper to get the first model for a provider
function getFirstModelForProvider(provider: string, models: ModelOption[]): string | undefined {
  const providerModels = models.find((m) => m.provider === provider);
  return providerModels?.models[0];
}

interface ProviderCardProps {
  title: string;
  description?: string;
  type: 'embedding' | 'llm' | 'reranker';
  providers: ProviderOption[];
  models: ModelOption[];
  config: ModelProviderConfig;
  onSave: (config: Partial<ModelProviderConfig>) => Promise<void>;
  onTest: () => Promise<{ success: boolean; message?: string; error?: string }>;
}

export function ProviderCard({
  title,
  description,
  type,
  providers,
  models,
  config,
  onSave,
  onTest,
}: ProviderCardProps) {
  const [localConfig, setLocalConfig] = useState<ModelProviderConfig>(config);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
    setHasChanges(false);
  }, [config]);

  const handleChange = (field: keyof ModelProviderConfig, value: string) => {
    setLocalConfig((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-fill baseUrl and model when provider changes
      if (field === 'provider') {
        if (PROVIDER_BASE_URLS[value]) {
          updated.baseUrl = PROVIDER_BASE_URLS[value];
        } else {
          updated.baseUrl = '';
        }
        // Reset model to the first model for the new provider
        const firstModel = getFirstModelForProvider(value, models);
        if (firstModel) {
          updated.model = firstModel;
        }
      }
      return updated;
    });
    setHasChanges(true);
    setTestResult(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Only send non-empty values that differ from env
      const updates: Partial<ModelProviderConfig> = {};
      if (localConfig.provider !== config.provider) {
        updates.provider = localConfig.provider;
      }
      // Don't send masked API keys back
      if (localConfig.apiKey && !localConfig.apiKey.includes('...')) {
        updates.apiKey = localConfig.apiKey;
      }
      if (localConfig.baseUrl !== config.baseUrl) {
        updates.baseUrl = localConfig.baseUrl;
      }
      if (localConfig.model !== config.model) {
        updates.model = localConfig.model;
      }

      await onSave(updates);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult(result);
    } finally {
      setIsTesting(false);
    }
  };

  const currentModels = models.find((m) => m.provider === localConfig.provider)?.models || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider Select */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Provider</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={localConfig.provider}
            onChange={(e) => handleChange('provider', e.target.value)}
          >
            {providers.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* API Key */}
        {localConfig.provider !== 'none' && (
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              API Key
              {config.apiKeyFromEnv && (
                <Badge variant="secondary" className="text-xs">
                  from env
                </Badge>
              )}
            </label>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                placeholder={config.apiKeyFromEnv ? 'Using environment variable' : 'Enter API key'}
                value={localConfig.apiKey || ''}
                onChange={(e) => handleChange('apiKey', e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Base URL (optional) */}
        {localConfig.provider !== 'none' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Base URL <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              type="text"
              placeholder="https://api.openai.com/v1"
              value={localConfig.baseUrl || ''}
              onChange={(e) => handleChange('baseUrl', e.target.value)}
            />
          </div>
        )}

        {/* Model */}
        {localConfig.provider !== 'none' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            {type === 'embedding' && currentModels.length > 0 ? (
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={localConfig.model || ''}
                onChange={(e) => handleChange('model', e.target.value)}
              >
                {currentModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type="text"
                placeholder="Enter model name"
                value={localConfig.model || ''}
                onChange={(e) => handleChange('model', e.target.value)}
              />
            )}
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <div
            className={`p-3 rounded-md text-sm ${
              testResult.success
                ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200'
                : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {testResult.success ? testResult.message : testResult.error}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={handleTest} disabled={isTesting}>
            {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
