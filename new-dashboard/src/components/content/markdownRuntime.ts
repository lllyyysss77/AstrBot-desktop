import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import katex from 'katex';
import MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';

const escapeHtml = (value: string) => new MarkdownIt().utils.escapeHtml(value);

function mathPlugin(md: MarkdownIt) {
  md.inline.ruler.after('escape', 'math_inline', (state: StateInline, silent: boolean) => {
    if (state.src[state.pos] !== '$' || state.src[state.pos + 1] === '$') return false;
    const end = state.src.indexOf('$', state.pos + 1);
    if (end < 0 || end === state.pos + 1) return false;
    if (!silent) {
      const token = state.push('math_inline', 'math', 0);
      token.content = state.src.slice(state.pos + 1, end);
    }
    state.pos = end + 1;
    return true;
  });

  md.block.ruler.after('blockquote', 'math_block', (state: StateBlock, startLine, _endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const firstLine = state.src.slice(start, state.eMarks[startLine]);
    if (!firstLine.startsWith('$$')) return false;
    let nextLine = startLine;
    let content = firstLine.slice(2);
    let closed = content.endsWith('$$');
    if (closed) content = content.slice(0, -2);
    while (!closed && ++nextLine < state.lineMax) {
      const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
      const line = state.src.slice(lineStart, state.eMarks[nextLine]);
      if (line.endsWith('$$')) {
        content += `\n${line.slice(0, -2)}`;
        closed = true;
      } else content += `\n${line}`;
    }
    if (!closed) return false;
    if (silent) return true;
    const token = state.push('math_block', 'math', 0);
    token.block = true;
    token.content = content.trim();
    token.map = [startLine, nextLine + 1];
    state.line = nextLine + 1;
    return true;
  });

  md.renderer.rules.math_inline = (tokens, index) => katex.renderToString(tokens[index].content, {
    throwOnError: false,
  });
  md.renderer.rules.math_block = (tokens, index) => katex.renderToString(tokens[index].content, {
    displayMode: true,
    throwOnError: false,
  });
}

export function createMarkdownRenderer() {
  const md = new MarkdownIt({
    breaks: true,
    html: false,
    linkify: true,
    highlight(code, language) {
      if (language === 'mermaid') {
        return `<div class="markdown-mermaid" data-mermaid-source="${encodeURIComponent(code)}"></div>`;
      }
      try {
        const highlighted = language && hljs.getLanguage(language)
          ? hljs.highlight(code, { language }).value
          : hljs.highlightAuto(code).value;
        return `<pre class="hljs"><code>${highlighted}</code></pre>`;
      } catch {
        return `<pre class="hljs"><code>${escapeHtml(code)}</code></pre>`;
      }
    },
  }).use(mathPlugin);

  const defaultFence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, index, options, env, self) => {
    if (tokens[index].info.trim().split(/\s+/)[0] === 'mermaid') {
      return md.options.highlight!(tokens[index].content, 'mermaid', '') + '\n';
    }
    return defaultFence(tokens, index, options, env, self);
  };
  return md;
}

export function renderMarkdown(source: string) {
  return DOMPurify.sanitize(createMarkdownRenderer().render(source), {
    ADD_ATTR: ['data-mermaid-source'],
  });
}
