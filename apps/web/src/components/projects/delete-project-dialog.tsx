'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';

interface DeleteProjectDialogProps {
  open: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteProjectDialog({
  open,
  projectId,
  projectName,
  onClose,
  onDeleted,
}: DeleteProjectDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsForce, setNeedsForce] = useState(false);

  const handleDelete = useCallback(
    async (force = false) => {
      setIsDeleting(true);
      setError(null);

      try {
        const url = force
          ? `/api/projects/${projectId}?force=true`
          : `/api/projects/${projectId}`;

        const response = await fetch(url, {
          method: 'DELETE',
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 409) {
            // Running tasks, offer force option
            setNeedsForce(true);
            setError(data.error || 'Project has running tasks');
          } else {
            throw new Error(data.error || 'Failed to delete project');
          }
          return;
        }

        onDeleted();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete project');
      } finally {
        setIsDeleting(false);
      }
    },
    [projectId, onDeleted, onClose]
  );

  const handleClose = useCallback(() => {
    if (!isDeleting) {
      setError(null);
      setNeedsForce(false);
      onClose();
    }
  }, [isDeleting, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-full bg-red-500/10">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Delete Project</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Are you sure you want to delete <strong>{projectName}</strong>?
            </p>
          </div>
        </div>

        <div className="p-3 rounded-md bg-muted text-sm space-y-1">
          <p>This will permanently delete:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
            <li>All indexed files and chunks</li>
            <li>Generated snippets and wiki pages</li>
            <li>Vector embeddings</li>
            <li>Task history</li>
          </ul>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-500/10 text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
            Cancel
          </Button>
          {needsForce ? (
            <Button
              variant="destructive"
              onClick={() => handleDelete(true)}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Force Delete
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => handleDelete(false)}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
