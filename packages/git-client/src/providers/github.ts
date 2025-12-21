import type { RepoProvider, RepoInfo } from './types.js';

const GITHUB_API_URL = 'https://api.github.com';

export class GitHubProvider implements RepoProvider {
  name = 'github';

  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${GITHUB_API_URL}/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getRepoInfo(fullName: string, token: string): Promise<RepoInfo> {
    const response = await fetch(`${GITHUB_API_URL}/repos/${fullName}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Repository not found: ${fullName}`);
      }
      if (response.status === 401) {
        throw new Error('Invalid or expired GitHub token');
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json() as {
      full_name: string;
      description: string | null;
      default_branch: string;
      private: boolean;
      clone_url: string;
      html_url: string;
    };

    return {
      fullName: data.full_name,
      description: data.description,
      defaultBranch: data.default_branch,
      isPrivate: data.private,
      cloneUrl: data.clone_url,
      htmlUrl: data.html_url,
    };
  }

  parseRepoUrl(url: string): { owner: string; repo: string } | null {
    // Handle various GitHub URL formats:
    // https://github.com/owner/repo
    // https://github.com/owner/repo.git
    // git@github.com:owner/repo.git
    // owner/repo

    // Direct owner/repo format
    if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(url)) {
      const [owner, repo] = url.split('/');
      return { owner, repo: repo.replace(/\.git$/, '') };
    }

    // HTTPS URL
    const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/);
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }

    // SSH URL
    const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }

    return null;
  }

  buildCloneUrl(owner: string, repo: string): string {
    return `https://github.com/${owner}/${repo}.git`;
  }
}

export const githubProvider = new GitHubProvider();
