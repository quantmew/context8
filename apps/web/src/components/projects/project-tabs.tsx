'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SnippetViewer } from '@/components/snippets/snippet-viewer';
import { WikiViewer } from '@/components/wiki/wiki-viewer';
import { ProjectTaskSection } from '@/components/projects/project-task-section';
import { FileCode, Folder, BookOpen, Settings, BookText } from 'lucide-react';
import Link from 'next/link';

interface LanguageStat {
  language: string | null;
  _count: { language: number };
}

interface FileInfo {
  id: string;
  filePath: string;
}

interface ProjectTabsProps {
  projectId: string;
  projectName: string;
  projectPath: string;
  indexingStatus: string;
  snippetCount: number;
  snippetStatus: string;
  wikiPageCount: number;
  wikiStatus: string;
  languageStats: LanguageStat[];
  recentFiles: FileInfo[];
}

export function ProjectTabs({
  projectId,
  projectName,
  projectPath,
  indexingStatus,
  snippetCount,
  snippetStatus,
  wikiPageCount,
  wikiStatus,
  languageStats,
  recentFiles,
}: ProjectTabsProps) {
  return (
    <Tabs defaultValue="context" className="w-full">
      <TabsList className="grid w-full grid-cols-4 lg:w-[520px]">
        <TabsTrigger value="context" className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Context
          {snippetCount > 0 && (
            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs">
              {snippetCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="wiki" className="flex items-center gap-2">
          <BookText className="h-4 w-4" />
          Wiki
          {wikiPageCount > 0 && (
            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs">
              {wikiPageCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="files" className="flex items-center gap-2">
          <Folder className="h-4 w-4" />
          Files
        </TabsTrigger>
        <TabsTrigger value="settings" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Indexing
        </TabsTrigger>
      </TabsList>

      <TabsContent value="context" className="mt-6">
        <SnippetViewer projectId={projectId} />
      </TabsContent>

      <TabsContent value="wiki" className="mt-6">
        <WikiViewer projectId={projectId} />
      </TabsContent>

      <TabsContent value="files" className="mt-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode className="h-5 w-5" />
                Languages
              </CardTitle>
            </CardHeader>
            <CardContent>
              {languageStats.length > 0 ? (
                <div className="space-y-2">
                  {languageStats.map((stat) => (
                    <div key={stat.language ?? 'unknown'} className="flex items-center justify-between">
                      <span className="text-sm">{stat.language ?? 'Unknown'}</span>
                      <span className="text-sm text-muted-foreground">{stat._count.language} files</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No language data available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Folder className="h-5 w-5" />
                Recent Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentFiles.length > 0 ? (
                <div className="space-y-2">
                  {recentFiles.map((file) => (
                    <Link
                      key={file.id}
                      href={'/projects/' + projectId + '/files/' + file.filePath.split('/').map(encodeURIComponent).join('/')}
                      className="flex items-center gap-2 text-sm hover:underline truncate"
                    >
                      <FileCode className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{file.filePath}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No files indexed yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="settings" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Indexing & Generation</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectTaskSection
              projectId={projectId}
              projectName={projectName}
              projectPath={projectPath}
              indexingStatus={indexingStatus}
              snippetStatus={snippetStatus}
              wikiStatus={wikiStatus}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
