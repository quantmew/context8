'use client';

import { Highlight, themes } from 'prism-react-renderer';

interface CodeBlockProps {
  code: string;
  language: string;
  startLine?: number;
  showLineNumbers?: boolean;
}

// Map common language names to Prism language names
const languageMap: Record<string, string> = {
  typescript: 'typescript',
  javascript: 'javascript',
  python: 'python',
  rust: 'rust',
  go: 'go',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  csharp: 'csharp',
  ruby: 'ruby',
  php: 'php',
  swift: 'swift',
  kotlin: 'kotlin',
  scala: 'scala',
  html: 'html',
  css: 'css',
  json: 'json',
  yaml: 'yaml',
  markdown: 'markdown',
  sql: 'sql',
  bash: 'bash',
  shell: 'bash',
};

export function CodeBlock({
  code,
  language,
  startLine = 1,
  showLineNumbers = true,
}: CodeBlockProps) {
  const prismLanguage = languageMap[language.toLowerCase()] ?? 'javascript';

  return (
    <Highlight theme={themes.vsDark} code={code.trim()} language={prismLanguage}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={className}
          style={{
            ...style,
            margin: 0,
            padding: '1rem',
            fontSize: '0.8125rem',
            lineHeight: '1.5',
            overflow: 'auto',
            maxHeight: '300px',
          }}
        >
          {tokens.map((line, i) => {
            const lineProps = getLineProps({ line, key: i });
            return (
              <div key={i} {...lineProps}>
                {showLineNumbers && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: '3em',
                      marginRight: '1em',
                      color: '#6b7280',
                      textAlign: 'right',
                      userSelect: 'none',
                    }}
                  >
                    {startLine + i}
                  </span>
                )}
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token, key })} />
                ))}
              </div>
            );
          })}
        </pre>
      )}
    </Highlight>
  );
}
