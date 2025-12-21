'use client';

import { useEffect, useRef, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import { CodeBlock } from './code-block';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  suppressErrorRendering: true,
});

// Mermaid diagram component
const MermaidDiagram = memo(function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current) return;

      const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;

      try {
        const { svg } = await mermaid.render(id, chart);
        containerRef.current.innerHTML = svg;
      } catch (error) {
        console.error('Mermaid rendering error:', error);

        // Clean up any error elements mermaid may have appended to the DOM
        const errorElements = document.querySelectorAll(`#d${id}, [id^="d${id}"]`);
        errorElements.forEach((el) => el.remove());

        // Also clean up any generic mermaid error elements
        document.querySelectorAll('.error-icon, .error-text').forEach((el) => {
          if (el.closest('body > *:not(#__next):not(#root):not(main)')) {
            el.closest('svg')?.remove();
          }
        });

        // Show inline error with the mermaid source
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        containerRef.current.innerHTML = `
          <div class="w-full">
            <div class="flex items-center gap-2 text-amber-400 mb-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              <span class="text-sm font-medium">Mermaid diagram syntax error</span>
            </div>
            <pre class="text-xs text-muted-foreground bg-background/50 rounded p-3 overflow-x-auto whitespace-pre-wrap">${chart
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')}</pre>
          </div>
        `;
      }
    };

    renderDiagram();
  }, [chart]);

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center overflow-x-auto bg-muted/30 rounded-lg p-4"
    />
  );
});

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      className={`prose prose-invert prose-sm max-w-none ${className}`}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        // Code blocks with syntax highlighting
        code({ node, className: codeClassName, children, ...props }) {
          const match = /language-(\w+)/.exec(codeClassName || '');
          const language = match ? match[1] : '';
          const codeString = String(children).replace(/\n$/, '');

          // Check if this is a Mermaid diagram
          if (language === 'mermaid') {
            return <MermaidDiagram chart={codeString} />;
          }

          // Inline code vs code block
          const isInline = !codeClassName;
          if (isInline) {
            return (
              <code
                className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          }

          // Code block with syntax highlighting
          return (
            <div className="my-4 rounded-lg overflow-hidden border border-border">
              {language && (
                <div className="bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground border-b border-border">
                  {language}
                </div>
              )}
              <CodeBlock code={codeString} language={language || 'text'} showLineNumbers={false} />
            </div>
          );
        },

        // Headings with styling
        h1({ children }) {
          return (
            <h1 className="text-2xl font-bold mt-8 mb-4 pb-2 border-b border-border">
              {children}
            </h1>
          );
        },
        h2({ children }) {
          return (
            <h2 className="text-xl font-semibold mt-6 mb-3 pb-1.5 border-b border-border/50">
              {children}
            </h2>
          );
        },
        h3({ children }) {
          return <h3 className="text-lg font-semibold mt-5 mb-2">{children}</h3>;
        },
        h4({ children }) {
          return <h4 className="text-base font-semibold mt-4 mb-2">{children}</h4>;
        },

        // Paragraphs
        p({ children }) {
          return <p className="my-3 leading-relaxed">{children}</p>;
        },

        // Lists
        ul({ children }) {
          return <ul className="my-3 ml-6 list-disc space-y-1">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="my-3 ml-6 list-decimal space-y-1">{children}</ol>;
        },
        li({ children }) {
          return <li className="leading-relaxed">{children}</li>;
        },

        // Links
        a({ href, children }) {
          return (
            <a
              href={href}
              className="text-primary hover:underline"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          );
        },

        // Blockquotes
        blockquote({ children }) {
          return (
            <blockquote className="my-4 border-l-4 border-primary/50 pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          );
        },

        // Tables
        table({ children }) {
          return (
            <div className="my-4 overflow-x-auto">
              <table className="w-full border-collapse border border-border text-sm">
                {children}
              </table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-muted/50">{children}</thead>;
        },
        th({ children }) {
          return (
            <th className="border border-border px-4 py-2 text-left font-semibold">
              {children}
            </th>
          );
        },
        td({ children }) {
          return <td className="border border-border px-4 py-2">{children}</td>;
        },

        // Horizontal rules
        hr() {
          return <hr className="my-6 border-border" />;
        },

        // Images
        img({ src, alt }) {
          return (
            <img
              src={src}
              alt={alt || ''}
              className="my-4 max-w-full rounded-lg"
            />
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
