export function buildMermaidDocument(
  code: string,
  previewScrollbarStyle: string,
  consoleBridge: string,
  previewId = ''
): string {
  const bridge = `${previewScrollbarStyle}${consoleBridge}`;
  const serializedCode = JSON.stringify(code).replace(/</g, '\\u003c');
  const serializedId = JSON.stringify(previewId);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
${bridge}
<style>
  html, body {
    margin: 0;
    min-height: 100%;
    background: #ffffff;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #0f172a;
  }
  #stage {
    min-height: 220px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
    overflow: auto;
  }
  #diagram {
    max-width: 100%;
    display: flex;
    justify-content: center;
  }
  #diagram svg {
    max-width: 100%;
    height: auto;
  }
  .status {
    font-size: 13px;
    color: #64748b;
  }
  .error-box {
    max-width: 560px;
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid #fecaca;
    background: #fef2f2;
    color: #991b1b;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px;
    white-space: pre-wrap;
    line-height: 1.5;
  }
</style>
</head>
<body>
<div id="stage">
  <div id="diagram" class="status">Rendering diagram...</div>
</div>
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  const source = ${serializedCode};
  const previewId = ${serializedId};
  const target = document.getElementById('diagram');
  const notifyHeight = () => {
    const h = Math.max(220, Math.min(680, document.documentElement.scrollHeight || 280));
    parent.postMessage({ source: 'deepchat-mermaid-resize', previewId, height: h }, '*');
  };
  try {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      themeVariables: {
        primaryColor: '#eff6ff',
        primaryTextColor: '#0f172a',
        primaryBorderColor: '#93c5fd',
        lineColor: '#64748b',
        secondaryColor: '#f8fafc',
        tertiaryColor: '#f1f5f9',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }
    });
    const { svg } = await mermaid.render('dc-mermaid-' + Date.now(), source);
    target.className = '';
    target.innerHTML = svg;
    requestAnimationFrame(notifyHeight);
  } catch (err) {
    target.className = 'error-box';
    target.textContent = err && err.message ? err.message : String(err);
    console.error(target.textContent);
    requestAnimationFrame(notifyHeight);
  }
<\/script>
</body>
</html>`;
}
