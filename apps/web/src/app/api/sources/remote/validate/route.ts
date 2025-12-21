import { NextRequest, NextResponse } from 'next/server';
import { remoteCredentialRepository } from '@context8/database';

interface ValidateRequest {
  provider: 'GITHUB' | 'GITLAB' | 'BITBUCKET';
  repoUrl: string;
  credentialId?: string;
  token?: string; // For testing without saved credential
}

const API_URLS = {
  GITHUB: 'https://api.github.com',
  GITLAB: 'https://gitlab.com/api/v4',
  BITBUCKET: 'https://api.bitbucket.org/2.0',
};

async function validateGitHub(fullName: string, token?: string): Promise<{ valid: boolean; info?: Record<string, unknown>; error?: string }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URLS.GITHUB}/repos/${fullName}`, { headers });

  if (!response.ok) {
    if (response.status === 404) return { valid: false, error: 'Repository not found' };
    if (response.status === 401) return { valid: false, error: 'Invalid or expired token' };
    return { valid: false, error: `GitHub API error: ${response.status}` };
  }

  const data = await response.json() as {
    full_name: string;
    description: string | null;
    default_branch: string;
    private: boolean;
  };
  return {
    valid: true,
    info: {
      fullName: data.full_name,
      description: data.description,
      defaultBranch: data.default_branch,
      isPrivate: data.private,
    },
  };
}

async function validateGitLab(fullName: string, token: string): Promise<{ valid: boolean; info?: Record<string, unknown>; error?: string }> {
  const encodedPath = encodeURIComponent(fullName);
  const response = await fetch(`${API_URLS.GITLAB}/projects/${encodedPath}`, {
    headers: { 'PRIVATE-TOKEN': token },
  });

  if (!response.ok) {
    if (response.status === 404) return { valid: false, error: 'Repository not found' };
    if (response.status === 401) return { valid: false, error: 'Invalid or expired token' };
    return { valid: false, error: `GitLab API error: ${response.status}` };
  }

  const data = await response.json() as {
    path_with_namespace: string;
    description: string | null;
    default_branch: string;
    visibility: string;
  };
  return {
    valid: true,
    info: {
      fullName: data.path_with_namespace,
      description: data.description,
      defaultBranch: data.default_branch,
      isPrivate: data.visibility === 'private',
    },
  };
}

async function validateBitbucket(fullName: string, token: string): Promise<{ valid: boolean; info?: Record<string, unknown>; error?: string }> {
  const response = await fetch(`${API_URLS.BITBUCKET}/repositories/${fullName}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 404) return { valid: false, error: 'Repository not found' };
    if (response.status === 401) return { valid: false, error: 'Invalid or expired token' };
    return { valid: false, error: `Bitbucket API error: ${response.status}` };
  }

  const data = await response.json() as {
    full_name: string;
    description: string | null;
    mainbranch?: { name: string };
    is_private: boolean;
  };
  return {
    valid: true,
    info: {
      fullName: data.full_name,
      description: data.description,
      defaultBranch: data.mainbranch?.name || 'main',
      isPrivate: data.is_private,
    },
  };
}

function parseRepoUrl(url: string, provider: string): string | null {
  // Extract owner/repo from various URL formats
  const patterns: Record<string, RegExp[]> = {
    GITHUB: [
      /github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/.*)?$/,
      /^([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)$/,
    ],
    GITLAB: [
      /gitlab\.com\/(.+?)(?:\.git)?(?:\/)?$/,
      /^([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)$/,
    ],
    BITBUCKET: [
      /bitbucket\.org\/([^/]+\/[^/]+?)(?:\.git)?(?:\/.*)?$/,
      /^([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)$/,
    ],
  };

  for (const pattern of patterns[provider] || []) {
    const match = url.match(pattern);
    if (match) {
      return match[1].replace(/\.git$/, '');
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body: ValidateRequest = await request.json();

    if (!body.provider || !body.repoUrl) {
      return NextResponse.json(
        { error: 'provider and repoUrl are required' },
        { status: 400 }
      );
    }

    // Get token from credential or direct input
    let token = body.token;
    if (body.credentialId && !token) {
      const credential = await remoteCredentialRepository.findByIdWithToken(body.credentialId);
      if (!credential?.decryptedToken) {
        return NextResponse.json(
          { error: 'Credential not found or could not be decrypted' },
          { status: 400 }
        );
      }
      token = credential.decryptedToken;
    }

    // Parse the repo URL to get fullName
    const fullName = parseRepoUrl(body.repoUrl, body.provider);
    if (!fullName) {
      return NextResponse.json(
        { valid: false, error: 'Invalid repository URL format' },
        { status: 200 }
      );
    }

    // Validate based on provider
    // Note: GitHub allows public repos without token, others require token
    let result: { valid: boolean; info?: Record<string, unknown>; error?: string };
    switch (body.provider) {
      case 'GITHUB':
        result = await validateGitHub(fullName, token);
        break;
      case 'GITLAB':
        if (!token) {
          return NextResponse.json(
            { valid: false, error: 'Token is required for GitLab' },
            { status: 200 }
          );
        }
        result = await validateGitLab(fullName, token);
        break;
      case 'BITBUCKET':
        if (!token) {
          return NextResponse.json(
            { valid: false, error: 'Token is required for Bitbucket' },
            { status: 200 }
          );
        }
        result = await validateBitbucket(fullName, token);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid provider' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error validating remote source:', error);
    return NextResponse.json(
      { error: 'Failed to validate remote source' },
      { status: 500 }
    );
  }
}
