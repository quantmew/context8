import { query } from '@anthropic-ai/claude-agent-sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { snippetRepository, localSourceRepository, remoteSourceRepository } from '@context8/database';
import { createProvider, type IEmbeddingProvider } from '@context8/embedding';
import { QdrantClient } from '@context8/vector-store';
import { GenerationResultSchema, type GenerationResult, type Snippet } from '../schemas/snippet-schema.js';
import type {
  SnippetGenerationOptions,
  SnippetGenerationResult,
  SnippetData,
  ProgressCallback,
  PipelineConfig,
  SnippetCategory,
} from '../types.js';

const DEFAULT_MAX_SNIPPETS = 100;
const DEFAULT_MAX_TURNS = 50;

const AGENT_SYSTEM_PROMPT = `You are an expert Code Architect and Developer Advocate creating developer-centric documentation.

## Your Core Competencies
1. **Architecture Analysis**: Understand software architecture patterns, module boundaries, and API design
2. **Developer Empathy**: Think from a new developer's perspective - what do they need first?
3. **Problem-Driven Documentation**: Answer real developer questions: "How do I...?"

## Content Hierarchy (Priority Order)
1. Quick Start - Get running in minutes
2. Core Concepts - Mental model of the system
3. Common Tasks - 80% of daily developer needs
4. API Reference - Organized by use case
5. Advanced Patterns - For power users

## Extract vs Create Strategy
**EXTRACT** (Priority):
- README and getting started guides
- examples/ and docs/ directories
- JSDoc/docstrings with @example
- Configuration templates

**CREATE** (Fill Gaps):
- Synthesize usage scenarios from public APIs
- Create integration examples for core modules
- Generate troubleshooting guides from patterns

## Snippet Quality Standards
- **Problem-First Titles**: Always "How to..." format
- **Self-Contained**: Each snippet independently useful
- **Runnable**: Complete, copy-paste ready code
- **Contextual**: Include WHY and WHEN to use

## Anti-Patterns to Avoid
1. **No Single-Command Snippets**: Never create snippets with just one shell command
   - Bad: "Install JVM on Ubuntu" with just \`apt-get install default-jdk\`
   - Good: "Set up complete Java development environment" with all steps

2. **No Platform Fragmentation**: Don't create separate snippets for each OS
   - Bad: 4 snippets for "Install X on Ubuntu/macOS/Windows/Arch"
   - Good: 1 snippet "Install X" with platform-specific sections OR pick most common

3. **No API Documentation Format**: Don't use pseudo-code or APIDOC blocks
   - Bad: \`\`\`APIDOC method(): description\`\`\`
   - Good: Actual runnable code with comments

4. **Minimum Snippet Size**: Each snippet must have at least 3 meaningful lines of code

## Deduplication Rules
- If two snippets cover 80%+ similar content, merge them
- Prefer the more complete example when choosing between similar snippets
- For variations (e.g., with/without options), show the full-featured version`;

export class SnippetGenerationPipeline {
  private embeddingProvider: IEmbeddingProvider;
  private qdrant: QdrantClient;
  private progressCallback?: ProgressCallback;
  private agentModel: string;

  constructor(config: PipelineConfig) {
    this.embeddingProvider = createProvider({
      provider: config.embeddingConfig.provider as 'openai' | 'bigmodel' | 'voyage',
      apiKey: config.embeddingConfig.apiKey,
      baseUrl: config.embeddingConfig.baseUrl,
      model: config.embeddingConfig.model,
      dimensions: config.embeddingConfig.dimensions,
    });

    this.qdrant = new QdrantClient(
      {
        host: config.qdrantConfig.host,
        port: config.qdrantConfig.port,
        apiKey: config.qdrantConfig.apiKey,
      },
      config.qdrantConfig.collectionName
    );

    this.agentModel = config.agentModel ?? 'claude-sonnet-4-5';
  }

  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  async generate(options: SnippetGenerationOptions): Promise<SnippetGenerationResult> {
    const startTime = Date.now();
    const {
      sourceId,
      sourceType,
      sourcePath,
      maxSnippets = DEFAULT_MAX_SNIPPETS,
      maxTurns = DEFAULT_MAX_TURNS,
      abortSignal,
    } = options;

    // Helper to check abort signal
    const checkAbort = () => {
      if (abortSignal?.aborted) {
        throw new Error('Task cancelled');
      }
    };

    const errors: SnippetGenerationResult['errors'] = [];

    try {
      // Update status to GENERATING
      if (sourceType === 'REMOTE') {
        await remoteSourceRepository.update(sourceId, {
          snippetStatus: 'GENERATING' as never,
        });
      } else {
        await localSourceRepository.update(sourceId, {
          snippetStatus: 'GENERATING' as never,
        });
      }

      this.emitProgress('exploring', 0, 1, undefined, 'Starting Claude Agent to explore codebase...');

      // Build the prompt for the agent
      const prompt = this.buildAgentPrompt(sourcePath, maxSnippets);

      // Get the JSON schema for structured output
      const schema = zodToJsonSchema(GenerationResultSchema, { $refStrategy: 'root' });

      let agentResult: GenerationResult | null = null;

      // Run the Claude Agent
      this.emitProgress('generating', 0, 1, undefined, 'Agent is analyzing the codebase...');

      for await (const message of query({
        prompt,
        options: {
          allowedTools: ['Read', 'Glob', 'Grep'],
          outputFormat: {
            type: 'json_schema',
            schema: schema,
          },
          permissionMode: 'acceptEdits',
          cwd: sourcePath,
          model: this.agentModel,
          maxTurns,
          systemPrompt: AGENT_SYSTEM_PROMPT,
        },
      })) {
        // Check for cancellation on each message
        checkAbort();

        // Log agent progress
        if (message.type === 'assistant' && message.message?.content) {
          for (const block of message.message.content) {
            if ('text' in block && block.text) {
              const agentMessage = block.text.slice(0, 500);
              console.log('[Agent]', agentMessage.slice(0, 200));
              this.emitProgress('agent', 0, 0, undefined, agentMessage);
            }
          }
        }

        // Get the final result
        if (message.type === 'result') {
          if (message.subtype === 'success' && message.structured_output) {
            agentResult = message.structured_output as GenerationResult;
          } else if (message.subtype === 'error_max_structured_output_retries') {
            throw new Error('Agent failed to produce valid structured output after retries');
          }
        }
      }

      if (!agentResult) {
        throw new Error('Agent did not produce any output');
      }

      this.emitProgress('generating', 1, 1, undefined, `Agent generated ${agentResult.snippets.length} snippets`);

      // Convert to SnippetData format
      const snippetData: SnippetData[] = agentResult.snippets.map((s: Snippet) => ({
        title: s.title,
        description: s.description,
        content: s.content,
        language: s.language,
        sourceUrl: null,
        sourceFilePath: s.sourceFilePath,
        startLine: s.startLine ?? null,
        endLine: s.endLine ?? null,
        sourceChunkIds: [],
        category: s.category as SnippetCategory,
        keywords: s.keywords,
        tokenCount: Math.ceil(s.content.length / 4), // Rough token estimate
      }));

      // Store snippets
      checkAbort();
      this.emitProgress('storing', 0, snippetData.length, undefined, 'Storing snippets...');

      // Delete existing snippets for this source
      await snippetRepository.deleteBySourceId(sourceId);

      for (let idx = 0; idx < snippetData.length; idx++) {
        checkAbort(); // Check for cancellation before each snippet
        const snippet = snippetData[idx];

        this.emitProgress(
          'storing',
          idx,
          snippetData.length,
          snippet.sourceFilePath,
          `Storing snippet ${idx + 1}/${snippetData.length}...`
        );

        try {
          const saved = await snippetRepository.create({
            sourceId,
            sourceType,
            ...snippet,
          });

          // Create embedding and store in Qdrant
          const embeddingText = `${snippet.title}\n${snippet.description}\n${snippet.content}`;
          const embedding = await this.embeddingProvider.embed(embeddingText);

          await this.qdrant.upsert([
            {
              id: `snippet_${saved.id}`,
              vector: { dense: embedding },
              payload: {
                source_id: sourceId,
                chunk_type: 'snippet',
                snippet_id: saved.id,
                title: snippet.title,
                category: snippet.category,
                content: snippet.content,
                language: snippet.language,
                keywords: snippet.keywords,
                description: snippet.description,
                file_path: snippet.sourceFilePath,
              },
            },
          ]);

          await snippetRepository.updateVectorId(saved.id, `snippet_${saved.id}`);
        } catch (error) {
          errors.push({
            file: snippet.sourceFilePath,
            message: `Failed to store snippet: ${error instanceof Error ? error.message : 'Unknown'}`,
            recoverable: true,
          });
        }
      }

      // Update source status
      if (sourceType === 'REMOTE') {
        await remoteSourceRepository.update(sourceId, {
          snippetCount: snippetData.length,
          snippetStatus: 'READY' as never,
        });
      } else {
        await localSourceRepository.update(sourceId, {
          snippetCount: snippetData.length,
          snippetStatus: 'READY' as never,
        });
      }

      this.emitProgress('storing', snippetData.length, snippetData.length, undefined, 'Complete!');

      return {
        snippets: snippetData,
        projectName: agentResult.projectName,
        projectOverview: agentResult.projectOverview,
        qaItems: agentResult.qaItems || [],
        durationMs: Date.now() - startTime,
        errors,
      };
    } catch (error) {
      // Update status to ERROR
      if (sourceType === 'REMOTE') {
        await remoteSourceRepository.update(sourceId, {
          snippetStatus: 'ERROR' as never,
        });
      } else {
        await localSourceRepository.update(sourceId, {
          snippetStatus: 'ERROR' as never,
        });
      }

      throw error;
    }
  }

  private buildAgentPrompt(sourcePath: string, maxSnippets: number): string {
    return `# Documentation Generation Task

Analyze the codebase at \`${sourcePath}\` using a systematic four-phase approach.

---

## Phase 1: Project Discovery (Build Mental Model)
**Goal**: Understand the project's purpose, structure, and architecture.

1. **Read Project Identity**
   - Use Read on README.md for project overview
   - Check package.json for name, description, main entry

2. **Map Architecture**
   - Use Glob: \`**/*/\` to understand directory structure
   - Identify key directories: src/, lib/, core/, api/, utils/, types/
   - Determine module organization pattern (by feature or by layer?)

3. **Find Entry Points**
   - Look for index.ts, main.ts, or package.json "main"/"exports"
   - Identify the public API surface

**After Phase 1, document:**
- Project name and purpose
- High-level architecture overview
- Main modules and their relationships

---

## Phase 2: Extract Existing Documentation (Harvest Quality Content)
**Goal**: Find and preserve high-quality content that already exists.

1. **Documentation Files**
   - Use Glob: \`**/*.md\`, \`**/docs/**\`, \`**/documentation/**\`
   - Read all markdown files, extract code blocks and explanations

2. **Example Code**
   - Use Glob: \`**/examples/**\`, \`**/samples/**\`, \`**/demo/**\`
   - Read complete example files - these are typically well-crafted

3. **Inline Documentation**
   - Use Grep: \`@example\`, \`@param\`, \`@returns\`
   - Find well-documented functions and classes

**Create snippets for each high-quality piece found.**

---

## Phase 3: Analyze Public API (Document the Interface)
**Goal**: Understand and document all public interfaces.

1. **Find Exports**
   - Use Grep: \`export (function|class|const|interface|type)\`
   - Focus on index.ts, api.ts, public.ts files

2. **Read Type Definitions**
   - Find interface and type definitions
   - Document configuration objects and options

3. **Identify Core Abstractions**
   - Find main classes and constructors
   - Identify factory functions and builders

**For each public API, create a "How to use [API]" snippet.**

---

## Phase 4: Synthesize Usage Scenarios (Fill the Gaps)
**Goal**: Create practical how-to guides for common developer needs.

Based on Phases 1-3, create snippets for scenarios NOT covered by existing docs:

1. **Getting Started**
   - "How to install [project]"
   - "How to configure [project] for [common environment]"
   - "How to verify installation is working"

2. **Core Workflows**
   - "How to [primary use case 1]"
   - "How to [primary use case 2]"
   - "How to handle [common scenario]"

3. **Integration**
   - "How to use [project] with [common tool/framework]"
   - "How to extend [project] with custom [component]"

4. **Troubleshooting**
   - "How to debug [common issue]"
   - "How to resolve [typical error]"

---

## Output Requirements

Generate up to ${maxSnippets} snippets with this distribution:
- **INSTALLATION**: 2-5 snippets (setup, dependencies, config)
- **ARCHITECTURE**: 1-3 snippets (project structure, module overview)
- **API_USAGE**: 30-40% (core API with examples)
- **WORKFLOW**: 20-30% (multi-step task guides)
- **EXAMPLE**: 20-30% (complete runnable examples)
- **TROUBLESHOOT**: 5-10% (common issues)

### Title Format
- ALWAYS start with "How to" or action verb
- Good: "How to connect to database", "Configure authentication"
- Bad: "Database module", "Authentication overview"

### Content Guidelines
- Include import statements
- Show complete, runnable code
- Add comments for non-obvious parts
- Include error handling for production examples

### Architecture Section
Generate a comprehensive architecture overview including:
- Project purpose summary
- Module structure and relationships
- Key entry points for developers

### Q&A Items
Generate 5-10 Q&A items covering:
- Installation questions
- Configuration questions
- Capability questions ("Can I...?")
- Architecture decisions ("Why...?")

### Granularity Guidelines
- **Minimum**: 3 lines of meaningful code (not just imports or comments)
- **Maximum**: 50 lines of code per snippet (split larger examples)
- **Installation**: Consolidate all setup steps into 1-2 comprehensive snippets
- **Platform-specific**: Use comments or conditional blocks, not separate snippets

### Example of Good vs Bad Granularity

**BAD** (too fragmented):
- Snippet 1: "Install Java" → \`apt-get install default-jdk\`
- Snippet 2: "Install SBT" → \`apt-get install sbt\`
- Snippet 3: "Install Verilator" → \`apt-get install verilator\`

**GOOD** (consolidated):
- Snippet 1: "Set up complete development environment"
  \`\`\`bash
  # Install Java JDK
  sudo apt-get install default-jdk

  # Install Scala Build Tool
  sudo apt-get install sbt

  # Install Verilator for simulation
  sudo apt-get install verilator

  # Verify installation
  java -version && sbt --version && verilator --version
  \`\`\`

### Runnable Code Requirement
Every code block must be copy-paste runnable. Never use:
- Pseudo-code or API documentation format
- Placeholder comments like "// ... rest of implementation"
- Incomplete code that won't compile/run

### Content Types to Generate (Language-Agnostic)

Generate these essential content types for ANY programming language:

1. **Data Structure Definition Snippets** (API_USAGE category)
   - Export important data structures as standalone snippets
   - Include documentation comments explaining each field
   - Examples: TypeScript interface/type, Python dataclass, Go struct, Rust struct/enum, Java record, C struct

2. **Project Structure Snippets** (ARCHITECTURE category)
   - Show the project's directory organization using text code blocks
   - Explain the purpose of key directories
   - Example:
   \`\`\`text
   project/
   ├── src/           # Source code
   │   ├── core/      # Core business logic
   │   └── api/       # Public API
   ├── tests/         # Test files
   └── docs/          # Documentation
   \`\`\`

3. **Configuration File Snippets** (INSTALLATION category)
   - Show complete config files with comments
   - Examples: pyproject.toml, Cargo.toml, go.mod, package.json, CMakeLists.txt, pom.xml

4. **Module Integration Snippets** (WORKFLOW category)
   - Show how multiple modules work together
   - Include initialization and wiring code

### Dependency/Import Requirements
For EVERY code snippet, include necessary imports at the top:
- Python: \`import\`, \`from ... import\`
- Go: \`import\`
- Rust: \`use\`
- Java: \`import\`
- C/C++: \`#include\`
- JavaScript/TypeScript: \`import\`

Never assume dependencies are already imported.

Begin analysis now. Start with Phase 1.`;
  }

  private emitProgress(
    phase: 'exploring' | 'generating' | 'storing' | 'agent',
    current: number,
    total: number,
    currentFile: string | undefined,
    message: string
  ): void {
    if (this.progressCallback) {
      this.progressCallback({
        phase,
        current,
        total,
        currentFile,
        message,
      });
    }
    console.log(`[SnippetPipeline] ${phase}: ${message}`);
  }
}
