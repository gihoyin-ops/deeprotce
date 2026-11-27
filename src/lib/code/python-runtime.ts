import { codeNeedsConsoleInput, normalizeCodeLanguage } from '@/lib/code/code-runner-detection';

export interface PythonWorkspaceInputFile {
  name: string;
  ext?: string;
  content?: string;
  dataUrl?: string;
  base64?: string;
  previewUrl?: string;
}

export interface PreparedWorkspaceFile {
  name: string;
  kind: 'text' | 'base64';
  data: string;
}

export interface PythonOutputFile {
  name: string;
  mimeType: string;
  base64: string;
  size: number;
}

const MAX_WORKSPACE_INPUT_FILES = 12;
const MAX_WORKSPACE_INPUT_BYTES = 12 * 1024 * 1024;
export const PYTHON_EXECUTION_TIMEOUT_MS = 45_000;

const BLOCKED_DOWNLOAD_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'bash', 'ps1', 'vbs', 'vbe', 'js', 'mjs', 'cjs',
  'jsx', 'tsx', 'html', 'htm', 'xhtml', 'svgz', 'php', 'asp', 'aspx', 'jsp',
  'scr', 'msi', 'dll', 'com', 'pif', 'reg', 'hta', 'jar', 'app', 'dmg', 'pkg'
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv;charset=utf-8',
  tsv: 'text/tab-separated-values;charset=utf-8',
  json: 'application/json;charset=utf-8',
  txt: 'text/plain;charset=utf-8',
  md: 'text/markdown;charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  zip: 'application/zip'
};

export const isPythonLanguage = (language = '') => {
  const normalized = normalizeCodeLanguage(language);
  return normalized === 'python' || normalized === 'py';
};

export const sanitizeWorkspaceFilename = (rawName: string, fallback = 'file.dat'): string => {
  const base = rawName
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .split(/[\\/]/)
    .pop()
    ?.trim() || '';
  const cleaned = base
    .replace(/^\.+/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 96);
  return cleaned || fallback;
};

export const isSafeDownloadFilename = (filename: string): boolean => {
  const clean = sanitizeWorkspaceFilename(filename, '');
  if (!clean) return false;
  const ext = clean.split('.').pop()?.toLowerCase() || '';
  return !BLOCKED_DOWNLOAD_EXTENSIONS.has(ext);
};

export const resolveSafeMimeType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return MIME_BY_EXTENSION[ext] || 'application/octet-stream';
};

export const shouldAutoRunPython = (code: string, hasWorkspaceFiles: boolean): boolean => {
  if (!code.trim()) return false;
  if (codeNeedsConsoleInput('python', code)) return false;

  const isVisualizationOrFileTask = /\b(plotly|matplotlib|pyplot|seaborn|pandas|openpyxl|docx|pptx|fpdf|reportlab|PIL|Pillow|plt\.show|fig\.show|savefig|to_excel|to_csv|write_json|\.save\s*\(|\/workspace\/)\b/.test(code);
  if (isVisualizationOrFileTask) return true;

  if (hasWorkspaceFiles && /\b(open\s*\(|read_csv|read_excel|read_json|json\.load|csv\.)\b/.test(code)) {
    return true;
  }

  return false;
};

const extractBase64FromDataUrl = (dataUrl: string): string | null => {
  const match = dataUrl.match(/^data:[^;]*;base64,([A-Za-z0-9+/=]+)$/);
  return match ? match[1] : null;
};

export const prepareWorkspaceFiles = (files: PythonWorkspaceInputFile[]): PreparedWorkspaceFile[] => {
  const prepared: PreparedWorkspaceFile[] = [];
  const seenNames = new Set<string>();

  for (let i = 0; i < files.length && prepared.length < MAX_WORKSPACE_INPUT_FILES; i += 1) {
    const file = files[i];
    if (!file || typeof file.name !== 'string') continue;
    let name = sanitizeWorkspaceFilename(file.name, `input_${i + 1}.dat`);
    if (seenNames.has(name)) {
      const dot = name.lastIndexOf('.');
      name = dot > 0
        ? `${name.slice(0, dot)}_${i + 1}${name.slice(dot)}`
        : `${name}_${i + 1}`;
    }

    if (typeof file.base64 === 'string' && file.base64.length > 0 && file.base64.length <= MAX_WORKSPACE_INPUT_BYTES * 1.4) {
      seenNames.add(name);
      prepared.push({ name, kind: 'base64', data: file.base64 });
      continue;
    }

    if (typeof file.dataUrl === 'string' && file.dataUrl.startsWith('data:')) {
      const b64 = extractBase64FromDataUrl(file.dataUrl);
      if (b64 && b64.length <= MAX_WORKSPACE_INPUT_BYTES * 1.4) {
        seenNames.add(name);
        prepared.push({ name, kind: 'base64', data: b64 });
        continue;
      }
    }

    if (typeof file.content === 'string' && file.content.length > 0 && file.content.length <= MAX_WORKSPACE_INPUT_BYTES) {
      seenNames.add(name);
      prepared.push({ name, kind: 'text', data: file.content });
    }
  }

  return prepared;
};

export function buildPythonSandboxHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root {
    --bg: #ffffff;
    --fg: #0f172a;
    --muted: #64748b;
    --border: #e2e8f0;
    --surface: #f8fafc;
    --err-bg: #fef2f2;
    --err-fg: #991b1b;
    --err-border: #fecaca;
  }
  html.dark {
    --bg: #0d1117;
    --fg: #e2e8f0;
    --muted: #94a3b8;
    --border: #1e293b;
    --surface: #161b22;
    --err-bg: rgba(127, 29, 29, 0.25);
    --err-fg: #fecaca;
    --err-border: rgba(248, 113, 113, 0.35);
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    min-height: 100%;
    background: var(--bg);
    color: var(--fg);
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
  }
  #root {
    width: 100%;
    min-height: 220px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .status-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 180px;
    justify-content: center;
    color: var(--muted);
    font-size: 13px;
  }
  .spinner {
    width: 15px;
    height: 15px;
    border: 2px solid var(--border);
    border-top-color: var(--fg);
    border-radius: 999px;
    animation: spin 0.75s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .chart-wrap {
    position: relative;
    width: 100%;
    border-radius: 12px;
    background: var(--bg);
    overflow: hidden;
  }
  .chart-canvas {
    width: 100%;
    min-height: 340px;
    height: 360px;
  }
  .palette-bar {
    position: absolute;
    left: 10px;
    top: 10px;
    z-index: 10;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    border: 1px solid var(--border);
    backdrop-filter: blur(6px);
  }
  .palette-dot {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    border: 1.5px solid transparent;
    cursor: pointer;
    padding: 0;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }
  .palette-dot:hover { transform: scale(1.15); }
  .palette-dot.active { border-color: var(--fg); transform: scale(1.15); }
  .img-wrap {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }
  .img-wrap img {
    max-width: 100%;
    height: auto;
    border-radius: 10px;
  }
  .stdout-box {
    margin: 0;
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12.5px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .error-box {
    margin: 0;
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--err-bg);
    border: 1px solid var(--err-border);
    color: var(--err-fg);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12.5px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
</head>
<body>
<div id="root">
  <div class="status-row"><div class="spinner"></div><span id="status-text">Ready</span></div>
</div>

<script>
(() => {
  const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js';
  const PLOTLY_URL = 'https://cdn.plot.ly/plotly-2.35.2.min.js';
  const MAX_STDOUT_CHARS = 180000;
  const MAX_FILES = 10;
  const MAX_FILE_BYTES = 24 * 1024 * 1024;

  const PALETTES = [
    { id: 'default', color: '#2563eb', colors: ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] },
    { id: 'ocean', color: '#0284c7', colors: ['#0369a1', '#0284c7', '#06b6d4', '#14b8a6', '#38bdf8', '#6366f1'] },
    { id: 'emerald', color: '#059669', colors: ['#047857', '#10b981', '#34d399', '#84cc16', '#0d9488', '#14b8a6'] },
    { id: 'sunset', color: '#ea580c', colors: ['#ea580c', '#f97316', '#f59e0b', '#e11d48', '#ec4899', '#8b5cf6'] },
    { id: 'mono', color: '#475569', colors: ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1'] }
  ];

  let activePreviewId = '';
  let pyodidePromise = null;
  let plotlyPromise = null;
  let isRunning = false;

  const root = document.getElementById('root');

  const post = (type, payload = {}) => {
    if (!activePreviewId) return;
    parent.postMessage({
      source: 'deepchat-python-sandbox',
      previewId: activePreviewId,
      type,
      ...payload
    }, '*');
  };

  const applyTheme = (dark) => {
    document.documentElement.classList.toggle('dark', Boolean(dark));
  };

  const notifyHeight = () => {
    const h = Math.max(220, Math.min(720, document.documentElement.scrollHeight || 300));
    post('resize', { height: h });
  };

  const setStatus = (text) => {
    root.innerHTML = '<div class="status-row"><div class="spinner"></div><span></span></div>';
    root.querySelector('span').textContent = text;
    post('status', { text });
    requestAnimationFrame(notifyHeight);
  };

  const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load runtime script: ' + src));
    document.head.appendChild(s);
  });

  const getPyodide = async () => {
    if (!pyodidePromise) {
      pyodidePromise = (async () => {
        if (typeof window.loadPyodide !== 'function') {
          await loadScript(PYODIDE_URL);
        }
        return await window.loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/'
        });
      })();
    }
    return pyodidePromise;
  };

  const getPlotly = async () => {
    if (!plotlyPromise) {
      plotlyPromise = (async () => {
        if (!window.Plotly) {
          await loadScript(PLOTLY_URL);
        }
        return window.Plotly;
      })();
    }
    return plotlyPromise;
  };

  const base64ToUint8 = (b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };

  const uint8ToBase64 = (bytes) => {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  };

  const renderPlotlyChart = async (container, specJson, isDark, paletteIdx = 0) => {
    const Plotly = await getPlotly();
    const fig = typeof specJson === 'string' ? JSON.parse(specJson) : JSON.parse(JSON.stringify(specJson));
    const palette = PALETTES[paletteIdx] || PALETTES[0];

    const wrap = document.createElement('div');
    wrap.className = 'chart-wrap';

    const bar = document.createElement('div');
    bar.className = 'palette-bar';
    bar.title = 'Chart palette';

    const canvas = document.createElement('div');
    canvas.className = 'chart-canvas';

    wrap.appendChild(bar);
    wrap.appendChild(canvas);
    container.appendChild(wrap);

    const draw = (idx) => {
      const pal = PALETTES[idx] || PALETTES[0];
      const cloned = JSON.parse(JSON.stringify(fig));
      const data = Array.isArray(cloned.data) ? cloned.data : [];
      data.forEach((trace, tIdx) => {
        const c = pal.colors[tIdx % pal.colors.length];
        if (trace.type === 'pie') {
          trace.marker = Object.assign({}, trace.marker || {}, { colors: pal.colors });
        } else if (idx !== 0 || !trace.marker?.color) {
          trace.marker = Object.assign({}, trace.marker || {}, { color: c });
          if (trace.line) trace.line = Object.assign({}, trace.line, { color: c });
        }
      });

      const fg = isDark ? '#e2e8f0' : '#0f172a';
      const grid = isDark ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.08)';
      const bg = isDark ? '#0d1117' : '#ffffff';

      const layout = Object.assign({}, cloned.layout || {}, {
        paper_bgcolor: bg,
        plot_bgcolor: bg,
        font: Object.assign({ family: 'Inter, -apple-system, sans-serif', color: fg }, cloned.layout?.font || {}, { color: fg }),
        colorway: pal.colors,
        autosize: true,
        margin: Object.assign({ t: 48, r: 20, b: 44, l: 52 }, cloned.layout?.margin || {}),
        xaxis: Object.assign({ gridcolor: grid, zerolinecolor: grid }, cloned.layout?.xaxis || {}),
        yaxis: Object.assign({ gridcolor: grid, zerolinecolor: grid }, cloned.layout?.yaxis || {}),
        hoverlabel: {
          bgcolor: isDark ? '#1e293b' : '#0f172a',
          bordercolor: 'transparent',
          font: { color: '#f8fafc', size: 12 }
        }
      });

      Plotly.react(canvas, data, layout, {
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d', 'sendDataToCloud']
      });
    };

    PALETTES.forEach((p, idx) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'palette-dot' + (idx === paletteIdx ? ' active' : '');
      dot.style.background = p.color;
      dot.title = p.id;
      dot.addEventListener('click', () => {
        bar.querySelectorAll('.palette-dot').forEach((el, j) => el.classList.toggle('active', j === idx));
        draw(idx);
      });
      bar.appendChild(dot);
    });

    draw(paletteIdx);
    const ro = new ResizeObserver(() => {
      if (window.Plotly) window.Plotly.Plots.resize(canvas);
    });
    ro.observe(wrap);
  };

  const renderResults = async (payload, isDark) => {
    root.innerHTML = '';
    const charts = Array.isArray(payload.charts) ? payload.charts : [];
    const images = Array.isArray(payload.images) ? payload.images : [];
    const stdout = typeof payload.stdout === 'string' ? payload.stdout : '';
    const stderr = typeof payload.stderr === 'string' ? payload.stderr : '';
    const error = typeof payload.error === 'string' ? payload.error : '';

    for (const chartJson of charts) {
      await renderPlotlyChart(root, chartJson, isDark, 0);
    }

    for (const imgB64 of images) {
      const wrap = document.createElement('div');
      wrap.className = 'img-wrap';
      const img = document.createElement('img');
      img.src = 'data:image/png;base64,' + imgB64;
      img.alt = 'Python output chart';
      wrap.appendChild(img);
      root.appendChild(wrap);
    }

    if (stdout.trim() && charts.length === 0 && images.length === 0) {
      const pre = document.createElement('pre');
      pre.className = 'stdout-box';
      pre.textContent = stdout.trim();
      root.appendChild(pre);
    }

    if (error) {
      const pre = document.createElement('pre');
      pre.className = 'error-box';
      pre.textContent = error;
      root.appendChild(pre);
    } else if (stderr.trim() && charts.length === 0 && images.length === 0 && !stdout.trim()) {
      const pre = document.createElement('pre');
      pre.className = 'error-box';
      pre.textContent = stderr.trim();
      root.appendChild(pre);
    }

    if (!charts.length && !images.length && !stdout.trim() && !error && !stderr.trim()) {
      const pre = document.createElement('pre');
      pre.className = 'stdout-box';
      pre.textContent = 'Execution completed with no output.';
      root.appendChild(pre);
    }

    requestAnimationFrame(notifyHeight);
  };

  const runPython = async ({ code, files, isDark }) => {
    if (isRunning) return;
    isRunning = true;
    try {
      setStatus('Initializing Python runtime…');
      const pyodide = await getPyodide();

      // Prepare clean /workspace
      pyodide.runPython(\`
import os, shutil
os.makedirs('/workspace', exist_ok=True)
for _entry in os.listdir('/workspace'):
    _p = os.path.join('/workspace', _entry)
    try:
        if os.path.isdir(_p): shutil.rmtree(_p)
        else: os.remove(_p)
    except Exception:
        pass
os.chdir('/workspace')
\`);

      const inputNames = [];
      if (Array.isArray(files)) {
        for (const f of files) {
          if (!f || typeof f.name !== 'string') continue;
          const target = '/workspace/' + f.name;
          if (f.kind === 'base64') {
            pyodide.FS.writeFile(target, base64ToUint8(f.data));
          } else {
            pyodide.FS.writeFile(target, new TextEncoder().encode(String(f.data || '')));
          }
          inputNames.push(f.name);
        }
      }

      // Detect imports with AST
      pyodide.globals.set('_dc_user_code', String(code || ''));
      const importsJson = pyodide.runPython(\`
import ast, json
_BUILTIN_MAP = {
    'PIL': 'pillow',
    'Image': 'pillow',
    'cv2': 'opencv-python',
    'sklearn': 'scikit-learn',
    'bs4': 'beautifulsoup4',
    'yaml': 'pyyaml',
}
_MICROPIP_MAP = {
    'plotly': 'plotly',
    'openpyxl': 'openpyxl',
    'docx': 'python-docx',
    'pptx': 'python-pptx',
    'fpdf': 'fpdf2',
    'reportlab': 'reportlab',
    'pypdf': 'pypdf',
    'PyPDF2': 'pypdf',
    'seaborn': 'seaborn',
    'tabulate': 'tabulate',
    'xlsxwriter': 'xlsxwriter',
}
_STDLIB_OR_SKIP = {
    'os','sys','json','csv','math','re','io','time','datetime','statistics','random',
    'collections','itertools','functools','pathlib','shutil','zipfile','base64','hashlib',
    'urllib','http','html','xml','typing','dataclasses','enum','copy','string','tempfile'
}
_pkgs_builtin = set()
_pkgs_micropip = set()
try:
    _tree = ast.parse(_dc_user_code)
    for _node in ast.walk(_tree):
        if isinstance(_node, ast.Import):
            for _alias in _node.names:
                _top = _alias.name.split('.')[0]
                if _top in _STDLIB_OR_SKIP: continue
                if _top in _MICROPIP_MAP: _pkgs_micropip.add(_MICROPIP_MAP[_top])
                else: _pkgs_builtin.add(_BUILTIN_MAP.get(_top, _top))
        elif isinstance(_node, ast.ImportFrom) and _node.module:
            _top = _node.module.split('.')[0]
            if _top in _STDLIB_OR_SKIP: continue
            if _top in _MICROPIP_MAP: _pkgs_micropip.add(_MICROPIP_MAP[_top])
            else: _pkgs_builtin.add(_BUILTIN_MAP.get(_top, _top))
except SyntaxError:
    pass
json.dumps({'builtin': sorted(_pkgs_builtin), 'micropip': sorted(_pkgs_micropip)})
\`);

      const { builtin, micropip: pipPkgs } = JSON.parse(importsJson);
      const knownBuiltins = new Set([
        'numpy', 'pandas', 'matplotlib', 'scipy', 'pillow', 'scikit-learn',
        'sympy', 'lxml', 'beautifulsoup4', 'pyyaml', 'sqlite3', 'statsmodels', 'networkx'
      ]);

      const toLoadBuiltin = builtin.filter((p) => knownBuiltins.has(p));
      const extraUnknown = builtin.filter((p) => !knownBuiltins.has(p));

      if (toLoadBuiltin.length > 0) {
        setStatus('Loading packages (' + toLoadBuiltin.join(', ') + ')…');
        await pyodide.loadPackage(toLoadBuiltin);
      }

      if (pipPkgs.length > 0 || extraUnknown.length > 0) {
        setStatus('Installing packages…');
        await pyodide.loadPackage('micropip');
        const micropip = pyodide.pyimport('micropip');
        for (const pkg of [...pipPkgs, ...extraUnknown]) {
          try {
            await micropip.install(pkg);
          } catch (e) {
            // Let Python raise ImportError naturally if invalid
          }
        }
      }

      setStatus('Running Python…');

      pyodide.globals.set('_dc_input_names', pyodide.toPy(inputNames));
      const resultJson = await pyodide.runPythonAsync(\`
import sys, io, os, json, base64, traceback

_dc_charts = []
_dc_images = []
_dc_stdout = io.StringIO()
_dc_stderr = io.StringIO()
_dc_error = ''

_orig_stdout, _orig_stderr = sys.stdout, sys.stderr
sys.stdout = _dc_stdout
sys.stderr = _dc_stderr

# Snapshot input file mtimes/sizes
_before_files = {}
for _fn in os.listdir('/workspace'):
    _fp = os.path.join('/workspace', _fn)
    if os.path.isfile(_fp):
        _st = os.stat(_fp)
        _before_files[_fn] = (_st.st_size, _st.st_mtime_ns)

# Monkeypatch matplotlib.pyplot.show if imported/available
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    def _dc_plt_show(*args, **kwargs):
        for _num in plt.get_fignums():
            _fig = plt.figure(_num)
            _buf = io.BytesIO()
            _fig.savefig(_buf, format='png', dpi=160, bbox_inches='tight', facecolor='white')
            _dc_images.append(base64.b64encode(_buf.getvalue()).decode('ascii'))
        plt.close('all')
    plt.show = _dc_plt_show
except Exception:
    pass

# Monkeypatch plotly show if available
try:
    import plotly.io as pio
    import plotly.graph_objects as go
    def _dc_plotly_show(self_or_fig, *args, **kwargs):
        _fig = self_or_fig
        if hasattr(_fig, 'to_json'):
            _dc_charts.append(_fig.to_json())
    pio.show = _dc_plotly_show
    go.Figure.show = _dc_plotly_show
except Exception:
    pass

try:
    _ns = {'__name__': '__main__'}
    exec(compile(_dc_user_code, '<deepchat>', 'exec'), _ns)
except Exception:
    _dc_error = traceback.format_exc()
finally:
    sys.stdout = _orig_stdout
    sys.stderr = _orig_stderr

# Check if user manually wrote /workspace/chart.json
_chart_json_path = '/workspace/chart.json'
if os.path.isfile(_chart_json_path) and not _dc_charts:
    try:
        with open(_chart_json_path, 'r', encoding='utf-8') as _cf:
            _dc_charts.append(_cf.read())
    except Exception:
        pass

# Collect newly created or modified files in /workspace
_out_files = []
_scan_dirs = ['/workspace']
if os.path.isdir('/workspace/output'):
    _scan_dirs.append('/workspace/output')

for _d in _scan_dirs:
    for _fn in sorted(os.listdir(_d)):
        if _fn in ('chart.json', '__pycache__') or _fn.startswith('.'):
            continue
        _fp = os.path.join(_d, _fn)
        if not os.path.isfile(_fp):
            continue
        _st = os.stat(_fp)
        if _d == '/workspace' and _fn in _before_files:
            if _before_files[_fn] == (_st.st_size, _st.st_mtime_ns):
                continue
        if _st.st_size == 0 or _st.st_size > \${MAX_FILE_BYTES}:
            continue
        with open(_fp, 'rb') as _of:
            _out_files.append({
                'name': _fn,
                'size': _st.st_size,
                'base64': base64.b64encode(_of.read()).decode('ascii')
            })
        if len(_out_files) >= \${MAX_FILES}:
            break

json.dumps({
    'charts': _dc_charts,
    'images': _dc_images,
    'files': _out_files,
    'stdout': _dc_stdout.getvalue()[:\${MAX_STDOUT_CHARS}],
    'stderr': _dc_stderr.getvalue()[:\${MAX_STDOUT_CHARS}],
    'error': _dc_error[:\${MAX_STDOUT_CHARS}]
})
\`);

      const parsed = JSON.parse(resultJson);
      await renderResults(parsed, isDark);
      post('done', {
        charts: parsed.charts,
        images: parsed.images,
        files: parsed.files,
        stdout: parsed.stdout,
        stderr: parsed.stderr,
        error: parsed.error
      });
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      await renderResults({ error: message }, isDark);
      post('error', { error: message });
    } finally {
      isRunning = false;
    }
  };

  window.addEventListener('message', async (event) => {
    const data = event.data;
    if (!data || data.source !== 'deepchat-python-host') return;
    if (typeof data.previewId !== 'string' || !data.previewId) return;

    activePreviewId = data.previewId;
    applyTheme(data.isDark);

    if (data.type === 'execute') {
      await runPython({
        code: data.code || '',
        files: data.files || [],
        isDark: Boolean(data.isDark)
      });
    } else if (data.type === 'render_cached') {
      await renderResults(data.result || {}, Boolean(data.isDark));
    } else if (data.type === 'theme') {
      // Theme updates only CSS variables; Plotly redraws on next render if needed
    }
  });

  parent.postMessage({ source: 'deepchat-python-sandbox', type: 'ready' }, '*');
})();
<\/script>
</body>
</html>`;
}
