import { ProjectCard } from './project-card';

interface Project {
  id: string;
  name: string;
  path: string;
  indexingStatus: 'PENDING' | 'INDEXING' | 'READY' | 'ERROR';
  fileCount: number;
  chunkCount: number;
  summaryCount: number;
  lastIndexedAt: Date | null;
  indexError: string | null;
}

interface ProjectListProps {
  projects: Project[];
}

export function ProjectList({ projects }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">No projects indexed yet.</p>
        <p className="text-muted-foreground text-sm mt-2">
          Use the CLI to index a project: <code className="bg-muted px-2 py-1 rounded">context8 index --path /your/project</code>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
