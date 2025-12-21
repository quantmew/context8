import type Parser from 'tree-sitter';
import type { SupportedLanguage, ChunkType } from '@context8/types';
import type { ExtractedSymbol } from '../types.js';
import { TreeSitterParser } from '../tree-sitter-parser.js';
import { TYPESCRIPT_QUERIES, PYTHON_QUERIES } from './queries.js';

/**
 * Extract symbols from AST
 */
export class SymbolExtractor {
  private parser: TreeSitterParser;

  constructor(parser: TreeSitterParser) {
    this.parser = parser;
  }

  /**
   * Extract all symbols from a file
   */
  extract(tree: Parser.Tree, content: string, language: SupportedLanguage): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];
    const _lines = content.split('\n');

    if (language === 'typescript') {
      const queries = TYPESCRIPT_QUERIES;
      // Extract functions
      this.extractByQuery(tree, language, queries.functions, 'function', _lines, symbols);
      // Extract classes
      this.extractByQuery(tree, language, queries.classes, 'class', _lines, symbols);
      // Extract methods
      this.extractByQuery(tree, language, queries.methods, 'method', _lines, symbols);
      // Extract interfaces
      this.extractByQuery(tree, language, queries.interfaces, 'interface', _lines, symbols);
      // Extract type aliases
      this.extractByQuery(tree, language, queries.typeAliases, 'type_alias', _lines, symbols);
    } else {
      const queries = PYTHON_QUERIES;
      // Extract functions
      this.extractByQuery(tree, language, queries.functions, 'function', _lines, symbols);
      // Extract classes
      this.extractByQuery(tree, language, queries.classes, 'class', _lines, symbols);
    }

    return symbols;
  }

  private extractByQuery(
    tree: Parser.Tree,
    language: SupportedLanguage,
    queryString: string,
    defaultType: ChunkType,
    lines: string[],
    symbols: ExtractedSymbol[]
  ): void {
    try {
      const captures = this.parser.query(tree, language, queryString);

      for (const capture of captures) {
        if (this.isTopLevelCapture(capture.name)) {
          const symbol = this.nodeToSymbol(capture.node, lines, defaultType);
          if (symbol) {
            symbols.push(symbol);
          }
        }
      }
    } catch (error) {
      // Query might fail for certain edge cases, log and continue
      console.warn(`Query extraction failed for ${defaultType}:`, error);
    }
  }

  private isTopLevelCapture(name: string): boolean {
    return ['function', 'class', 'method', 'interface', 'type_alias', 'decorated_function', 'decorated_class'].includes(name);
  }

  private nodeToSymbol(
    node: Parser.SyntaxNode,
    lines: string[],
    type: ChunkType
  ): ExtractedSymbol | null {
    const name = this.extractName(node);
    if (!name) return null;

    const signature = this.extractSignature(node, lines);
    const docstring = this.extractDocstring(node, lines);

    return {
      name,
      type,
      signature,
      docstring,
      startLine: node.startPosition.row,
      endLine: node.endPosition.row,
      startColumn: node.startPosition.column,
      endColumn: node.endPosition.column,
      bodyStartLine: this.findBodyStartLine(node),
      decorators: this.extractDecorators(node, lines),
      visibility: this.extractVisibility(node),
      parentSymbol: this.extractParentSymbol(node),
    };
  }

  private extractName(node: Parser.SyntaxNode): string | null {
    // Find name child node
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      return nameNode.text;
    }

    // Fallback: look for identifier child
    for (const child of node.children) {
      if (child.type === 'identifier' || child.type === 'type_identifier' || child.type === 'property_identifier') {
        return child.text;
      }
    }

    return null;
  }

  private extractSignature(node: Parser.SyntaxNode, lines: string[]): string {
    const startLine = node.startPosition.row;
    let endLine = startLine;

    // Find where the signature ends (before the body block)
    const bodyNode = node.childForFieldName('body');
    if (bodyNode) {
      endLine = bodyNode.startPosition.row;
    }

    // Extract lines up to body
    const signatureLines = lines.slice(startLine, endLine + 1);
    let signature = signatureLines.join('\n');

    // Trim to just the signature (before opening brace or colon)
    const braceIndex = signature.indexOf('{');
    const colonIndex = signature.lastIndexOf(':');

    if (braceIndex > -1) {
      signature = signature.substring(0, braceIndex).trim();
    } else if (node.type.includes('python') && colonIndex > -1) {
      signature = signature.substring(0, colonIndex + 1).trim();
    }

    return signature;
  }

  private extractDocstring(node: Parser.SyntaxNode, _lines: string[]): string | null {
    const bodyNode = node.childForFieldName('body');
    if (!bodyNode) return null;

    // Look for string at start of body (docstring)
    const firstChild = bodyNode.firstChild;
    if (!firstChild) return null;

    // Python docstring
    if (firstChild.type === 'expression_statement') {
      const stringNode = firstChild.firstChild;
      if (stringNode?.type === 'string') {
        return this.cleanDocstring(stringNode.text);
      }
    }

    // JSDoc comment (look before the node)
    const prevSibling = node.previousNamedSibling;
    if (prevSibling?.type === 'comment' && prevSibling.text.startsWith('/**')) {
      return this.cleanDocstring(prevSibling.text);
    }

    return null;
  }

  private cleanDocstring(text: string): string {
    // Remove triple quotes for Python
    let cleaned = text.replace(/^['\"]{3}|['\"]{3}$/g, '');
    // Remove JSDoc markers
    cleaned = cleaned.replace(/^\/\*\*|\*\/$/g, '');
    cleaned = cleaned.replace(/^\s*\*\s?/gm, '');
    return cleaned.trim();
  }

  private findBodyStartLine(node: Parser.SyntaxNode): number {
    const bodyNode = node.childForFieldName('body');
    if (bodyNode) {
      return bodyNode.startPosition.row;
    }
    return node.startPosition.row + 1;
  }

  private extractDecorators(node: Parser.SyntaxNode, _lines: string[]): string[] {
    const decorators: string[] = [];

    // Check parent for decorated_definition
    if (node.parent?.type === 'decorated_definition') {
      for (const child of node.parent.children) {
        if (child.type === 'decorator') {
          decorators.push(child.text);
        }
      }
    }

    return decorators;
  }

  private extractVisibility(node: Parser.SyntaxNode): 'public' | 'private' | 'protected' {
    // TypeScript: check for accessibility modifier
    for (const child of node.children) {
      if (child.type === 'accessibility_modifier') {
        if (child.text === 'private') return 'private';
        if (child.text === 'protected') return 'protected';
      }
    }

    // Python: check for underscore prefix
    const name = this.extractName(node);
    if (name?.startsWith('__') && !name.endsWith('__')) return 'private';
    if (name?.startsWith('_')) return 'protected';

    return 'public';
  }

  private extractParentSymbol(node: Parser.SyntaxNode): string | null {
    let parent = node.parent;
    while (parent) {
      if (parent.type === 'class_declaration' || parent.type === 'class_definition') {
        const nameNode = parent.childForFieldName('name');
        return nameNode?.text ?? null;
      }
      parent = parent.parent;
    }
    return null;
  }
}
