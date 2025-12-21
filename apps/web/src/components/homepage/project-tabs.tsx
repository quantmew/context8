'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, Clock, List } from 'lucide-react';

export type TabValue = 'recent' | 'popular' | 'all';

interface ProjectTabsProps {
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
}

export function ProjectTabs({ activeTab, onTabChange }: ProjectTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as TabValue)}>
      <TabsList>
        <TabsTrigger value="recent" className="gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Recent
        </TabsTrigger>
        <TabsTrigger value="popular" className="gap-1.5">
          <Star className="h-3.5 w-3.5" />
          Popular
        </TabsTrigger>
        <TabsTrigger value="all" className="gap-1.5">
          <List className="h-3.5 w-3.5" />
          All
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
