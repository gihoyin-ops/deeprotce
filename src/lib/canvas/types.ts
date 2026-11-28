export type CanvasFileKind = 'code' | 'doc' | 'sheet' | 'slides' | 'pdf';

export type CanvasMode = 'preview' | 'edit' | 'diff';

export type CanvasCodeLanguage = 'html' | 'css' | 'javascript' | 'json' | 'svg';

export interface CanvasFile {
  id: string;
  path: string;
  kind: CanvasFileKind;
  language?: string;
  mimeType: string;
  content: string;
  r2Key?: string;
  publicUrl?: string;
  binaryDataUrl?: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface CanvasPendingDiff {
  path: string;
  kind: CanvasFileKind;
  baseContent: string;
  proposedContent: string;
  summary: string;
  action: 'create' | 'update' | 'delete';
  callId?: string;
  updatedAt: string;
}

export interface CanvasStreamingUpdate {
  callId: string;
  action: 'write' | 'patch';
  path: string;
  kind: CanvasFileKind;
  partialContent: string;
  summary?: string;
  updatedAt: number;
}

export interface CanvasOp {
  id: string;
  action: 'create' | 'update' | 'delete';
  path: string;
  kind: CanvasFileKind;
  content: string;
  previousContent?: string;
  summary: string;
  linesAdded: number;
  linesRemoved: number;
}

export interface CanvasMessageEvent {
  id: string;
  callId?: string;
  path: string;
  kind: CanvasFileKind;
  action: 'create' | 'update' | 'delete';
  status: 'streaming' | 'done';
  summary?: string;
  linesAdded?: number;
  linesRemoved?: number;
}

export interface CanvasWorkspaceRecord {
  chatId: string;
  title: string;
  activeFilePath: string | null;
  files: CanvasFile[];
  updatedAt: string;
}

export interface CanvasWorkspaceSnapshot {
  chatId: string;
  title: string;
  activeFilePath: string | null;
  files: Array<{
    path: string;
    kind: CanvasFileKind;
    content: string;
  }>;
}

export interface CanvasSheet {
  name: string;
  rows: string[][];
}

export interface CanvasWorkbookData {
  sheets: CanvasSheet[];
}

export type CanvasSlideLayout =
  | 'title'
  | 'content'
  | 'two-column'
  | 'metrics'
  | 'quote'
  | 'section';

export type CanvasSlideTheme = 'minimal' | 'midnight' | 'editorial' | 'emerald';

export interface CanvasSlideMetric {
  label: string;
  value: string;
  note?: string;
}

export interface CanvasSlide {
  id: string;
  layout: CanvasSlideLayout;
  title: string;
  subtitle?: string;
  bullets?: string[];
  leftTitle?: string;
  leftBullets?: string[];
  rightTitle?: string;
  rightBullets?: string[];
  metrics?: CanvasSlideMetric[];
  quote?: string;
  author?: string;
  notes?: string;
}

export interface CanvasDeckData {
  title: string;
  theme: CanvasSlideTheme;
  slides: CanvasSlide[];
}

export interface CanvasPdfTable {
  headers: string[];
  rows: string[][];
}

export interface CanvasPdfSection {
  id: string;
  heading: string;
  body?: string;
  bullets?: string[];
  table?: CanvasPdfTable;
  callout?: string;
  pageBreakBefore?: boolean;
}

export interface CanvasPdfData {
  title: string;
  subtitle?: string;
  author?: string;
  date?: string;
  sections: CanvasPdfSection[];
}

const VALID_KINDS = new Set<CanvasFileKind>(['code', 'doc', 'sheet', 'slides', 'pdf']);
const VALID_SLIDE_LAYOUTS = new Set<CanvasSlideLayout>([
  'title',
  'content',
  'two-column',
  'metrics',
  'quote',
  'section',
]);
const VALID_SLIDE_THEMES = new Set<CanvasSlideTheme>([
  'minimal',
  'midnight',
  'editorial',
  'emerald',
]);

export function normalizeCanvasPath(rawPath: string): string | null {
  if (typeof rawPath !== 'string') return null;
  const cleaned = rawPath
    .replace(/\\/g, '/')
    .replace(/\0/g, '')
    .trim()
    .replace(/^\/+/, '');

  if (!cleaned || cleaned.length > 160) return null;

  const segments = cleaned
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== '.');

  if (segments.length === 0) return null;
  if (segments.some((s) => s === '..' || /[<>:"|?*]/.test(s))) return null;

  return segments.join('/');
}

export function getFileExtension(path: string): string {
  const base = path.split('/').pop() || '';
  const idx = base.lastIndexOf('.');
  if (idx <= 0 || idx === base.length - 1) return '';
  return base.slice(idx + 1).toLowerCase();
}

export function getFileBaseName(path: string): string {
  return path.split('/').pop() || path;
}

export function inferCanvasKind(path: string, hint?: string): CanvasFileKind {
  const ext = getFileExtension(path);
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv' || ext === 'tsv') return 'sheet';
  if (ext === 'pptx' || ext === 'ppt') return 'slides';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx' || ext === 'doc' || ext === 'md' || ext === 'markdown' || ext === 'txt') {
    return 'doc';
  }
  if (
    ext === 'html' ||
    ext === 'htm' ||
    ext === 'css' ||
    ext === 'js' ||
    ext === 'mjs' ||
    ext === 'json' ||
    ext === 'svg'
  ) {
    return 'code';
  }
  if (hint && VALID_KINDS.has(hint as CanvasFileKind)) {
    return hint as CanvasFileKind;
  }
  return 'code';
}

export function inferCodeLanguage(path: string): string {
  const ext = getFileExtension(path);
  switch (ext) {
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
      return 'css';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'svg':
      return 'svg';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'csv':
    case 'tsv':
      return 'csv';
    default:
      return ext || 'text';
  }
}

export function getMimeTypeForCanvasFile(path: string, kind?: CanvasFileKind): string {
  const ext = getFileExtension(path);
  switch (ext) {
    case 'html':
    case 'htm':
      return 'text/html';
    case 'css':
      return 'text/css';
    case 'js':
    case 'mjs':
      return 'text/javascript';
    case 'json':
      return 'application/json';
    case 'svg':
      return 'image/svg+xml';
    case 'md':
    case 'markdown':
      return 'text/markdown';
    case 'txt':
      return 'text/plain';
    case 'csv':
      return 'text/csv';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'pdf':
      return 'application/pdf';
    default:
      return kind === 'doc' ? 'text/markdown' : 'text/plain';
  }
}

export function isBinaryOnlyPdfFile(file: CanvasFile): boolean {
  return (
    file.kind === 'pdf' &&
    Boolean(file.binaryDataUrl || file.publicUrl) &&
    !file.content.trim()
  );
}

export function createStarterContent(kind: CanvasFileKind, path = ''): string {
  const ext = getFileExtension(path);

  if (kind === 'code') {
    if (ext === 'css') {
      return `:root {
  color-scheme: light;
  font-family: system-ui, -apple-system, sans-serif;
}

body {
  margin: 0;
  padding: 2rem;
  background: #f8fafc;
  color: #0f172a;
}
`;
    }
    if (ext === 'js' || ext === 'mjs') {
      return `document.addEventListener('DOMContentLoaded', () => {
  console.log('Workspace script ready');
});
`;
    }
    if (ext === 'json') {
      return JSON.stringify({ name: 'workspace-data', items: [] }, null, 2);
    }
    if (ext === 'svg') {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" fill="none">
  <rect width="320" height="180" rx="16" fill="#0f172a"/>
  <circle cx="160" cy="90" r="44" fill="#38bdf8" fill-opacity="0.24" stroke="#38bdf8" stroke-width="2"/>
  <path d="M142 90l12 12 24-26" stroke="#e0f2fe" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
    }
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Canvas App</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: system-ui, -apple-system, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      padding: 24px;
    }
    .card {
      max-width: 440px;
      width: 100%;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 12px 30px -12px rgba(15, 23, 42, 0.12);
    }
    h1 { margin: 0 0 8px; font-size: 22px; }
    p { margin: 0 0 18px; color: #475569; line-height: 1.55; }
    button {
      border: 0;
      border-radius: 10px;
      padding: 10px 16px;
      font-weight: 600;
      background: #0f172a;
      color: #ffffff;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>Hello Canvas</h1>
    <p>Edit this HTML, CSS, or JS directly, or ask the assistant to build and refine it live.</p>
    <button id="ping">Test interaction</button>
  </main>
  <script>
    document.getElementById('ping')?.addEventListener('click', () => {
      console.log('Clicked at', new Date().toLocaleTimeString());
    });
  </script>
</body>
</html>
`;
  }

  if (kind === 'doc') {
    return `# Project Brief

Write or collaborate on structured notes, proposals, and reports here.

## Key Objectives

- Define the scope and core deliverables clearly
- Keep action items measurable and easy to review
- Export directly to Word (.docx), PDF, or Markdown

## Summary Table

| Milestone | Owner | Target |
| --- | --- | --- |
| Discovery | Product | Week 1 |
| Draft Review | Team | Week 2 |
| Final Delivery | Lead | Week 3 |
`;
  }

  if (kind === 'sheet') {
    const workbook: CanvasWorkbookData = {
      sheets: [
        {
          name: 'Summary',
          rows: [
            ['Item', 'Units', 'Unit Price', 'Total'],
            ['Design Sprint', '2', '1200', '=B2*C2'],
            ['Core Build', '4', '1500', '=B3*C3'],
            ['QA & Launch', '1', '900', '=B4*C4'],
            ['Grand Total', '=SUM(B2:B4)', '', '=SUM(D2:D4)'],
          ],
        },
      ],
    };
    return JSON.stringify(workbook, null, 2);
  }

  if (kind === 'slides') {
    const deck: CanvasDeckData = {
      title: 'Quarterly Overview',
      theme: 'minimal',
      slides: [
        {
          id: 'slide-1',
          layout: 'title',
          title: 'Quarterly Overview',
          subtitle: 'Key highlights, metrics, and next milestones',
          notes: 'Welcome everyone and outline the core goals for the quarter.',
        },
        {
          id: 'slide-2',
          layout: 'metrics',
          title: 'Performance Snapshot',
          subtitle: 'Measured against Q1 targets',
          metrics: [
            { label: 'Active Users', value: '24.8K', note: '+18% MoM' },
            { label: 'Completion Rate', value: '94.2%', note: '+4.1 pts' },
            { label: 'Response Time', value: '180ms', note: '-32% latency' },
          ],
          notes: 'Emphasize steady retention growth alongside faster response times.',
        },
        {
          id: 'slide-3',
          layout: 'content',
          title: 'Next Priorities',
          bullets: [
            'Ship streamlined onboarding flow for new teams',
            'Expand automated export support across workspace tools',
            'Run customer feedback sessions ahead of Q3 roadmap lock',
          ],
          notes: 'Close with owners and timeline check-in.',
        },
      ],
    };
    return JSON.stringify(deck, null, 2);
  }

  const pdf: CanvasPdfData = {
    title: 'Executive Summary Report',
    subtitle: 'Prepared in Benthos Canvas',
    author: 'Workspace Author',
    date: new Date().toISOString().slice(0, 10),
    sections: [
      {
        id: 'sec-1',
        heading: '1. Overview',
        body: 'This structured PDF document updates live as you or the assistant edits sections, tables, and callouts.',
        callout: 'Tip: Switch to Native PDF in the preview toolbar to inspect the compiled print output.',
      },
      {
        id: 'sec-2',
        heading: '2. Deliverables',
        bullets: [
          'Executive summary and problem framing',
          'Key financial and operational metrics',
          'Actionable timeline and ownership breakdown',
        ],
        table: {
          headers: ['Phase', 'Deliverable', 'Status'],
          rows: [
            ['Phase 1', 'Research & Architecture', 'Complete'],
            ['Phase 2', 'Implementation', 'In Progress'],
            ['Phase 3', 'Final Review', 'Planned'],
          ],
        },
      },
    ],
  };
  return JSON.stringify(pdf, null, 2);
}

const isRecord = (val: unknown): val is Record<string, unknown> =>
  Boolean(val && typeof val === 'object' && !Array.isArray(val));

export function parseWorkbookData(raw: string): CanvasWorkbookData {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { sheets: [{ name: 'Sheet1', rows: [['', '', ''], ['', '', '']] }] };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (isRecord(parsed) && Array.isArray(parsed.sheets)) {
      const sheets: CanvasSheet[] = parsed.sheets
        .filter(isRecord)
        .map((sheet, idx) => {
          const name = typeof sheet.name === 'string' && sheet.name.trim()
            ? sheet.name.trim().slice(0, 48)
            : `Sheet${idx + 1}`;
          const rawRows = Array.isArray(sheet.rows) ? sheet.rows : [];
          const rows = rawRows.map((r) =>
            Array.isArray(r) ? r.map((cell) => (cell == null ? '' : String(cell))) : [String(r ?? '')]
          );
          return { name, rows: rows.length > 0 ? rows : [['', '']] };
        });
      if (sheets.length > 0) return { sheets };
    }
    if (Array.isArray(parsed)) {
      const rows = parsed.map((r) =>
        Array.isArray(r) ? r.map((cell) => (cell == null ? '' : String(cell))) : [String(r ?? '')]
      );
      if (rows.length > 0) return { sheets: [{ name: 'Sheet1', rows }] };
    }
  } catch {
    // Fall back to CSV/TSV line parsing if text isn't JSON
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) {
    return { sheets: [{ name: 'Sheet1', rows: [['', '', '']] }] };
  }
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const rows = lines.map((line) => splitDelimitedLine(line, delimiter));
  return { sheets: [{ name: 'Sheet1', rows }] };
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

export function normalizeSlide(raw: unknown, idx: number): CanvasSlide {
  const obj = isRecord(raw) ? raw : {};
  const layoutRaw = typeof obj.layout === 'string' ? obj.layout : 'content';
  const layout: CanvasSlideLayout = VALID_SLIDE_LAYOUTS.has(layoutRaw as CanvasSlideLayout)
    ? (layoutRaw as CanvasSlideLayout)
    : 'content';

  const toList = (val: unknown): string[] | undefined =>
    Array.isArray(val) ? val.map((item) => String(item ?? '').trim()).filter(Boolean) : undefined;

  const metrics = Array.isArray(obj.metrics)
    ? obj.metrics
        .filter(isRecord)
        .map((m) => ({
          label: String(m.label ?? '').trim(),
          value: String(m.value ?? '').trim(),
          ...(typeof m.note === 'string' && m.note.trim() ? { note: m.note.trim() } : {}),
        }))
        .filter((m) => m.label || m.value)
    : undefined;

  return {
    id: typeof obj.id === 'string' && obj.id ? obj.id : `slide-${idx + 1}`,
    layout,
    title: typeof obj.title === 'string' ? obj.title : `Slide ${idx + 1}`,
    ...(typeof obj.subtitle === 'string' ? { subtitle: obj.subtitle } : {}),
    ...(toList(obj.bullets) ? { bullets: toList(obj.bullets) } : {}),
    ...(typeof obj.leftTitle === 'string' ? { leftTitle: obj.leftTitle } : {}),
    ...(toList(obj.leftBullets) ? { leftBullets: toList(obj.leftBullets) } : {}),
    ...(typeof obj.rightTitle === 'string' ? { rightTitle: obj.rightTitle } : {}),
    ...(toList(obj.rightBullets) ? { rightBullets: toList(obj.rightBullets) } : {}),
    ...(metrics && metrics.length > 0 ? { metrics } : {}),
    ...(typeof obj.quote === 'string' ? { quote: obj.quote } : {}),
    ...(typeof obj.author === 'string' ? { author: obj.author } : {}),
    ...(typeof obj.notes === 'string' ? { notes: obj.notes } : {}),
  };
}

export function parseDeckData(raw: string): CanvasDeckData {
  const fallback: CanvasDeckData = {
    title: 'Presentation',
    theme: 'minimal',
    slides: [{ id: 'slide-1', layout: 'title', title: 'Untitled Presentation', subtitle: '' }],
  };
  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (isRecord(parsed)) {
      const themeRaw = typeof parsed.theme === 'string' ? parsed.theme : 'minimal';
      const theme: CanvasSlideTheme = VALID_SLIDE_THEMES.has(themeRaw as CanvasSlideTheme)
        ? (themeRaw as CanvasSlideTheme)
        : 'minimal';
      const rawSlides = Array.isArray(parsed.slides) ? parsed.slides : [];
      const slides = rawSlides.map((s, i) => normalizeSlide(s, i));
      return {
        title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'Presentation',
        theme,
        slides: slides.length > 0 ? slides : fallback.slides,
      };
    }
  } catch {
    // Plain markdown outline fallback
  }

  return {
    title: 'Presentation',
    theme: 'minimal',
    slides: [
      {
        id: 'slide-1',
        layout: 'content',
        title: 'Slide Content',
        bullets: trimmed.split(/\r?\n/).map((s) => s.replace(/^[-*]\s*/, '').trim()).filter(Boolean).slice(0, 8),
      },
    ],
  };
}

export function normalizePdfSection(raw: unknown, idx: number): CanvasPdfSection {
  const obj = isRecord(raw) ? raw : {};
  const bullets = Array.isArray(obj.bullets)
    ? obj.bullets.map((b) => String(b ?? '').trim()).filter(Boolean)
    : undefined;

  let table: CanvasPdfTable | undefined;
  if (isRecord(obj.table)) {
    const headers = Array.isArray(obj.table.headers)
      ? obj.table.headers.map((h) => String(h ?? ''))
      : [];
    const rows = Array.isArray(obj.table.rows)
      ? obj.table.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : [String(r ?? '')]))
      : [];
    if (headers.length > 0 || rows.length > 0) {
      table = { headers, rows };
    }
  }

  return {
    id: typeof obj.id === 'string' && obj.id ? obj.id : `sec-${idx + 1}`,
    heading: typeof obj.heading === 'string' ? obj.heading : `Section ${idx + 1}`,
    ...(typeof obj.body === 'string' ? { body: obj.body } : {}),
    ...(bullets && bullets.length > 0 ? { bullets } : {}),
    ...(table ? { table } : {}),
    ...(typeof obj.callout === 'string' ? { callout: obj.callout } : {}),
    ...(obj.pageBreakBefore === true ? { pageBreakBefore: true } : {}),
  };
}

export function parsePdfData(raw: string): CanvasPdfData {
  const fallback: CanvasPdfData = {
    title: 'Document',
    sections: [{ id: 'sec-1', heading: 'Overview', body: '' }],
  };
  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (isRecord(parsed)) {
      const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
      const sections = rawSections.map((s, i) => normalizePdfSection(s, i));
      return {
        title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'Document',
        ...(typeof parsed.subtitle === 'string' ? { subtitle: parsed.subtitle } : {}),
        ...(typeof parsed.author === 'string' ? { author: parsed.author } : {}),
        ...(typeof parsed.date === 'string' ? { date: parsed.date } : {}),
        sections: sections.length > 0 ? sections : fallback.sections,
      };
    }
  } catch {
    // Plain text fallback if not JSON yet
  }

  return {
    title: 'Document',
    sections: [{ id: 'sec-1', heading: 'Content', body: trimmed }],
  };
}
