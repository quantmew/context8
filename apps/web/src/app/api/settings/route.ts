import { NextResponse } from 'next/server';
import { settingsService } from '@context8/database';

export async function GET() {
  try {
    const configs = await settingsService.getAllConfigsMasked();
    return NextResponse.json(configs);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // Update each provider config if provided
    if (body.embedding) {
      await settingsService.setEmbeddingConfig(body.embedding);
    }
    if (body.llm) {
      await settingsService.setLLMConfig(body.llm);
    }
    if (body.reranker) {
      await settingsService.setRerankerConfig(body.reranker);
    }
    if (body.snippetAgent) {
      await settingsService.setSnippetAgentConfig(body.snippetAgent);
    }
    if (body.wikiAgent) {
      await settingsService.setWikiAgentConfig(body.wikiAgent);
    }

    // Return updated configs (masked)
    const configs = await settingsService.getAllConfigsMasked();
    return NextResponse.json(configs);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
