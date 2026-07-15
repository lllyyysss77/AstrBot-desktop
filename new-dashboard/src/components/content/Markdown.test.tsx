import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Markdown } from './Markdown';

describe('Streamdown Markdown renderer', () => {
  it('repairs incomplete Markdown while streaming', () => {
    const html = renderToStaticMarkup(<Markdown content="A **streaming response" streaming />);

    expect(html).toContain('data-streamdown="strong"');
    expect(html).toContain('streaming response</span>');
  });

  it('renders static GFM without allowing raw HTML', () => {
    const html = renderToStaticMarkup(<Markdown content={'~~done~~\n\n<script>alert(1)</script>'} />);

    expect(html).toContain('<del>done</del>');
    expect(html).not.toContain('<script>');
  });
});
