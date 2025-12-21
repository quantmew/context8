'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Github, GitlabIcon as Gitlab, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Provider = 'GITHUB' | 'GITLAB' | 'BITBUCKET';

interface AddRemoteSourceDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PROVIDERS = [
  { id: 'GITHUB' as Provider, name: 'GitHub', icon: Github },
  { id: 'GITLAB' as Provider, name: 'GitLab', icon: Gitlab },
  { id: 'BITBUCKET' as Provider, name: 'Bitbucket', icon: Github }, // Using Github icon as placeholder
];

export function AddRemoteSourceDialog({ open, onClose, onSuccess }: AddRemoteSourceDialogProps) {
  const [provider, setProvider] = useState<Provider>('GITHUB');
  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    info?: { fullName: string; description: string; defaultBranch: string };
    error?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = useCallback(async () => {
    if (!repoUrl) return;
    // Token is required for GitLab and Bitbucket, optional for GitHub
    if (!token && provider !== 'GITHUB') return;

    setIsValidating(true);
    setValidationResult(null);
    setError(null);

    try {
      const response = await fetch('/api/sources/remote/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, repoUrl, token }),
      });

      const data = await response.json();
      setValidationResult(data);
    } catch (err) {
      setError('Failed to validate repository');
    } finally {
      setIsValidating(false);
    }
  }, [provider, repoUrl, token]);

  const handleSubmit = useCallback(async () => {
    if (!validationResult?.valid || !validationResult.info) return;

    setIsSubmitting(true);
    setError(null);

    try {
      let credentialId: string | undefined;

      // Save the credential only if token is provided
      if (token) {
        const credResponse = await fetch('/api/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            name: `${provider} - ${validationResult.info.fullName}`,
            token,
          }),
        });

        if (!credResponse.ok) {
          const data = await credResponse.json();
          throw new Error(data.error || 'Failed to save credential');
        }

        const credData = await credResponse.json();
        credentialId = credData.credential.id;
      }

      // Create the remote source
      const sourceResponse = await fetch('/api/sources/remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          repoUrl,
          fullName: validationResult.info.fullName,
          description: validationResult.info.description,
          defaultBranch: validationResult.info.defaultBranch,
          credentialId,
        }),
      });

      if (!sourceResponse.ok) {
        const data = await sourceResponse.json();
        throw new Error(data.error || 'Failed to add repository');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add repository');
    } finally {
      setIsSubmitting(false);
    }
  }, [provider, repoUrl, token, validationResult, onSuccess, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-lg p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Add Remote Repository</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Connect a private repository from GitHub, GitLab, or Bitbucket
          </p>
        </div>

        {/* Provider Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Provider</label>
          <div className="flex gap-2">
            {PROVIDERS.map((p) => (
              <Button
                key={p.id}
                variant={provider === p.id ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-2"
                onClick={() => {
                  setProvider(p.id);
                  setValidationResult(null);
                }}
              >
                <p.icon className="h-4 w-4" />
                {p.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Repository URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Repository URL</label>
          <Input
            placeholder="https://github.com/owner/repo or owner/repo"
            value={repoUrl}
            onChange={(e) => {
              setRepoUrl(e.target.value);
              setValidationResult(null);
            }}
          />
        </div>

        {/* Access Token */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Access Token
            {provider === 'GITHUB' && (
              <span className="text-muted-foreground font-normal ml-1">(optional for public repos)</span>
            )}
          </label>
          <Input
            type="password"
            placeholder={provider === 'GITHUB' ? 'ghp_xxxx (optional for public repos)' : 'Required for private repos'}
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setValidationResult(null);
            }}
          />
          <p className="text-xs text-muted-foreground">
            {provider === 'GITHUB'
              ? 'Token is optional for public repos, required for private repos'
              : 'Token needs read access to the repository'}
          </p>
        </div>

        {/* Validation Status */}
        {validationResult && (
          <div
            className={cn(
              'p-3 rounded-md text-sm',
              validationResult.valid
                ? 'bg-green-500/10 text-green-600'
                : 'bg-red-500/10 text-red-600'
            )}
          >
            {validationResult.valid ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                <div>
                  <p className="font-medium">{validationResult.info?.fullName}</p>
                  <p className="text-xs opacity-75">
                    {validationResult.info?.description || 'No description'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                <span>{validationResult.error}</span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-md bg-red-500/10 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          {!validationResult?.valid ? (
            <Button
              onClick={handleValidate}
              disabled={!repoUrl || (provider !== 'GITHUB' && !token) || isValidating}
            >
              {isValidating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Validate
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Repository
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
