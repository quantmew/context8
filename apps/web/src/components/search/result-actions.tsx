'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, FileCode, Link } from 'lucide-react';
import type { SearchResult } from '@/hooks/use-search';

interface ResultActionsProps {
  results: SearchResult[];
  className?: string;
}

export function ResultActions({ results, className }: ResultActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const content = results
      .map((r) => {
        const header = `// ${r.filePath}:${r.startLine}-${r.endLine}`;
        return `${header}\n${r.content}`;
      })
      .join('\n\n---\n\n');

    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [results]);

  const handleCopyRaw = useCallback(async () => {
    const content = results.map((r) => r.content).join('\n\n');
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [results]);

  const handleCopyLinks = useCallback(async () => {
    const links = results
      .map((r) => `${r.projectName}: ${r.filePath}:${r.startLine}`)
      .join('\n');
    await navigator.clipboard.writeText(links);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [results]);

  if (results.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          Copy All
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={handleCopyRaw}
        >
          <FileCode className="h-3 w-3" />
          Raw
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={handleCopyLinks}
        >
          <Link className="h-3 w-3" />
          Links
        </Button>
      </div>
    </div>
  );
}

interface SingleResultActionsProps {
  result: SearchResult;
}

export function SingleResultActions({ result }: SingleResultActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result.content]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0"
      onClick={handleCopy}
      title="Copy code"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}
