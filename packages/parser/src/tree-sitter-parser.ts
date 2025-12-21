import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import type { SupportedLanguage } from '@context8/types';

/**
 * Tree-sitter based parser for TypeScript and Python
 */
export class TreeSitterParser {
  private parsers: Map<SupportedLanguage, Parser> = new Map();

  constructor() {
    this.initializeParsers();
  }

  private initializeParsers(): void {
    // TypeScript parser
    const tsParser = new Parser();
    tsParser.setLanguage(TypeScript.typescript);
    this.parsers.set('typescript', tsParser);

    // Python parser
    const pyParser = new Parser();
    pyParser.setLanguage(Python);
    this.parsers.set('python', pyParser);
  }

  /**
   * Parse source code and return AST
   */
  parse(content: string, language: SupportedLanguage): Parser.Tree {
    const parser = this.parsers.get(language);
    if (!parser) {
      throw new Error(`Unsupported language: ${language}`);
    }
    return parser.parse(content);
  }

  /**
   * Detect language from file extension
   */
  detectLanguage(filePath: string): SupportedLanguage | null {
    const ext = filePath.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'mts':
      case 'cts':
        return 'typescript';
      case 'py':
      case 'pyi':
        return 'python';
      default:
        return null;
    }
  }

  /**
   * Check if file extension is supported
   */
  isSupported(filePath: string): boolean {
    return this.detectLanguage(filePath) !== null;
  }

  /**
   * Get the language object for tree-sitter queries
   */
  getLanguage(language: SupportedLanguage): unknown {
    switch (language) {
      case 'typescript':
        return TypeScript.typescript;
      case 'python':
        return Python;
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  /**
   * Query the AST using tree-sitter query syntax
   */
  query(tree: Parser.Tree, language: SupportedLanguage, queryString: string): Parser.QueryCapture[] {
    const lang = this.getLanguage(language);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query = new Parser.Query(lang as any, queryString);
    return query.captures(tree.rootNode);
  }
}

export const treeSitterParser = new TreeSitterParser();
