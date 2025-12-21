import type { RepoProvider, RepoInfo } from './types.js';

const GITLAB_API_URL = 'https://gitlab.com/api/v4';

export class GitLabProvider implements RepoProvider {
  name = 'gitlab';

  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${GITLAB_API_URL}/user`, {
        headers: {
          'PRIVATE-TOKEN': token,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getRepoInfo(fullName: string, token: string): Promise<RepoInfo> {
    // GitLab uses URL-encoded project path
    const encodedPath = encodeURIComponent(fullName);
    const response = await fetch(`${GITLAB_API_URL}/projects/${encodedPath}`, {
      headers: {
        'PRIVATE-TOKEN': token,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Repository not found: ${fullName}`);
      }
      if (response.status === 401) {
        throw new Error('Invalid or expired GitLab token');
      }
      throw new Error(`GitLab API error: ${response.status}`);
    }

    const data = await response.json() as {
      path_with_namespace: string;
      description: string | null;
      default_branch: string;
      visibility: string;
      http_url_to_repo: string;
      web_url: string;
    };

    return {
      fullName: data.path_with_namespace,
      description: data.description,
      defaultBranch: data.default_branch,
      isPrivate: data.visibility === 'private',
      cloneUrl: data.http_url_to_repo,
      htmlUrl: data.web_url,
    };
  }

  parseRepoUrl(url: string): { owner: string; repo: string } | null {
    // Handle various GitLab URL formats:
    // https://gitlab.com/owner/repo
    // https://gitlab.com/owner/repo.git
    // https://gitlab.com/group/subgroup/repo
    // git@gitlab.com:owner/repo.git

    // Direct owner/repo format
    if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(url)) {
      const [owner, repo] = url.split('/');
      return { owner, repo: repo.replace(/\.git$/, '') };
    }

    // HTTPS URL (supports nested groups)
    const httpsMatch = url.match(/gitlab\.com\/(.+?)(?:\.git)?(?:\/)?$/);
    if (httpsMatch) {
      const path = httpsMatch[1].replace(/\.git$/, '');
      const parts = path.split('/');
      if (parts.length >= 2) {
        const repo = parts.pop()!;
        const owner = parts.join('/');
        return { owner, repo };
      }
    }

    // SSH URL
    const sshMatch = url.match(/git@gitlab\.com:(.+?)(?:\.git)?$/);
    if (sshMatch) {
      const path = sshMatch[1];
      const parts = path.split('/');
      if (parts.length >= 2) {
        const repo = parts.pop()!;
        const owner = parts.join('/');
        return { owner, repo };
      }
    }

    return null;
  }

  buildCloneUrl(owner: string, repo: string): string {
    return `https://gitlab.com/${owner}/${repo}.git`;
  }
}

export const gitlabProvider = new GitLabProvider();
