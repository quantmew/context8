'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  HeroSection,
  ProjectTabs,
  ProjectTable,
  StatsFooter,
  type TabValue,
  type Project,
} from '@/components/homepage';
import { AddRemoteSourceDialog } from '@/components/sources';

interface ApiResponse {
  projects: Project[];
  totalCount: number;
  runningTasksCount: number;
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<TabValue>(
    (searchParams.get('tab') as TabValue) || 'recent'
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [runningTasksCount, setRunningTasksCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddRemote, setShowAddRemote] = useState(false);

  const fetchProjects = useCallback(async (tab: TabValue) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects?tab=${tab}`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data: ApiResponse = await response.json();
      setProjects(data.projects);
      setTotalCount(data.totalCount);
      setRunningTasksCount(data.runningTasksCount);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects(activeTab);
  }, [activeTab, fetchProjects]);

  const handleTabChange = useCallback(
    (tab: TabValue) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const handleSearch = useCallback(
    (query: string) => {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    },
    [router]
  );

  const handleAddRemoteSuccess = useCallback(() => {
    fetchProjects(activeTab);
  }, [fetchProjects, activeTab]);

  return (
    <div className="space-y-6">
      <HeroSection onSearch={handleSearch} />

      <div className="space-y-4">
        <ProjectTabs activeTab={activeTab} onTabChange={handleTabChange} />
        <ProjectTable
          projects={projects}
          isLoading={isLoading}
          onProjectDeleted={() => fetchProjects(activeTab)}
        />
        <StatsFooter
          totalProjects={totalCount}
          runningTasks={runningTasksCount}
          onAddRemote={() => setShowAddRemote(true)}
        />
      </div>

      <AddRemoteSourceDialog
        open={showAddRemote}
        onClose={() => setShowAddRemote(false)}
        onSuccess={handleAddRemoteSuccess}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="space-y-6"><div className="animate-pulse">Loading...</div></div>}>
      <HomePageContent />
    </Suspense>
  );
}
