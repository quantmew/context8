import { NextResponse } from 'next/server';
import { settingsService } from '@context8/database';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type } = body as { type: 'embedding' | 'llm' | 'reranker' };

    if (!type || !['embedding', 'llm', 'reranker'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be embedding, llm, or reranker' },
        { status: 400 }
      );
    }

    let config;
    switch (type) {
      case 'embedding':
        config = await settingsService.getEmbeddingConfig();
        break;
      case 'llm':
        config = await settingsService.getLLMConfig();
        break;
      case 'reranker':
        config = await settingsService.getRerankerConfig();
        break;
    }

    if (!config.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'No API key configured',
      });
    }

    // Test connection based on provider type
    const result = await testConnection(type, config);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error testing connection:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testConnection(
  type: 'embedding' | 'llm' | 'reranker',
  config: { provider: string; apiKey?: string; baseUrl?: string; model?: string }
): Promise<{ success: boolean; message?: string; error?: string }> {
  const { provider, apiKey, baseUrl, model } = config;

  if (type === 'embedding') {
    // Test embedding provider
    if (provider === 'openai' || provider === 'custom') {
      try {
        const openai = new OpenAI({
          apiKey,
          baseURL: baseUrl,
        });
        await openai.embeddings.create({
          model: model || 'text-embedding-3-small',
          input: 'test',
          dimensions: 256, // Use smaller dimensions for test
        });
        return { success: true, message: 'Embedding connection successful' };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to connect',
        };
      }
    } else if (provider === 'voyage') {
      // TODO: Implement Voyage test
      return { success: false, error: 'Voyage testing not yet implemented' };
    } else if (provider === 'bigmodel') {
      try {
        // BigModel only supports 'embedding-3' model for embeddings
        const bigmodelModel = 'embedding-3';
        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/embeddings', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: bigmodelModel,
            input: ['test'],
            dimensions: 256,
          }),
        });
        if (!response.ok) {
          const error = await response.text();
          throw new Error(error || 'Failed to connect');
        }
        return { success: true, message: 'BigModel embedding connection successful' };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to connect',
        };
      }
    }
  } else if (type === 'llm') {
    // Test LLM provider
    if (provider === 'openai' || provider === 'custom' || provider === 'deepseek') {
      try {
        const openai = new OpenAI({
          apiKey,
          baseURL: baseUrl,
        });
        await openai.chat.completions.create({
          model: model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say "test" in one word.' }],
          max_tokens: 10,
        });
        return { success: true, message: 'LLM connection successful' };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to connect',
        };
      }
    } else if (provider === 'anthropic') {
      // TODO: Implement Anthropic test
      return { success: false, error: 'Anthropic testing not yet implemented' };
    }
  } else if (type === 'reranker') {
    // Test reranker provider
    if (provider === 'none') {
      return { success: true, message: 'Reranker is disabled' };
    } else if (provider === 'cohere') {
      // TODO: Implement Cohere test
      return { success: false, error: 'Cohere testing not yet implemented' };
    } else if (provider === 'bigmodel') {
      try {
        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/rerank', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'rerank',
            query: 'test',
            documents: ['test document'],
          }),
        });
        if (!response.ok) {
          const error = await response.text();
          throw new Error(error || 'Failed to connect');
        }
        return { success: true, message: 'BigModel reranker connection successful' };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to connect',
        };
      }
    }
  }

  return { success: false, error: `Unknown provider: ${provider}` };
}
