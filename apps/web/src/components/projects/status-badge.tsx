import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type IndexingStatus = 'PENDING' | 'INDEXING' | 'READY' | 'ERROR';

interface StatusBadgeProps {
  status: IndexingStatus;
  className?: string;
}

const statusConfig: Record<
  IndexingStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info'; icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING: {
    label: 'Pending',
    variant: 'secondary',
    icon: Clock,
  },
  INDEXING: {
    label: 'Indexing',
    variant: 'info',
    icon: Loader2,
  },
  READY: {
    label: 'Ready',
    variant: 'success',
    icon: CheckCircle,
  },
  ERROR: {
    label: 'Error',
    variant: 'destructive',
    icon: AlertCircle,
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={cn('gap-1', className)}>
      <Icon
        className={cn('h-3 w-3', status === 'INDEXING' && 'animate-spin')}
      />
      {config.label}
    </Badge>
  );
}
