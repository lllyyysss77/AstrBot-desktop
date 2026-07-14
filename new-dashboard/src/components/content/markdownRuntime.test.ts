import { describe, expect, it } from 'vitest';

import { createMarkdownRenderer } from './markdownRuntime';

describe('Markdown renderer', () => {
  const renderer = createMarkdownRenderer();

  it('renders highlighted code and KaTeX', () => {
    const html = renderer.render('`const`\n\n$E = mc^2$\n\n```js\nconst answer = 42\n```');
    expect(html).toContain('katex');
    expect(html).toContain('hljs');
  });

  it('creates deferred Mermaid targets without enabling raw HTML', () => {
    const html = renderer.render('<script>alert(1)</script>\n\n```mermaid\ngraph TD; A-->B\n```');
    expect(html).not.toContain('<script>');
    expect(html).toContain('data-mermaid-source');
  });
});
