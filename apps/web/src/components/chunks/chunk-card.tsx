import { Hash, Tag, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/common/code-block';

interface ChunkCardProps {
  chunk: {
    id: string;
    chunkType: string;
    symbolName: string | null;
    startLine: number;
    endLine: number;
    content: string;
    language: string;
  };
  summary?: {
    text: string;
    keywords: string[];
  } | null;
}

export function ChunkCard({ chunk, summary }: ChunkCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {chunk.symbolName ? (
              <>
                <Hash className="h-4 w-4" />
                {chunk.symbolName}
              </>
            ) : (
              <span className="text-muted-foreground">Lines {chunk.startLine}-{chunk.endLine}</span>
            )}
          </CardTitle>
          <Badge variant="outline">{chunk.chunkType}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="code-block bg-muted/50 rounded-lg overflow-hidden">
          <CodeBlock
            code={chunk.content}
            language={chunk.language}
            startLine={chunk.startLine}
          />
        </div>

        {summary && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4 text-primary" />
              Summary
            </div>
            <p className="text-sm text-muted-foreground">{summary.text}</p>
            {summary.keywords.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-3 w-3 text-muted-foreground" />
                {summary.keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
