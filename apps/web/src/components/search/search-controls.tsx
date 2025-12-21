'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Code, FileText, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTokenCount } from '@/lib/tokens';

interface SearchControlsProps {
  topic: string;
  mode: 'code' | 'info' | undefined;
  tokenLimit: number | undefined;
  onTopicChange: (topic: string) => void;
  onModeChange: (mode: 'code' | 'info' | undefined) => void;
  onTokenLimitChange: (limit: number | undefined) => void;
}

const TOKEN_PRESETS = [
  { label: 'No limit', value: undefined },
  { label: '8K', value: 8000 },
  { label: '16K', value: 16000 },
  { label: '32K', value: 32000 },
  { label: '64K', value: 64000 },
  { label: '128K', value: 128000 },
];

export function SearchControls({
  topic,
  mode,
  tokenLimit,
  onTopicChange,
  onModeChange,
  onTokenLimitChange,
}: SearchControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border">
      {/* Topic Input */}
      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Show doc for</span>
        <Input
          placeholder="e.g., hooks, routing, authentication..."
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center gap-1 bg-background rounded-md border border-border p-0.5">
        <Button
          variant={mode === 'code' ? 'default' : 'ghost'}
          size="sm"
          className={cn('h-7 px-3 text-xs gap-1', mode !== 'code' && 'text-muted-foreground')}
          onClick={() => onModeChange(mode === 'code' ? undefined : 'code')}
        >
          <Code className="h-3 w-3" />
          Code
        </Button>
        <Button
          variant={mode === 'info' ? 'default' : 'ghost'}
          size="sm"
          className={cn('h-7 px-3 text-xs gap-1', mode !== 'info' && 'text-muted-foreground')}
          onClick={() => onModeChange(mode === 'info' ? undefined : 'info')}
        >
          <FileText className="h-3 w-3" />
          Info
        </Button>
      </div>

      {/* Token Limit Selector */}
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Tokens:</span>
        <div className="flex items-center gap-1">
          {TOKEN_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant={tokenLimit === preset.value ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onTokenLimitChange(preset.value)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface SearchStatsProps {
  total: number;
  returned: number;
  totalTokens: number;
  wasTruncated: boolean;
  queryTimeMs: number;
  query: string;
}

export function SearchStats({
  total,
  returned,
  totalTokens,
  wasTruncated,
  queryTimeMs,
  query,
}: SearchStatsProps) {
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {wasTruncated ? (
          <>
            Showing <strong>{returned}</strong> of <strong>{total}</strong> results
            {' '}({formatTokenCount(totalTokens)} tokens)
          </>
        ) : (
          <>
            Found <strong>{total}</strong> result{total !== 1 ? 's' : ''} for &quot;{query}&quot;
            {totalTokens > 0 && <> ({formatTokenCount(totalTokens)} tokens)</>}
          </>
        )}
      </span>
      <span className="flex items-center gap-1">
        {queryTimeMs}ms
      </span>
    </div>
  );
}
