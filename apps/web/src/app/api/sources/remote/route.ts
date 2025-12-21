import { NextRequest, NextResponse } from 'next/server';
import { remoteSourceRepository, remoteCredentialRepository, taskRepository } from '@context8/database';

type RemoteProvider = 'GITHUB' | 'GITLAB' | 'BITBUCKET';

interface CreateRemoteSourceRequest {
  provider: RemoteProvider;
  repoUrl: string;
  fullName: string;
  description?: string;
  defaultBranch?: string;
  credentialId?: string;
}

export async function GET() {
  try {
    const sources = await remoteSourceRepository.findAll();
    return NextResponse.json({ sources });
  } catch (error) {
    console.error('Error fetching remote sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch remote sources' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateRemoteSourceRequest = await request.json();

    // Validate required fields
    if (!body.provider || !body.repoUrl || !body.fullName) {
      return NextResponse.json(
        { error: 'provider, repoUrl, and fullName are required' },
        { status: 400 }
      );
    }

    // Check if source already exists
    const existing = await remoteSourceRepository.findByUrl(body.repoUrl);
    if (existing) {
      return NextResponse.json(
        { error: 'A source with this URL already exists' },
        { status: 409 }
      );
    }

    // Verify credential exists if provided
    if (body.credentialId) {
      const credential = await remoteCredentialRepository.findById(body.credentialId);
      if (!credential) {
        return NextResponse.json(
          { error: 'Credential not found' },
          { status: 400 }
        );
      }
    }

    const source = await remoteSourceRepository.create({
      provider: body.provider,
      repoUrl: body.repoUrl,
      fullName: body.fullName,
      description: body.description,
      defaultBranch: body.defaultBranch,
      credentialId: body.credentialId,
    });

    // Create indexing task for the new source
    const task = await taskRepository.create({
      sourceId: source.id,
      sourceType: 'REMOTE',
      taskType: 'FULL_INDEX',
      triggeredBy: 'WEB',
    });

    // Update source status to INDEXING
    await remoteSourceRepository.updateIndexingStatus(source.id, 'INDEXING');

    return NextResponse.json({ source, taskId: task.id }, { status: 201 });
  } catch (error) {
    console.error('Error creating remote source:', error);
    return NextResponse.json(
      { error: 'Failed to create remote source' },
      { status: 500 }
    );
  }
}
