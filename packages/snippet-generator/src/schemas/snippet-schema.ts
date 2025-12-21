import { z } from 'zod';

/**
 * Schema for a single code snippet
 */
export const SnippetSchema = z.object({
  title: z.string().describe('Task-oriented title, e.g., "How to install dependencies"'),
  description: z.string().describe('1-2 sentence context description explaining what this code does'),
  content: z.string().describe('The actual code content'),
  language: z.string().describe('Programming language of the code'),
  category: z.enum([
    'INSTALLATION',
    'ARCHITECTURE',
    'API_USAGE',
    'WORKFLOW',
    'EXAMPLE',
    'TROUBLESHOOT',
    'OTHER',
  ]).describe('Category of the snippet'),
  keywords: z.array(z.string()).describe('Keywords for search'),
  sourceFilePath: z.string().describe('Relative path to the source file'),
  startLine: z.number().optional().describe('Starting line number in the source file'),
  endLine: z.number().optional().describe('Ending line number in the source file'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional()
    .describe('Skill level required to understand this snippet'),
  isExtracted: z.boolean().optional()
    .describe('True if extracted from existing docs, false if synthesized'),
});

export type Snippet = z.infer<typeof SnippetSchema>;

/**
 * Schema for Q&A items
 */
export const QAItemSchema = z.object({
  question: z.string().describe('A common question about the project'),
  answer: z.string().describe('Detailed answer to the question'),
});

export type QAItem = z.infer<typeof QAItemSchema>;

/**
 * Schema for module information in architecture
 */
export const ModuleSchema = z.object({
  name: z.string().describe('Name of the module'),
  purpose: z.string().describe('Purpose of the module'),
  dependencies: z.array(z.string()).describe('Dependencies of the module'),
});

/**
 * Schema for architecture information
 */
export const ArchitectureSchema = z.object({
  summary: z.string().describe('One-paragraph architecture summary'),
  modules: z.array(ModuleSchema).describe('Key modules and their relationships'),
  entryPoints: z.array(z.string()).describe('Main entry points for developers'),
});

/**
 * Schema for the complete generation result from Claude Agent
 */
export const GenerationResultSchema = z.object({
  projectName: z.string().describe('Name of the project'),
  projectOverview: z.string().describe('High-level overview of the project'),
  architecture: ArchitectureSchema.optional().describe('Project architecture information'),
  snippets: z.array(SnippetSchema).describe('Generated code snippets'),
  qaItems: z.array(QAItemSchema).optional().describe('Frequently asked questions'),
});

export type GenerationResult = z.infer<typeof GenerationResultSchema>;
