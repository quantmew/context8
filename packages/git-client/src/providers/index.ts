export * from './types.js';
export * from './github.js';
export * from './gitlab.js';
export * from './bitbucket.js';

import type { RepoProvider } from './types.js';
import { githubProvider } from './github.js';
import { gitlabProvider } from './gitlab.js';
import { bitbucketProvider } from './bitbucket.js';

export type ProviderType = 'GITHUB' | 'GITLAB' | 'BITBUCKET';

const providers: Record<ProviderType, RepoProvider> = {
  GITHUB: githubProvider,
  GITLAB: gitlabProvider,
  BITBUCKET: bitbucketProvider,
};

export function getProvider(type: ProviderType): RepoProvider {
  return providers[type];
}

export function detectProvider(url: string): ProviderType | null {
  if (url.includes('github.com') || url.includes('github')) {
    return 'GITHUB';
  }
  if (url.includes('gitlab.com') || url.includes('gitlab')) {
    return 'GITLAB';
  }
  if (url.includes('bitbucket.org') || url.includes('bitbucket')) {
    return 'BITBUCKET';
  }
  return null;
}
