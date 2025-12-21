import { createHash, randomUUID } from 'crypto';
import type { SupportedLanguage } from '@context8/types';
import type { CodeChunkData, ChunkingOptions, ExtractedSymbol } from '../types.js';
import { DEFAULT_CHUNKING_OPTIONS } from '../types.js';
import { TreeSitterParser, treeSitterParser } from '../tree-sitter-parser.js';
import { SymbolExtractor } from './symbol-extractor.js';

/**
 * AST-based hierarchical code chunker
 */
export class AstChunker {
  private parser: TreeSitterParser;
  private extractor: SymbolExtractor;
  private options: ChunkingOptions;

  constructor(options?: Partial<ChunkingOptions>) {
    this.parser = treeSitterParser;
    this.extractor = new SymbolExtractor(this.parser);
    this.options = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
  }

  /**
   * Process a file and generate hierarchical chunks
   */
  async chunkFile(
    filePath: string,
    content: string,
    repositoryId: string,
    commitSha: string
  ): Promise<CodeChunkData[]> {
    const language = this.parser.detectLanguage(filePath);
    if (!language) {
      return []; // Skip unsupported files
    }

    const tree = this.parser.parse(content, language);
    const lines = content.split('\n');
    const chunks: CodeChunkData[] = [];

    // Extract symbols from AST
    const symbols = this.extractor.extract(tree, content, language);

    // Create chunks for each symbol
    for (const symbol of symbols) {
      // Summary Chunk (signature + docstring)
      const summaryChunk = this.createSummaryChunk(
        symbol,
        filePath,
        language,
        repositoryId,
        commitSha,
        lines
      );
      chunks.push(summaryChunk);

      // Implementation Chunk(s) (body)
      const implChunks = this.createImplementationChunks(
        symbol,
        filePath,
        language,
        repositoryId,
        commitSha,
        lines,
        summaryChunk.id
      );
      chunks.push(...implChunks);

      // Link summary to implementations
      summaryChunk.childChunkIds = implChunks.map((c) => c.id);
    }

    // File-level summary chunk
    if (symbols.length > 0) {
      const fileSummary = this.createFileSummaryChunk(
        symbols,
        filePath,
        language,
        repositoryId,
        commitSha,
        content
      );
      chunks.unshift(fileSummary);
    }

    return chunks;
  }

  private createSummaryChunk(
    symbol: ExtractedSymbol,
    filePath: string,
    language: SupportedLanguage,
    repositoryId: string,
    commitSha: string,
    _lines: string[]
  ): CodeChunkData {
    const content = symbol.docstring
      ? `${symbol.docstring}\n\n${symbol.signature}`
      : symbol.signature;

    return {
      id: randomUUID(),
      repositoryId,
      level: 'summary',
      type: symbol.type,
      language,
      content,
      signature: symbol.signature,
      symbolName: symbol.name,
      filePath,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      commitSha,
      contentHash: this.hashContent(content),
      imports: [],
      exports: [],
      parentChunkId: null,
      childChunkIds: [],
    };
  }

  private createImplementationChunks(
    symbol: ExtractedSymbol,
    filePath: string,
    language: SupportedLanguage,
    repositoryId: string,
    commitSha: string,
    lines: string[],
    parentChunkId: string
  ): CodeChunkData[] {
    const bodyLines = lines.slice(symbol.bodyStartLine, symbol.endLine + 1);
    const bodyContent = bodyLines.join('\n');
    const tokenCount = this.estimateTokens(bodyContent);

    // If body fits in single chunk
    if (tokenCount <= this.options.maxChunkTokens) {
      return [
        {
          id: randomUUID(),
          repositoryId,
          level: 'implementation',
          type: symbol.type,
          language,
          content: bodyContent,
          signature: symbol.signature,
          symbolName: symbol.name,
          filePath,
          startLine: symbol.bodyStartLine,
          endLine: symbol.endLine,
          commitSha,
          contentHash: this.hashContent(bodyContent),
          imports: [],
          exports: [],
          parentChunkId,
          childChunkIds: [],
        },
      ];
    }

    // Split large bodies into multiple chunks
    return this.splitIntoChunks(
      bodyContent,
      symbol,
      filePath,
      language,
      repositoryId,
      commitSha,
      parentChunkId
    );
  }

  private splitIntoChunks(
    content: string,
    symbol: ExtractedSymbol,
    filePath: string,
    language: SupportedLanguage,
    repositoryId: string,
    commitSha: string,
    parentChunkId: string
  ): CodeChunkData[] {
    const chunks: CodeChunkData[] = [];
    const lines = content.split('\n');
    const maxLines = Math.floor(this.options.maxChunkTokens / 10);
    const overlapLines = Math.floor(this.options.overlapTokens / 10);

    let startIdx = 0;
    let partIndex = 0;

    while (startIdx < lines.length) {
      const endIdx = Math.min(startIdx + maxLines, lines.length);
      const chunkLines = lines.slice(startIdx, endIdx);
      const chunkContent = chunkLines.join('\n');

      chunks.push({
        id: randomUUID(),
        repositoryId,
        level: 'implementation',
        type: symbol.type,
        language,
        content: chunkContent,
        signature: `${symbol.signature} [part ${partIndex + 1}]`,
        symbolName: symbol.name,
        filePath,
        startLine: symbol.bodyStartLine + startIdx,
        endLine: symbol.bodyStartLine + endIdx - 1,
        commitSha,
        contentHash: this.hashContent(chunkContent),
        imports: [],
        exports: [],
        parentChunkId,
        childChunkIds: [],
      });

      startIdx = endIdx - overlapLines;
      if (startIdx >= lines.length - overlapLines) break;
      partIndex++;
    }

    return chunks;
  }

  private createFileSummaryChunk(
    symbols: ExtractedSymbol[],
    filePath: string,
    language: SupportedLanguage,
    repositoryId: string,
    commitSha: string,
    fullContent: string
  ): CodeChunkData {
    const signatures = symbols.map((s) => s.signature).join('\n\n');
    const summary = `// File: ${filePath}\n// Symbols: ${symbols.length}\n\n${signatures}`;

    return {
      id: randomUUID(),
      repositoryId,
      level: 'summary',
      type: 'file_summary',
      language,
      content: summary,
      signature: `File: ${filePath}`,
      symbolName: filePath.split('/').pop() ?? filePath,
      filePath,
      startLine: 0,
      endLine: fullContent.split('\n').length - 1,
      commitSha,
      contentHash: this.hashContent(fullContent),
      imports: this.extractImports(fullContent, language),
      exports: this.extractExports(fullContent, language),
      parentChunkId: null,
      childChunkIds: [],
    };
  }

  private extractImports(content: string, language: SupportedLanguage): string[] {
    const imports: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (language === 'typescript') {
        const match = line.match(/from\s+['"]([^'"]+)['"]/);
        if (match) imports.push(match[1]);
      } else if (language === 'python') {
        const importMatch = line.match(/^import\s+(\S+)/);
        const fromMatch = line.match(/^from\s+(\S+)\s+import/);
        if (importMatch) imports.push(importMatch[1]);
        if (fromMatch) imports.push(fromMatch[1]);
      }
    }

    return [...new Set(imports)];
  }

  private extractExports(content: string, language: SupportedLanguage): string[] {
    const exports: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (language === 'typescript') {
        const exportMatch = line.match(/export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/);
        if (exportMatch) exports.push(exportMatch[1]);
      }
    }

    return [...new Set(exports)];
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

export const astChunker = new AstChunker();
