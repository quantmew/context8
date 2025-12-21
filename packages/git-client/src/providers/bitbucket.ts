import type { RepoProvider, RepoInfo } from './types.js';

const BITBUCKET_API_URL = 'https://api.bitbucket.org/2.0';

export class BitbucketProvider implements RepoProvider {
  name = 'bitbucket';

  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${BITBUCKET_API_URL}/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getRepoInfo(fullName: string, token: string): Promise<RepoInfo> {
    const response = await fetch(`${BITBUCKET_API_URL}/repositories/${fullName}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Repository not found: ${fullName}`);
      }
      if (response.status === 401) {
        throw new Error('Invalid or expired Bitbucket token');
      }
      throw new Error(`Bitbucket API error: ${response.status}`);
    }

    const data = await response.json() as {
      full_name: string;
      description: string | null;
      mainbranch?: { name: string };
      is_private: boolean;
      links: {
        clone: Array<{ name: string; href: string }>;
        html: { href: string };
      };
    };

    // Find the HTTPS clone URL
    const httpsClone = data.links.clone.find(
      (link) => link.name === 'https'
    );

    return {
      fullName: data.full_name,
      description: data.description,
      defaultBranch: data.mainbranch?.name || 'main',
      isPrivate: data.is_private,
      cloneUrl: httpsClone?.href || `https://bitbucket.org/${data.full_name}.git`,
      htmlUrl: data.links.html.href,
    };
  }

  parseRepoUrl(url: string): { owner: string; repo: string } | null {
    // Handle various Bitbucket URL formats:
    // https://bitbucket.org/owner/repo
    // https://bitbucket.org/owner/repo.git
    // git@bitbucket.org:owner/repo.git

    // Direct owner/repo format
    if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(url)) {
      const [owner, repo] = url.split('/');
      return { owner, repo: repo.replace(/\.git$/, '') };
    }

    // HTTPS URL
    const httpsMatch = url.match(/bitbucket\.org\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/);
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }

    // SSH URL
    const sshMatch = url.match(/git@bitbucket\.org:([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }

    return null;
  }

  buildCloneUrl(owner: string, repo: string): string {
    return `https://bitbucket.org/${owner}/${repo}.git`;
  }
}

export const bitbucketProvider = new BitbucketProvider();
