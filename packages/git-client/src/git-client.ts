import { simpleGit, SimpleGit, CloneOptions } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

export interface CloneResult {
  localPath: string;
  commitSha: string;
  branch: string;
}

export interface PullResult {
  commitSha: string;
  hasChanges: boolean;
  changedFiles: string[];
}

export interface GitClientOptions {
  basePath?: string;
  timeout?: number;
}

const DEFAULT_BASE_PATH = path.join(os.homedir(), '.context8', 'repos');
const DEFAULT_TIMEOUT = 300000; // 5 minutes

export class GitClient {
  private basePath: string;
  private timeout: number;

  constructor(options: GitClientOptions = {}) {
    this.basePath = options.basePath || process.env.CLONE_BASE_PATH || DEFAULT_BASE_PATH;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
  }

  private async ensureBaseDir(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  private getRepoPath(fullName: string): string {
    // Convert owner/repo to owner_repo for filesystem safety
    const safeName = fullName.replace(/\//g, '_');
    return path.join(this.basePath, safeName);
  }

  private createGit(cwd?: string): SimpleGit {
    return simpleGit({
      baseDir: cwd,
      binary: 'git',
      maxConcurrentProcesses: 1,
      timeout: { block: this.timeout },
    });
  }

  private buildAuthUrl(repoUrl: string, token?: string): string {
    if (!token) return repoUrl;

    const url = new URL(repoUrl);
    // Format: https://token@github.com/owner/repo.git
    url.username = token;
    url.password = 'x-oauth-basic';
    return url.toString();
  }

  async clone(
    repoUrl: string,
    fullName: string,
    options: { token?: string; branch?: string } = {}
  ): Promise<CloneResult> {
    await this.ensureBaseDir();

    const localPath = this.getRepoPath(fullName);
    const authUrl = this.buildAuthUrl(repoUrl, options.token);

    // Remove existing directory if it exists
    try {
      await fs.rm(localPath, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }

    const git = this.createGit();
    const cloneOptions: CloneOptions = {
      '--depth': 1,
      '--single-branch': null,
    };

    if (options.branch) {
      cloneOptions['--branch'] = options.branch;
    }

    await git.clone(authUrl, localPath, cloneOptions);

    // Get current commit SHA
    const repoGit = this.createGit(localPath);
    const log = await repoGit.log({ maxCount: 1 });
    const commitSha = log.latest?.hash || '';
    const branch = options.branch || 'main';

    return {
      localPath,
      commitSha,
      branch,
    };
  }

  async pull(
    localPath: string,
    options: { token?: string; remoteUrl?: string } = {}
  ): Promise<PullResult> {
    const git = this.createGit(localPath);

    // Get current commit before pull
    const beforeLog = await git.log({ maxCount: 1 });
    const beforeSha = beforeLog.latest?.hash || '';

    // Update remote URL with token if provided
    if (options.token && options.remoteUrl) {
      const authUrl = this.buildAuthUrl(options.remoteUrl, options.token);
      await git.remote(['set-url', 'origin', authUrl]);
    }

    // Perform pull
    await git.pull();

    // Get current commit after pull
    const afterLog = await git.log({ maxCount: 1 });
    const commitSha = afterLog.latest?.hash || '';

    // Get changed files if there were changes
    let changedFiles: string[] = [];
    if (beforeSha !== commitSha) {
      const diff = await git.diffSummary([beforeSha, commitSha]);
      changedFiles = diff.files.map((f) => f.file);
    }

    return {
      commitSha,
      hasChanges: beforeSha !== commitSha,
      changedFiles,
    };
  }

  async getChangedFiles(
    localPath: string,
    fromSha: string,
    toSha: string = 'HEAD'
  ): Promise<string[]> {
    const git = this.createGit(localPath);
    const diff = await git.diffSummary([fromSha, toSha]);
    return diff.files.map((f) => f.file);
  }

  async getCurrentCommit(localPath: string): Promise<string> {
    const git = this.createGit(localPath);
    const log = await git.log({ maxCount: 1 });
    return log.latest?.hash || '';
  }

  async getCurrentBranch(localPath: string): Promise<string> {
    const git = this.createGit(localPath);
    const branch = await git.branchLocal();
    return branch.current;
  }

  async exists(localPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(localPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async remove(localPath: string): Promise<void> {
    await fs.rm(localPath, { recursive: true, force: true });
  }

  getLocalPath(fullName: string): string {
    return this.getRepoPath(fullName);
  }
}

export const gitClient = new GitClient();
