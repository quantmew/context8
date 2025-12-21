import Link from 'next/link';
import { FileCode, Layers, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime, getLanguageColor } from '@/lib/utils';

interface FileMetadata {
  id: string;
  filePath: string;
  language: string | null;
  chunkCount: number;
  hasSummary: boolean;
  lastIndexed: Date;
  size: number;
}

interface FileListProps {
  files: FileMetadata[];
  projectId: string;
}

export function FileList({ files, projectId }: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <FileCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground text-lg">No files found</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg divide-y">
      {files.map((file) => (
        <Link
          key={file.id}
          href={`/projects/${projectId}/files/${file.filePath.split('/').map(encodeURIComponent).join('/')}`}
          className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <FileCode className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-mono text-sm truncate">{file.filePath}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {file.chunkCount} chunks
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(file.lastIndexed)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {file.hasSummary && (
              <Badge variant="success" className="text-xs">
                Summary
              </Badge>
            )}
            {file.language && (
              <Badge
                variant="outline"
                style={{
                  borderColor: getLanguageColor(file.language),
                  color: getLanguageColor(file.language),
                }}
              >
                {file.language}
              </Badge>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
