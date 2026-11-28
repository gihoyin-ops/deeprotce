import { escapeScriptClose } from '@/lib/utils';
import { getFileExtension, inferCodeLanguage, type CanvasFile } from './types';

const PREVIEW_SCROLLBAR_STYLE = `
<style>
html {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
</style>`;

// Keep '*' targetOrigin since srcDoc iframes have an opaque origin, previewId authenticates console events
function getConsoleBridge(previewId: string): string {
  return `<script>
(() => {
  const send = (type, args) => {
    try {
      parent.postMessage({
        source: 'deepchat-canvas-preview-console',
        previewId: '${previewId}',
        type,
        args: args.map((item) => {
          if (typeof item === 'string') return item;
          if (item instanceof Error) return item.message;
          try { return JSON.stringify(item); } catch { return String(item); }
        })
      }, '*');
    } catch {}
  };
  ['log', 'info', 'warn', 'error'].forEach((method) => {
    const orig = console[method];
    console[method] = (...args) => {
      send(method, args);
      orig.apply(console, args);
    };
  });
  window.addEventListener('error', (e) => send('error', [e.message || 'Runtime error']));
  window.addEventListener('unhandledrejection', (e) => send('error', [e.reason]));
})();
<\\/script>`.replace('<\\/script>', '</script>');
}

function resolveWorkspaceAsset(
  files: CanvasFile[],
  refPath: string,
  baseDir: string
): CanvasFile | undefined {
  const cleaned = refPath.split(/[?#]/)[0].trim();
  if (!cleaned || /^(https?:|data:|blob:|\/\/)/i.test(cleaned)) return undefined;

  const normalizedRef = cleaned.replace(/^\.\//, '').replace(/^\/+/, '');
  const joined = baseDir
    ? `${baseDir.replace(/\/+$/, '')}/${normalizedRef}`
    : normalizedRef;

  return (
    files.find((f) => f.path.toLowerCase() === joined.toLowerCase()) ||
    files.find((f) => f.path.toLowerCase() === normalizedRef.toLowerCase()) ||
    files.find((f) => f.path.toLowerCase().endsWith(`/${normalizedRef.toLowerCase()}`))
  );
}

function bundleHtmlFile(
  entry: CanvasFile,
  files: CanvasFile[],
  previewId: string
): string {
  const baseDir = entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : '';
  let html = entry.content || '';

  // Inline local <link rel="stylesheet" href="..."> references from the workspace
  html = html.replace(
    /<link\b([^>]*?)href=["']([^"']+)["']([^>]*)>/gi,
    (full, before: string, href: string, after: string) => {
      const attrs = `${before} ${after}`;
      if (!/rel\s*=\s*["']?stylesheet["']?/i.test(attrs) && !href.toLowerCase().endsWith('.css')) {
        return full;
      }
      const target = resolveWorkspaceAsset(files, href, baseDir);
      if (!target) return full;
      return `<style data-canvas-file="${target.path}">\n${target.content}\n</style>`;
    }
  );

  // Inline local <script src="..."> references from the workspace
  html = html.replace(
    /<script\b([^>]*?)src=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (full, _before: string, src: string) => {
      const target = resolveWorkspaceAsset(files, src, baseDir);
      if (!target) return full;
      return `<script data-canvas-file="${target.path}">\n${escapeScriptClose(target.content)}\n</script>`;
    }
  );

  const bridge = `${PREVIEW_SCROLLBAR_STYLE}${getConsoleBridge(previewId)}`;
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${bridge}`);
  }
  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head><meta charset="utf-8">${bridge}</head>`);
  }

  // Partial HTML fragment: auto-attach sibling CSS/JS if the user didn't write a full <html> shell
  const cssTags = files
    .filter((f) => getFileExtension(f.path) === 'css')
    .map((f) => `<style>${f.content}</style>`)
    .join('\n');
  const jsTags = files
    .filter((f) => ['js', 'mjs'].includes(getFileExtension(f.path)))
    .map((f) => `<script>${escapeScriptClose(f.content)}</script>`)
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${bridge}
  <style>html,body{margin:0;min-height:100%;font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#0f172a}</style>
  ${cssTags}
</head>
<body>
  ${html}
  ${jsTags}
</body>
</html>`;
}

export function buildWorkspacePreviewDocument(
  files: CanvasFile[],
  activePath: string | null,
  previewId: string
): string {
  const codeFiles = files.filter((f) => f.kind === 'code');
  const activeFile = codeFiles.find((f) => f.path === activePath) || codeFiles[0];
  const bridge = `${PREVIEW_SCROLLBAR_STYLE}${getConsoleBridge(previewId)}`;

  if (!activeFile) {
    return `<!doctype html><html><head><meta charset="utf-8">${bridge}</head><body style="margin:0;display:grid;place-items:center;min-height:100vh;font-family:system-ui,sans-serif;color:#64748b;background:#fff">No HTML/CSS/JS files in workspace yet</body></html>`;
  }

  const activeLang = inferCodeLanguage(activeFile.path);

  if (activeLang === 'svg') {
    return `<!doctype html><html><head><meta charset="utf-8">${bridge}<style>html,body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff;padding:24px;box-sizing:border-box}svg{max-width:100%;height:auto}</style></head><body>${activeFile.content}</body></html>`;
  }

  if (activeLang === 'html') {
    return bundleHtmlFile(activeFile, codeFiles, previewId);
  }

  // If editing a .css or .js file, still preview the project's index.html when one exists
  const htmlEntry =
    codeFiles.find((f) => f.path.toLowerCase() === 'index.html') ||
    codeFiles.find((f) => ['html', 'htm'].includes(getFileExtension(f.path)));
  if (htmlEntry) {
    return bundleHtmlFile(htmlEntry, codeFiles, previewId);
  }

  if (activeLang === 'css') {
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  ${bridge}
  <style>${activeFile.content}</style>
</head>
<body>
  <div class="card" style="max-width:520px;margin:32px auto;padding:24px">
    <h1>Stylesheet Preview</h1>
    <p>Live preview for <code>${activeFile.path}</code>. Add an <code>index.html</code> file to customize layout.</p>
    <button type="button">Primary Button</button>
  </div>
</body>
</html>`;
  }

  if (activeLang === 'javascript') {
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  ${bridge}
  <style>
    html,body{margin:0;min-height:100vh;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#fff;color:#0f172a;padding:20px;box-sizing:border-box}
    #app{font-family:system-ui,-apple-system,sans-serif;margin-bottom:16px}
    .log-line{padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:13px;white-space:pre-wrap}
  </style>
</head>
<body>
  <div id="app"></div>
  <div id="dc-out"></div>
  <script>
    (() => {
      const out = document.getElementById('dc-out');
      const append = (label, args) => {
        const line = document.createElement('div');
        line.className = 'log-line';
        line.textContent = (label ? label + ': ' : '') + args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
        out.appendChild(line);
      };
      const origLog = console.log;
      console.log = (...args) => { append('', args); origLog.apply(console, args); };
      const origErr = console.error;
      console.error = (...args) => { append('error', args); origErr.apply(console, args); };
    })();
  </script>
  <script type="module">${escapeScriptClose(activeFile.content)}</script>
</body>
</html>`;
  }

  return `<!doctype html><html><head><meta charset="utf-8">${bridge}</head><body><pre style="padding:20px;font-family:monospace;white-space:pre-wrap">${activeFile.content.replace(/</g, '&lt;')}</pre></body></html>`;
}
