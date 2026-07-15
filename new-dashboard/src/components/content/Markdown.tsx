import { cjk } from '@streamdown/cjk';
import { code } from '@streamdown/code';
import { createMathPlugin } from '@streamdown/math';
import { mermaid } from '@streamdown/mermaid';
import { Streamdown } from 'streamdown';

import 'katex/dist/katex.min.css';
import 'streamdown/styles.css';
import './content.scss';

type MarkdownProps = {
  className?: string;
  content: string;
  streaming?: boolean;
};

const math = createMathPlugin({ singleDollarTextMath: true });
const plugins = { cjk, code, math, mermaid };

export function Markdown({ className = '', content, streaming = false }: MarkdownProps) {
  return (
    <Streamdown
      animated
      caret="block"
      className={`markdown-body ${className}`.trim()}
      controls={false}
      dir="auto"
      isAnimating={streaming}
      lineNumbers
      mermaid={{ config: { securityLevel: 'strict', theme: 'neutral' } }}
      mode={streaming ? 'streaming' : 'static'}
      parseIncompleteMarkdown={streaming}
      plugins={plugins}
      skipHtml
    >
      {content}
    </Streamdown>
  );
}
