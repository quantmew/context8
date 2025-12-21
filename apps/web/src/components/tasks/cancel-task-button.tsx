'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { XCircle, Loader2 } from 'lucide-react';

interface CancelTaskButtonProps {
  taskId: string;
  taskStatus: string;
  onCancelled?: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
}

export function CancelTaskButton({
  taskId,
  taskStatus,
  onCancelled,
  variant = 'destructive',
  size = 'sm',
  className,
  showLabel = true,
}: CancelTaskButtonProps) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCancel = taskStatus === 'PENDING' || taskStatus === 'RUNNING';

  const handleCancel = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation if inside a Link
    e.stopPropagation();

    if (!canCancel || isCancelling) return;

    setIsCancelling(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}/cancel`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel task');
      }

      onCancelled?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsCancelling(false);
    }
  };

  if (!canCancel) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        variant={variant}
        size={size}
        onClick={handleCancel}
        disabled={isCancelling}
        className={className}
        title="Cancel this task"
      >
        {isCancelling ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
        {showLabel && <span className="ml-1">Cancel</span>}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
