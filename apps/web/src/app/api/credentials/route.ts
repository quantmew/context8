import { NextRequest, NextResponse } from 'next/server';
import { remoteCredentialRepository } from '@context8/database';

type RemoteProvider = 'GITHUB' | 'GITLAB' | 'BITBUCKET';

interface CreateCredentialRequest {
  provider: RemoteProvider;
  name: string;
  token: string;
}

export async function GET() {
  try {
    const credentials = await remoteCredentialRepository.findAll();

    // Never return the encrypted token data
    const sanitizedCredentials = credentials.map((cred) => ({
      id: cred.id,
      provider: cred.provider,
      name: cred.name,
      lastUsedAt: cred.lastUsedAt,
      createdAt: cred.createdAt,
      updatedAt: cred.updatedAt,
    }));

    return NextResponse.json({ credentials: sanitizedCredentials });
  } catch (error) {
    console.error('Error fetching credentials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credentials' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateCredentialRequest = await request.json();

    if (!body.provider || !body.name || !body.token) {
      return NextResponse.json(
        { error: 'provider, name, and token are required' },
        { status: 400 }
      );
    }

    // Check if ENCRYPTION_KEY is set
    if (!process.env.ENCRYPTION_KEY) {
      return NextResponse.json(
        { error: 'ENCRYPTION_KEY not configured. Please set it in environment variables.' },
        { status: 500 }
      );
    }

    const credential = await remoteCredentialRepository.create({
      provider: body.provider,
      name: body.name,
      token: body.token,
    });

    return NextResponse.json({
      credential: {
        id: credential.id,
        provider: credential.provider,
        name: credential.name,
        createdAt: credential.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating credential:', error);

    if (error instanceof Error && error.message.includes('ENCRYPTION_KEY')) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create credential' },
      { status: 500 }
    );
  }
}
