import { useEffect, useRef, useState } from 'react';

import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';
import './content.scss';

type MarkdownProps = {
  className?: string;
  content: string;
};

export function Markdown({ className = '', content }: MarkdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    void import('./markdownRuntime')
      .then(({ renderMarkdown }) => active && setHtml(renderMarkdown(content)))
      .catch((cause: unknown) => active && setError(cause instanceof Error ? cause.message : String(cause)));
    return () => { active = false; };
  }, [content]);

  useEffect(() => {
    if (!html || !rootRef.current) return;
    void import('./mermaidRuntime')
      .then(({ renderMermaidElements }) => rootRef.current && renderMermaidElements(rootRef.current))
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [html]);

  if (error) return <div className="markdown-body markdown-body--error" role="alert">{error}</div>;
  return (
    <div
      className={`markdown-body ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
      ref={rootRef}
    />
  );
}
