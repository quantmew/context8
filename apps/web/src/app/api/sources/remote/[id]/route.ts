import { NextRequest, NextResponse } from 'next/server';
import { remoteSourceRepository } from '@context8/database';

interface UpdateRemoteSourceRequest {
  description?: string;
  defaultBranch?: string;
  syncEnabled?: boolean;
  syncIntervalHrs?: number;
  credentialId?: string | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const source = await remoteSourceRepository.findById(id);

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    return NextResponse.json({ source });
  } catch (error) {
    console.error('Error fetching remote source:', error);
    return NextResponse.json(
      { error: 'Failed to fetch remote source' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateRemoteSourceRequest = await request.json();

    const existing = await remoteSourceRepository.findById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const source = await remoteSourceRepository.update(id, {
      description: body.description,
      defaultBranch: body.defaultBranch,
      syncEnabled: body.syncEnabled,
      syncIntervalHrs: body.syncIntervalHrs,
      credentialId: body.credentialId,
    });

    return NextResponse.json({ source });
  } catch (error) {
    console.error('Error updating remote source:', error);
    return NextResponse.json(
      { error: 'Failed to update remote source' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await remoteSourceRepository.findById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    await remoteSourceRepository.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting remote source:', error);
    return NextResponse.json(
      { error: 'Failed to delete remote source' },
      { status: 500 }
    );
  }
}
