'use client';

import { Search, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface HeroSectionProps {
  onSearch?: (query: string) => void;
}

export function HeroSection({ onSearch }: HeroSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) {
      if (onSearch) {
        onSearch(searchQuery);
      } else {
        router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      }
    }
  }, [searchQuery, onSearch, router]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
    },
    [handleSearch]
  );

  return (
    <div className="text-center space-y-6 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          Private Docs
        </h1>
        <h2 className="text-2xl font-semibold text-foreground">
          for LLMs and AI Code Editors
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Index your private codebase and documentation — query with Cursor, Claude, or other LLMs
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 max-w-xl mx-auto">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search a library (e.g. my-project, backend)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10 h-11"
          />
        </div>
        <span className="text-muted-foreground text-sm">or</span>
        <Button
          variant="outline"
          className="h-11 gap-2"
          onClick={() => router.push('/chat')}
        >
          <MessageSquare className="h-4 w-4" />
          Chat with Docs
        </Button>
      </div>
    </div>
  );
}
