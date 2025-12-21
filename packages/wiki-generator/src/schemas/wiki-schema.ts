import { z } from 'zod';

// Schema for wiki page outline (used in structure phase)
export const WikiPageOutlineSchema = z.object({
  id: z
    .string()
    .describe(
      'Unique page identifier using kebab-case (e.g., "getting-started", "architecture-overview", "api-authentication")'
    ),
  title: z.string().describe('Human-readable page title (e.g., "Getting Started", "Architecture Overview")'),
  description: z
    .string()
    .describe('Brief 1-2 sentence description of what this page covers'),
  filePaths: z
    .array(z.string())
    .describe(
      'Source files relevant to this page content (e.g., ["src/auth/index.ts", "src/auth/types.ts"])'
    ),
  importance: z
    .enum(['HIGH', 'MEDIUM', 'LOW'])
    .describe(
      'Page importance: HIGH for essential docs (getting started, architecture), MEDIUM for core features, LOW for advanced/optional topics'
    ),
  relatedPageIds: z
    .array(z.string())
    .describe('IDs of related pages that should be cross-referenced'),
  parentId: z
    .string()
    .optional()
    .describe('Parent page ID for hierarchical organization (sections)'),
  isSection: z
    .boolean()
    .default(false)
    .describe('Whether this is a section header that groups other pages'),
  childIds: z
    .array(z.string())
    .optional()
    .describe('Child page IDs if this is a section'),
});

// Schema for wiki structure (output of Phase 1)
export const WikiStructureOutputSchema = z.object({
  title: z.string().describe('Wiki title (usually the project name)'),
  description: z
    .string()
    .describe(
      'One-paragraph overview of the project and what this wiki covers'
    ),
  pages: z
    .array(WikiPageOutlineSchema)
    .describe(
      'Ordered list of 15-25 wiki pages covering: Getting Started, Architecture, Core Concepts, API Reference, Usage Guides, Advanced Topics, Troubleshooting'
    ),
});

// Schema for generated page content (output of Phase 2)
export const WikiPageContentSchema = z.object({
  pageId: z.string().describe('ID of the page being generated'),
  content: z
    .string()
    .describe(
      'Full markdown content including headings, Mermaid diagrams, code blocks, tables, and source citations'
    ),
  additionalFilePaths: z
    .array(z.string())
    .optional()
    .describe(
      'Additional source files discovered during content generation'
    ),
});

export type WikiPageOutline = z.infer<typeof WikiPageOutlineSchema>;
export type WikiStructureOutput = z.infer<typeof WikiStructureOutputSchema>;
export type WikiPageContent = z.infer<typeof WikiPageContentSchema>;
