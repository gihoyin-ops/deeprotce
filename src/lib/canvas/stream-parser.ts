import {
  inferCanvasKind,
  normalizeCanvasPath,
  normalizePdfSection,
  normalizeSlide,
  type CanvasDeckData,
  type CanvasFileKind,
  type CanvasPdfData,
  type CanvasSlideTheme,
  type CanvasWorkbookData,
} from './types';

export interface StreamingCanvasFields {
  path?: string;
  kind?: CanvasFileKind;
  content?: string;
  summary?: string;
}

// Scans incomplete JSON tool arguments so we can stream string fields live before the closing brace lands
function extractJsonStringField(raw: string, key: string): string | undefined {
  const keyPattern = new RegExp(`"${key}"\\s*:\\s*"`);
  const match = keyPattern.exec(raw);
  if (!match) return undefined;

  let idx = match.index + match[0].length;
  let result = '';

  while (idx < raw.length) {
    const ch = raw[idx];
    if (ch === '"') {
      return result;
    }
    if (ch === '\\') {
      if (idx + 1 >= raw.length) break;
      const next = raw[idx + 1];
      if (next === 'n') result += '\n';
      else if (next === 'r') result += '\r';
      else if (next === 't') result += '\t';
      else if (next === 'b') result += '\b';
      else if (next === 'f') result += '\f';
      else if (next === '"' || next === '\\' || next === '/') result += next;
      else if (next === 'u') {
        const hex = raw.slice(idx + 2, idx + 6);
        if (hex.length < 4) break;
        const code = Number.parseInt(hex, 16);
        if (!Number.isNaN(code)) result += String.fromCharCode(code);
        idx += 6;
        continue;
      } else {
        result += next;
      }
      idx += 2;
      continue;
    }
    result += ch;
    idx += 1;
  }

  return result;
}

export function extractStreamingCanvasFields(rawArgs: string): StreamingCanvasFields {
  const rawPath = extractJsonStringField(rawArgs, 'path');
  const path = rawPath ? normalizeCanvasPath(rawPath) || undefined : undefined;
  const rawKind = extractJsonStringField(rawArgs, 'kind');
  const kind = path ? inferCanvasKind(path, rawKind) : undefined;
  const content = extractJsonStringField(rawArgs, 'content');
  const summary = extractJsonStringField(rawArgs, 'summary');

  return { path, kind, content, summary };
}

function extractCompletedObjectsFromArray(raw: string, arrayKey: string): unknown[] {
  const keyRegex = new RegExp(`"${arrayKey}"\\s*:\\s*\\[`);
  const match = keyRegex.exec(raw);
  if (!match) return [];

  const objects: unknown[] = [];
  let i = match.index + match[0].length;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let objStart = -1;

  while (i < raw.length) {
    const ch = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }

    if (ch === '"') {
      inString = true;
      i += 1;
      continue;
    }

    if (ch === ']' && depth === 0) {
      break;
    }

    if (ch === '{') {
      if (depth === 0) objStart = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && objStart >= 0) {
        const chunk = raw.slice(objStart, i + 1);
        try {
          objects.push(JSON.parse(chunk));
        } catch {
          // Ignore malformed partial object
        }
        objStart = -1;
      }
    }
    i += 1;
  }

  return objects;
}

export function parseStreamingDeck(rawText: string): CanvasDeckData | null {
  try {
    const full = JSON.parse(rawText) as { title?: string; theme?: CanvasSlideTheme; slides?: unknown[] };
    if (full && typeof full === 'object' && Array.isArray(full.slides)) {
      return {
        title: typeof full.title === 'string' && full.title ? full.title : 'Presentation',
        theme: full.theme || 'minimal',
        slides: full.slides.map((s, idx) => normalizeSlide(s, idx)),
      };
    }
  } catch {
    // Expected while JSON is still streaming
  }

  const title = extractJsonStringField(rawText, 'title') || 'Presentation';
  const themeRaw = extractJsonStringField(rawText, 'theme') as CanvasSlideTheme | undefined;
  const theme: CanvasSlideTheme =
    themeRaw === 'midnight' || themeRaw === 'editorial' || themeRaw === 'emerald'
      ? themeRaw
      : 'minimal';
  const rawSlides = extractCompletedObjectsFromArray(rawText, 'slides');
  if (rawSlides.length === 0) return null;

  return {
    title,
    theme,
    slides: rawSlides.map((s, idx) => normalizeSlide(s, idx)),
  };
}

export function parseStreamingPdf(rawText: string): CanvasPdfData | null {
  try {
    const full = JSON.parse(rawText) as {
      title?: string;
      subtitle?: string;
      author?: string;
      date?: string;
      sections?: unknown[];
    };
    if (full && typeof full === 'object' && Array.isArray(full.sections)) {
      return {
        title: typeof full.title === 'string' && full.title ? full.title : 'Document',
        subtitle: full.subtitle,
        author: full.author,
        date: full.date,
        sections: full.sections.map((s, idx) => normalizePdfSection(s, idx)),
      };
    }
  } catch {
    // Still streaming JSON
  }

  const title = extractJsonStringField(rawText, 'title') || 'Document';
  const subtitle = extractJsonStringField(rawText, 'subtitle');
  const author = extractJsonStringField(rawText, 'author');
  const date = extractJsonStringField(rawText, 'date');
  const rawSections = extractCompletedObjectsFromArray(rawText, 'sections');
  if (rawSections.length === 0) return null;

  return {
    title,
    subtitle,
    author,
    date,
    sections: rawSections.map((s, idx) => normalizePdfSection(s, idx)),
  };
}

export function parseStreamingWorkbook(rawText: string): CanvasWorkbookData | null {
  try {
    const full = JSON.parse(rawText) as { sheets?: Array<{ name?: string; rows?: unknown[][] }> };
    if (full && typeof full === 'object' && Array.isArray(full.sheets) && full.sheets.length > 0) {
      return {
        sheets: full.sheets.map((s, idx) => ({
          name: typeof s.name === 'string' && s.name ? s.name : `Sheet${idx + 1}`,
          rows: Array.isArray(s.rows)
            ? s.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : []))
            : [['']],
        })),
      };
    }
  } catch {
    // Partial JSON while streaming
  }

  const completedSheets = extractCompletedObjectsFromArray(rawText, 'sheets') as Array<{
    name?: string;
    rows?: unknown[][];
  }>;
  if (completedSheets.length > 0) {
    return {
      sheets: completedSheets.map((s, idx) => ({
        name: typeof s.name === 'string' && s.name ? s.name : `Sheet${idx + 1}`,
        rows: Array.isArray(s.rows)
          ? s.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : []))
          : [['']],
      })),
    };
  }

  // Extract individual completed rows inside the active sheet so spreadsheets visibly stream row by row
  const rowsMatch = /"rows"\s*:\s*\[/.exec(rawText);
  if (!rowsMatch) return null;

  const sheetName = extractJsonStringField(rawText, 'name') || 'Sheet1';
  const rows: string[][] = [];
  let i = rowsMatch.index + rowsMatch[0].length;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let rowStart = -1;

  while (i < rawText.length) {
    const ch = rawText[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inString = true;
      i += 1;
      continue;
    }
    if (ch === ']' && depth === 0) break;
    if (ch === '[') {
      if (depth === 0) rowStart = i;
      depth += 1;
    } else if (ch === ']') {
      depth -= 1;
      if (depth === 0 && rowStart >= 0) {
        try {
          const parsedRow = JSON.parse(rawText.slice(rowStart, i + 1)) as unknown[];
          if (Array.isArray(parsedRow)) {
            rows.push(parsedRow.map((c) => String(c ?? '')));
          }
        } catch {
          // Ignore partial row
        }
        rowStart = -1;
      }
    }
    i += 1;
  }

  if (rows.length === 0) return null;
  return { sheets: [{ name: sheetName, rows }] };
}
