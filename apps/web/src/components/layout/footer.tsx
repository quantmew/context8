import { Database } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t py-6 md:py-0">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-14 md:flex-row mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Database className="h-4 w-4" />
          <span>Context8 - Private Codebase Indexing</span>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Built for AI-assisted development
        </p>
      </div>
    </footer>
  );
}
