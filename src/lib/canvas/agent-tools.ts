import { countDiffStats } from './diff';
import {
  getMimeTypeForCanvasFile,
  inferCanvasKind,
  normalizeCanvasPath,
  type CanvasFileKind,
  type CanvasOp,
} from './types';

export interface CanvasToolContextFile {
  path: string;
  kind: CanvasFileKind;
  content: string;
}

export interface SanitizedCanvasContext {
  enabled: boolean;
  activeFilePath: string | null;
  files: CanvasToolContextFile[];
}

export const OPENAI_CANVAS_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'canvas_write_file',
      description:
        'Create a new file or replace a full file inside the Canvas Workspace (HTML, CSS, JS, Markdown doc, Excel sheet JSON, PowerPoint slides JSON, or PDF JSON).',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              'Relative file path inside workspace, e.g. index.html, style.css, app.js, brief.docx, report.xlsx, deck.pptx, report.pdf.',
          },
          kind: {
            type: 'string',
            enum: ['code', 'doc', 'sheet', 'slides', 'pdf'],
            description: 'Artifact type for the file.',
          },
          content: {
            type: 'string',
            description: 'Complete file content (raw HTML/CSS/JS, Markdown for doc, or valid JSON for sheet/slides/pdf).',
          },
          summary: {
            type: 'string',
            description: 'Short 1-sentence summary of what was created or changed.',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'canvas_patch_file',
      description:
        'Apply one or more targeted search-and-replace edits to an existing file in the Canvas Workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Existing workspace file path to edit.',
          },
          edits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                search: {
                  type: 'string',
                  description: 'Exact substring currently in the file.',
                },
                replace: {
                  type: 'string',
                  description: 'Replacement substring.',
                },
              },
              required: ['search', 'replace'],
            },
          },
          summary: {
            type: 'string',
            description: 'Short 1-sentence summary of this patch.',
          },
        },
        required: ['path', 'edits'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'canvas_read_file',
      description: 'Read the latest content of a file in the Canvas Workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to read.',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'canvas_delete_file',
      description: 'Delete a file from the Canvas Workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to delete.',
          },
          summary: {
            type: 'string',
            description: 'Reason for deleting.',
          },
        },
        required: ['path'],
      },
    },
  },
];

const AUTO_CANVAS_PATTERNS = [
  /\b(open|use|in|on|buat|bikin|tampilkan|buka)\b[\s\S]{0,24}\bcanvas\b/i,
  /\b(create|build|make|generate|design|draft|buat|buatkan|bikin|bikinkan)\b[\s\S]{0,40}\b(powerpoint|pptx|ppt|slide deck|presentation|presentasi|spreadsheet|excel|xlsx|word doc|docx|pdf report|pdf document|dokumen pdf|landing page|web app|dashboard|html)\b/i,
  /\b(edit|update|ubah|revisi|perbaiki)\b[\s\S]{0,24}\b(canvas|workspace|slide|sheet|index\.html|style\.css|app\.js)\b/i,
];

export function shouldAutoEnableCanvas(prompt: string): boolean {
  const trimmed = prompt.trim();
  if (!trimmed) return false;
  return AUTO_CANVAS_PATTERNS.some((re) => re.test(trimmed));
}

export function sanitizeCanvasContext(raw: unknown): SanitizedCanvasContext {
  if (!raw || typeof raw !== 'object') {
    return { enabled: false, activeFilePath: null, files: [] };
  }
  const obj = raw as Record<string, unknown>;
  const enabled = obj.enabled === true;
  const activeFilePath =
    typeof obj.activeFilePath === 'string' ? normalizeCanvasPath(obj.activeFilePath) : null;

  const rawFiles = Array.isArray(obj.files) ? obj.files : [];
  const files: CanvasToolContextFile[] = [];
  let totalChars = 0;

  for (const item of rawFiles.slice(0, 24)) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const path = normalizeCanvasPath(typeof rec.path === 'string' ? rec.path : '');
    if (!path) continue;
    const content = typeof rec.content === 'string' ? rec.content.slice(0, 40_000) : '';
    if (totalChars + content.length > 120_000) break;
    totalChars += content.length;
    files.push({
      path,
      kind: inferCanvasKind(path, typeof rec.kind === 'string' ? rec.kind : undefined),
      content,
    });
  }

  return { enabled, activeFilePath, files };
}

export function buildCanvasSystemPrompt(
  mode: 'explicit' | 'workspace' | 'auto',
  files: CanvasToolContextFile[],
  activeFilePath: string | null
): string {
  const fileList =
    files.length > 0
      ? files
          .map(
            (f) =>
              `- ${f.path} (${f.kind}, ${f.content.length} chars)${f.path === activeFilePath ? ' [active]' : ''}`
          )
          .join('\n')
      : '(empty workspace)';

  const triggerNote =
    mode === 'explicit'
      ? 'Canvas mode is explicitly active.'
      : mode === 'workspace'
        ? 'The user already has files in their Canvas workspace.'
        : 'The user requested a deliverable suited for the live Canvas workspace.';

  return [
    `Benthos Canvas Workspace (${triggerNote}):`,
    `Current workspace files:\n${fileList}`,
    '',
    'Rules for working with Canvas:',
    '1. ALWAYS use `canvas_write_file` / `canvas_patch_file` to create or edit deliverables directly in the Canvas instead of pasting long code blocks or full documents into the chat message.',
    '2. NEVER output raw wrapper tags like <canvas>, <artifact>, or <tool> in your chat text. Keep your chat reply concise, natural, and focused on summarizing what you built or changed.',
    '3. For multi-file web projects, ONLY use pure HTML, CSS, and vanilla JavaScript (plus JSON or SVG). Do NOT generate React/JSX/TSX/Python files requiring a build server. Reference sibling CSS/JS cleanly with `<link rel="stylesheet" href="style.css">` and `<script src="app.js"></script>` in `index.html`.',
    '4. For existing files, prefer `canvas_patch_file` with exact `search` and `replace` edits so the user gets a clean diff to accept or reject.',
    '5. Use these exact file formats by type:',
    '   - `code` (.html, .css, .js, .json, .svg): raw source code.',
    '   - `doc` (.docx, .md): clean GitHub-flavored Markdown (# headings, tables, lists, bold).',
    '   - `sheet` (.xlsx): valid JSON `{"sheets":[{"name":"Summary","rows":[["Col1","Col2"],["Item",100],["Total","=SUM(B2:B2)"]]}]}` (Excel formulas like `=SUM()`, `=AVERAGE()`, `=IF()` are evaluated live).',
    '   - `slides` (.pptx): valid JSON `{"title":"Deck Title","theme":"minimal"|"midnight"|"editorial"|"emerald","slides":[{"id":"s1","layout":"title"|"content"|"two-column"|"metrics"|"quote"|"section","title":"...","subtitle":"...","bullets":["..."],"leftTitle":"...","leftBullets":["..."],"rightTitle":"...","rightBullets":["..."],"metrics":[{"label":"...","value":"...","note":"..."}],"quote":"...","author":"...","notes":"..."}]}`.',
    '   - `pdf` (.pdf): valid JSON `{"title":"...","subtitle":"...","author":"...","date":"YYYY-MM-DD","sections":[{"id":"sec1","heading":"...","body":"...","bullets":["..."],"table":{"headers":["..."],"rows":[["..."]]},"callout":"..."}]}`.',
  ].join('\n');
}

export function applyCanvasEdits(
  original: string,
  edits: Array<{ search?: unknown; replace?: unknown }>
): { ok: boolean; content: string; error?: string } {
  let next = original;

  for (let i = 0; i < edits.length; i += 1) {
    const search = typeof edits[i]?.search === 'string' ? (edits[i].search as string) : '';
    const replace = typeof edits[i]?.replace === 'string' ? (edits[i].replace as string) : '';
    if (!search) {
      return { ok: false, content: original, error: `Edit #${i + 1} is missing a search string.` };
    }

    if (next.includes(search)) {
      next = next.replace(search, () => replace);
      continue;
    }

    // Fallback: trimmed line-block match if whitespace slightly drifted
    const normNext = next.replace(/\r\n/g, '\n');
    const searchLines = search.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim());
    const targetLines = normNext.split('\n');
    let matchedStart = -1;

    if (searchLines.length > 0) {
      for (let row = 0; row <= targetLines.length - searchLines.length; row += 1) {
        let allMatch = true;
        for (let offset = 0; offset < searchLines.length; offset += 1) {
          if (targetLines[row + offset].trim() !== searchLines[offset]) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) {
          matchedStart = row;
          break;
        }
      }
    }

    if (matchedStart >= 0) {
      const before = targetLines.slice(0, matchedStart);
      const after = targetLines.slice(matchedStart + searchLines.length);
      next = [...before, replace, ...after].join('\n');
      continue;
    }

    return {
      ok: false,
      content: original,
      error: `Could not locate edit #${i + 1} target block in file.`,
    };
  }

  return { ok: true, content: next };
}

export function executeCanvasToolCall(
  name: string,
  args: Record<string, unknown>,
  workingFiles: Map<string, CanvasToolContextFile>
): {
  toolOutput: string;
  op?: CanvasOp;
} {
  const path = normalizeCanvasPath(typeof args.path === 'string' ? args.path : '');
  if (!path) {
    return { toolOutput: 'Error: Invalid or missing file path.' };
  }

  if (name === 'canvas_read_file') {
    const existing = workingFiles.get(path);
    if (!existing) {
      return { toolOutput: `File "${path}" does not exist in workspace.` };
    }
    return {
      toolOutput: `File: ${existing.path} (${existing.kind}, ${getMimeTypeForCanvasFile(existing.path, existing.kind)})\n\n${existing.content}`,
    };
  }

  if (name === 'canvas_delete_file') {
    const existing = workingFiles.get(path);
    if (!existing) {
      return { toolOutput: `File "${path}" does not exist.` };
    }
    workingFiles.delete(path);
    const stats = countDiffStats(existing.content, '');
    const op: CanvasOp = {
      id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action: 'delete',
      path,
      kind: existing.kind,
      content: '',
      previousContent: existing.content,
      summary: typeof args.summary === 'string' && args.summary.trim() ? args.summary.trim() : `Deleted ${path}`,
      linesAdded: stats.added,
      linesRemoved: stats.removed,
    };
    return { toolOutput: `Deleted ${path}.`, op };
  }

  if (name === 'canvas_write_file') {
    const content = typeof args.content === 'string' ? args.content : '';
    const existing = workingFiles.get(path);
    const kind = inferCanvasKind(path, typeof args.kind === 'string' ? args.kind : existing?.kind);
    const previousContent = existing?.content ?? '';
    workingFiles.set(path, { path, kind, content });
    const stats = countDiffStats(previousContent, content);
    const action = existing ? 'update' : 'create';
    const op: CanvasOp = {
      id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action,
      path,
      kind,
      content,
      ...(existing ? { previousContent } : {}),
      summary:
        typeof args.summary === 'string' && args.summary.trim()
          ? args.summary.trim()
          : `${action === 'create' ? 'Created' : 'Updated'} ${path}`,
      linesAdded: stats.added,
      linesRemoved: stats.removed,
    };
    return {
      toolOutput: `${action === 'create' ? 'Created' : 'Updated'} ${path} (+${stats.added} -${stats.removed}).`,
      op,
    };
  }

  if (name === 'canvas_patch_file') {
    const existing = workingFiles.get(path);
    if (!existing) {
      return { toolOutput: `Error: File "${path}" does not exist. Use canvas_write_file to create it.` };
    }
    const edits = Array.isArray(args.edits) ? args.edits : [];
    if (edits.length === 0) {
      return { toolOutput: 'Error: edits array is empty.' };
    }
    const patched = applyCanvasEdits(existing.content, edits);
    if (!patched.ok) {
      return { toolOutput: `Error patching ${path}: ${patched.error}` };
    }
    workingFiles.set(path, { path, kind: existing.kind, content: patched.content });
    const stats = countDiffStats(existing.content, patched.content);
    const op: CanvasOp = {
      id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action: 'update',
      path,
      kind: existing.kind,
      content: patched.content,
      previousContent: existing.content,
      summary:
        typeof args.summary === 'string' && args.summary.trim()
          ? args.summary.trim()
          : `Patched ${path}`,
      linesAdded: stats.added,
      linesRemoved: stats.removed,
    };
    return {
      toolOutput: `Patched ${path} (+${stats.added} -${stats.removed}).`,
      op,
    };
  }

  return { toolOutput: `Unsupported canvas tool: ${name}` };
}
