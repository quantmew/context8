import Link from 'next/link';
import { FileCode, Hash, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/common/code-block';
import { getLanguageColor } from '@/lib/utils';

interface SearchResult {
  id: string | number;
  score: number;
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  chunkType: string;
  symbolName: string | null;
  content: string;
  summary?: string;
  keywords?: string[];
  projectId: string;
  projectName: string;
}

interface ResultCardProps {
  result: SearchResult;
}

export function ResultCard({ result }: ResultCardProps) {
  const scorePercent = Math.round(result.score * 100);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Link
                href={`/projects/${result.projectId}/files/${result.filePath.split('/').map(encodeURIComponent).join('/')}`}
                className="font-mono text-sm hover:underline truncate"
              >
                {result.filePath}:{result.startLine}-{result.endLine}
              </Link>
            </div>
            {result.symbolName && (
              <p className="text-sm font-medium mt-1 flex items-center gap-1">
                <Hash className="h-3 w-3" />
                {result.symbolName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge
              variant="outline"
              style={{
                borderColor: getLanguageColor(result.language),
                color: getLanguageColor(result.language),
              }}
            >
              {result.language}
            </Badge>
            <Badge variant="secondary">{scorePercent}%</Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {result.projectName} &bull; {result.chunkType}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="code-block bg-muted/50 rounded-lg overflow-hidden">
          <CodeBlock
            code={result.content}
            language={result.language}
            startLine={result.startLine}
          />
        </div>
        {result.summary && (
          <div className="mt-3 text-sm">
            <p className="text-muted-foreground">{result.summary}</p>
          </div>
        )}
        {result.keywords && result.keywords.length > 0 && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Tag className="h-3 w-3 text-muted-foreground" />
            {result.keywords.slice(0, 5).map((keyword) => (
              <Badge key={keyword} variant="outline" className="text-xs">
                {keyword}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
