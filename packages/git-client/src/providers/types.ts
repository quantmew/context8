export interface RepoInfo {
  fullName: string;
  description: string | null;
  defaultBranch: string;
  isPrivate: boolean;
  cloneUrl: string;
  htmlUrl: string;
}

export interface RepoProvider {
  name: string;
  validateToken(token: string): Promise<boolean>;
  getRepoInfo(fullName: string, token: string): Promise<RepoInfo>;
  parseRepoUrl(url: string): { owner: string; repo: string } | null;
  buildCloneUrl(owner: string, repo: string): string;
}
