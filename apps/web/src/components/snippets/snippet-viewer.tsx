'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, ExternalLink, FileText, Search, Loader2, Check } from 'lucide-react';

interface Snippet {
  id: string;
  title: string;
  description: string;
  content: string;
  language: string;
  sourceUrl: string | null;
  sourceFilePath: string;
  category: string;
  keywords: string[];
  tokenCount: number;
}

interface SnippetViewerProps {
  projectId: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  INSTALLATION: 'Installation',
  API_USAGE: 'API Usage',
  WORKFLOW: 'Workflow',
  EXAMPLE: 'Example',
  TROUBLESHOOT: 'Troubleshoot',
  OTHER: 'Other',
};

export function SnippetViewer({ projectId }: SnippetViewerProps) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [llmsTxt, setLlmsTxt] = useState<string>('');
  const [totalTokens, setTotalTokens] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [snippetStatus, setSnippetStatus] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchSnippets();
  }, [projectId, category]);

  const fetchSnippets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      if (search) params.set('search', search);

      const res = await fetch(
        '/api/projects/' + projectId + '/snippets?' + params.toString()
      );
      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();
      setSnippets(data.snippets);
      setLlmsTxt(data.llmsTxt);
      setTotalTokens(data.totalTokens);
      setSnippetStatus(data.project.snippetStatus);
    } catch (error) {
      console.error('Error fetching snippets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchSnippets();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(llmsTxt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([llmsTxt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'llms.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (snippetStatus === 'PENDING' || snippetStatus === 'GENERATING') {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <div>
              <p className="font-medium">
                {snippetStatus === 'GENERATING' ? 'Generating snippets...' : 'Snippets not generated yet'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {snippetStatus === 'GENERATING'
                  ? 'This may take a few minutes depending on project size.'
                  : 'Run snippet generation from the Indexing section below.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (snippets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center space-y-2">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="font-medium">No snippets found</p>
            <p className="text-sm text-muted-foreground">
              Generate snippets from the Indexing section to see documentation here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Show doc for...</label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. authentication, API, setup"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} variant="secondary">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="sm:w-48">
              <label className="text-sm font-medium mb-2 block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="all">All categories</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardContent className="py-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Tokens: <span className="font-medium text-foreground">{totalTokens.toLocaleString()}</span>
              </span>
              <span className="text-sm text-muted-foreground">
                Snippets: <span className="font-medium text-foreground">{snippets.length}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <ExternalLink className="h-4 w-4 mr-1" />
                Raw
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* llms.txt Content */}
          <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm overflow-auto max-h-[600px]">
            <pre className="whitespace-pre-wrap break-words">{llmsTxt}</pre>
          </div>

          {/* Category badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            {Object.entries(
              snippets.reduce((acc, s) => {
                acc[s.category] = (acc[s.category] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([cat, count]) => (
              <Badge key={cat} variant="secondary">
                {CATEGORY_LABELS[cat] || cat}: {count}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
