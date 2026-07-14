let initialized = false;

export async function renderMermaidElements(root: HTMLElement) {
  const elements = [...root.querySelectorAll<HTMLElement>('.markdown-mermaid[data-mermaid-source]')];
  if (!elements.length) return;
  const { default: mermaid } = await import('@legacy-mermaid');
  const { default: DOMPurify } = await import('dompurify');
  if (!initialized) {
    mermaid.initialize({ securityLevel: 'strict', startOnLoad: false });
    initialized = true;
  }
  await Promise.all(elements.map(async (element, index) => {
    const source = decodeURIComponent(element.dataset.mermaidSource ?? '');
    const { svg, bindFunctions } = await mermaid.render(`astrbot-mermaid-${Date.now()}-${index}`, source);
    element.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
    bindFunctions?.(element);
  }));
}
