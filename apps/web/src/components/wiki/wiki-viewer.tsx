'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownRenderer } from '@/components/common/markdown-renderer';
import {
  BookOpen,
  FileText,
  Loader2,
  ChevronRight,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WikiPage {
  id: string;
  pageId: string;
  title: string;
  content: string;
  importance: 'HIGH' | 'MEDIUM' | 'LOW';
  order: number;
  filePaths: string[];
  relatedPageIds: string[];
  parentPageId: string | null;
  isSection: boolean;
}

interface WikiStructure {
  id: string;
  title: string;
  description: string;
  status: string;
}

interface WikiViewerProps {
  projectId: string;
}

const IMPORTANCE_STYLES = {
  HIGH: 'bg-red-500/20 text-red-400 border-red-500/30',
  MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

interface PageTreeItem extends WikiPage {
  children: PageTreeItem[];
}

function buildPageTree(pages: WikiPage[]): PageTreeItem[] {
  const pageMap = new Map<string, PageTreeItem>();
  const rootPages: PageTreeItem[] = [];

  // First pass: create all nodes
  pages.forEach((page) => {
    pageMap.set(page.pageId, { ...page, children: [] });
  });

  // Second pass: build tree structure
  pages.forEach((page) => {
    const node = pageMap.get(page.pageId)!;
    if (page.parentPageId && pageMap.has(page.parentPageId)) {
      pageMap.get(page.parentPageId)!.children.push(node);
    } else {
      rootPages.push(node);
    }
  });

  return rootPages;
}

function PageTreeNode({
  page,
  level,
  selectedPageId,
  onSelect,
}: {
  page: PageTreeItem;
  level: number;
  selectedPageId: string | null;
  onSelect: (pageId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = page.children.length > 0;
  const isSelected = selectedPageId === page.pageId;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) {
            setIsExpanded(!isExpanded);
          }
          onSelect(page.pageId);
        }}
        className={cn(
          'w-full text-left px-3 py-2 text-sm rounded-md flex items-center gap-2 transition-colors',
          isSelected
            ? 'bg-primary/20 text-primary'
            : 'hover:bg-muted text-foreground/80 hover:text-foreground'
        )}
        style={{ paddingLeft: `${level * 12 + 12}px` }}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )
        ) : (
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{page.title}</span>
      </button>
      {hasChildren && isExpanded && (
        <div>
          {page.children.map((child) => (
            <PageTreeNode
              key={child.pageId}
              page={child}
              level={level + 1}
              selectedPageId={selectedPageId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function WikiViewer({ projectId }: WikiViewerProps) {
  const [wiki, setWiki] = useState<{
    structure: WikiStructure;
    pages: WikiPage[];
  } | null>(null);
  const [wikiStatus, setWikiStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWiki();
  }, [projectId]);

  const fetchWiki = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/wiki`);
      if (!res.ok) throw new Error('Failed to fetch wiki');

      const data = await res.json();
      setWikiStatus(data.project.wikiStatus);

      if (data.wiki) {
        setWiki(data.wiki);
        // Select first page by default
        if (data.wiki.pages.length > 0 && !selectedPageId) {
          setSelectedPageId(data.wiki.pages[0].pageId);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Handle generating states
  if (
    wikiStatus === 'PENDING' ||
    wikiStatus === 'GENERATING_STRUCTURE' ||
    wikiStatus === 'GENERATING_PAGES'
  ) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            {wikiStatus === 'PENDING' ? (
              <>
                <BookOpen className="h-12 w-12 text-muted-foreground" />
                <div>
                  <p className="font-medium">Wiki not generated yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Generate wiki documentation from the Indexing tab below.
                  </p>
                </div>
              </>
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {wikiStatus === 'GENERATING_STRUCTURE'
                      ? 'Analyzing codebase structure...'
                      : 'Generating wiki pages...'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This may take a few minutes depending on project size.
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle error state
  if (wikiStatus === 'ERROR' || error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Wiki generation failed</p>
              <p className="text-sm text-muted-foreground mt-1">
                {error || 'An error occurred during wiki generation. Try regenerating.'}
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
          <div className="flex gap-4">
            <Skeleton className="h-[400px] w-64" />
            <Skeleton className="h-[400px] flex-1" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!wiki || wiki.pages.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center space-y-2">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
            <p className="font-medium">No wiki pages found</p>
            <p className="text-sm text-muted-foreground">
              Generate wiki documentation from the Indexing tab to see content here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pageTree = buildPageTree(wiki.pages);
  const selectedPage = wiki.pages.find((p) => p.pageId === selectedPageId);

  return (
    <div className="flex gap-4 h-[700px]">
      {/* Sidebar */}
      <Card className="w-72 shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {wiki.structure.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {wiki.structure.description}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[550px]">
            <div className="p-2">
              {pageTree.map((page) => (
                <PageTreeNode
                  key={page.pageId}
                  page={page}
                  level={0}
                  selectedPageId={selectedPageId}
                  onSelect={setSelectedPageId}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Content Area */}
      <Card className="flex-1 overflow-hidden">
        {selectedPage ? (
          <>
            <CardHeader className="pb-2 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{selectedPage.title}</CardTitle>
                <Badge
                  variant="outline"
                  className={IMPORTANCE_STYLES[selectedPage.importance]}
                >
                  {selectedPage.importance}
                </Badge>
              </div>
              {selectedPage.filePaths.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedPage.filePaths.slice(0, 5).map((path) => (
                    <Badge
                      key={path}
                      variant="secondary"
                      className="text-xs font-mono"
                    >
                      {path.split('/').pop()}
                    </Badge>
                  ))}
                  {selectedPage.filePaths.length > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      +{selectedPage.filePaths.length - 5} more
                    </Badge>
                  )}
                </div>
              )}
            </CardHeader>
            <ScrollArea className="h-[600px]">
              <CardContent className="pt-4">
                <MarkdownRenderer content={selectedPage.content} />
              </CardContent>
            </ScrollArea>
          </>
        ) : (
          <CardContent className="h-full flex items-center justify-center text-muted-foreground">
            Select a page from the sidebar
          </CardContent>
        )}
      </Card>
    </div>
  );
}
