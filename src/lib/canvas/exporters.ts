import { columnIndexToLabel, evaluateSheet, parseCellRef } from './formula-engine';
import type {
  CanvasDeckData,
  CanvasFile,
  CanvasPdfData,
  CanvasPdfSection,
  CanvasSlide,
  CanvasSlideTheme,
  CanvasWorkbookData,
} from './types';

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ==========================================
// 1. EXCEL (.xlsx & .csv)
// ==========================================

export function parseCsvToRows(csv: string): string[][] {
  const lines = csv.replace(/\r\n/g, '\n').split('\n');
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  const rows: string[][] = [];
  for (const line of lines) {
    const row: string[] = [];
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
      } else if (ch === ',' && !inQuotes) {
        row.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    row.push(current);
    rows.push(row);
  }
  return rows.length > 0 ? rows : [['']];
}

export function exportWorkbookToCsv(
  workbook: CanvasWorkbookData,
  sheetIndex = 0,
  fileName = 'spreadsheet.csv'
): void {
  const sheet = workbook.sheets[sheetIndex] || workbook.sheets[0];
  if (!sheet) return;
  const evaluated = evaluateSheet(sheet.rows);
  const csv = evaluated
    .map((row) =>
      row
        .map((cell) => {
          const val = String(cell ?? '');
          return /[",\n\r]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;
        })
        .join(',')
    )
    .join('\n');
  triggerBlobDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileName);
}

export async function buildXlsxBlob(workbook: CanvasWorkbookData): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const sheets = workbook.sheets.length > 0 ? workbook.sheets : [{ name: 'Sheet1', rows: [['']] }];

  const sheetOverrides = sheets
    .map(
      (_s, idx) =>
        `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('');

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );

  const usedNames = new Set<string>();
  const sheetXmlTags = sheets
    .map((s, idx) => {
      let clean = (s.name || `Sheet${idx + 1}`).replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || `Sheet${idx + 1}`;
      if (usedNames.has(clean)) clean = `${clean.slice(0, 27)}_${idx + 1}`;
      usedNames.add(clean);
      return `<sheet name="${escapeXml(clean)}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`;
    })
    .join('');

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetXmlTags}</sheets>
</workbook>`
  );

  const wbRels = [
    ...sheets.map(
      (_s, idx) =>
        `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`
    ),
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
  ].join('');

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wbRels}</Relationships>`
  );

  zip.file(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`
  );

  sheets.forEach((sheet, idx) => {
    const evaluated = evaluateSheet(sheet.rows);
    const rowsXml = sheet.rows
      .map((row, rIdx) => {
        const styleAttr = rIdx === 0 ? ' s="1"' : '';
        const cellsXml = row
          .map((rawCell, cIdx) => {
            const ref = `${columnIndexToLabel(cIdx)}${rIdx + 1}`;
            const raw = String(rawCell ?? '');
            const evalVal = evaluated[rIdx]?.[cIdx] ?? raw;

            if (raw.startsWith('=')) {
              const formula = escapeXml(raw.slice(1));
              const isNum = evalVal !== '' && /^-?\d+(\.\d+)?$/.test(evalVal);
              if (isNum) {
                return `<c r="${ref}"${styleAttr}><f>${formula}</f><v>${evalVal}</v></c>`;
              }
              return `<c r="${ref}" t="str"${styleAttr}><f>${formula}</f><v>${escapeXml(evalVal)}</v></c>`;
            }

            if (raw.trim() !== '' && /^-?\d+(\.\d+)?$/.test(raw.trim())) {
              return `<c r="${ref}"${styleAttr}><v>${raw.trim()}</v></c>`;
            }

            return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${escapeXml(raw)}</t></is></c>`;
          })
          .join('');
        return `<row r="${rIdx + 1}">${cellsXml}</row>`;
      })
      .join('');

    zip.file(
      `xl/worksheets/sheet${idx + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowsXml}</sheetData>
</worksheet>`
    );
  });

  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function exportWorkbookToXlsx(
  workbook: CanvasWorkbookData,
  fileName = 'spreadsheet.xlsx'
): Promise<void> {
  const blob = await buildXlsxBlob(workbook);
  triggerBlobDownload(blob, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

export async function importXlsxBuffer(buffer: ArrayBuffer): Promise<CanvasWorkbookData> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);

  // Read sharedStrings if present
  const sharedStrings: string[] = [];
  const ssFile = zip.file('xl/sharedStrings.xml');
  if (ssFile) {
    const ssXml = await ssFile.async('string');
    const siMatches = ssXml.match(/<si\b[\s\S]*?<\/si>/g) || [];
    for (const si of siMatches) {
      const tMatches = si.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || [];
      const combined = tMatches
        .map((tag) => unescapeXml(tag.replace(/^<t\b[^>]*>/, '').replace(/<\/t>$/, '')))
        .join('');
      sharedStrings.push(combined);
    }
  }

  // Extract sheet names from workbook.xml
  const sheetNames: string[] = [];
  const wbFile = zip.file('xl/workbook.xml');
  if (wbFile) {
    const wbXml = await wbFile.async('string');
    const sheetTags = wbXml.match(/<sheet\b[^>]*>/g) || [];
    for (const tag of sheetTags) {
      const nameMatch = /\bname="([^"]+)"/.exec(tag);
      if (nameMatch) sheetNames.push(unescapeXml(nameMatch[1]));
    }
  }

  const sheetPaths = Object.keys(zip.files)
    .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const na = Number(a.match(/\d+/)?.[0] || 0);
      const nb = Number(b.match(/\d+/)?.[0] || 0);
      return na - nb;
    });

  const sheets = [];
  for (let idx = 0; idx < sheetPaths.length; idx += 1) {
    const xml = await zip.file(sheetPaths[idx])!.async('string');
    const rowMap = new Map<number, Map<number, string>>();
    let maxRow = 0;
    let maxCol = 0;

    const cellMatches = xml.match(/<c\b[\s\S]*?(?:\/>|<\/c>)/g) || [];
    for (const cellXml of cellMatches) {
      const refMatch = /\br="([A-Za-z]+\d+)"/.exec(cellXml);
      if (!refMatch) continue;
      const pos = parseCellRef(refMatch[1]);
      if (!pos) continue;
      maxRow = Math.max(maxRow, pos.row);
      maxCol = Math.max(maxCol, pos.col);

      const typeMatch = /\bt="([^"]+)"/.exec(cellXml);
      const cellType = typeMatch?.[1] || '';
      const fMatch = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(cellXml);
      const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cellXml);
      const isMatch = /<is>[\s\S]*?<t\b[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/.exec(cellXml);

      let value = '';
      if (fMatch) {
        value = `=${unescapeXml(fMatch[1])}`;
      } else if (cellType === 's' && vMatch) {
        value = sharedStrings[Number(vMatch[1])] ?? '';
      } else if (cellType === 'inlineStr' && isMatch) {
        value = unescapeXml(isMatch[1]);
      } else if (vMatch) {
        value = unescapeXml(vMatch[1]);
      }

      if (!rowMap.has(pos.row)) rowMap.set(pos.row, new Map());
      rowMap.get(pos.row)!.set(pos.col, value);
    }

    const rows: string[][] = [];
    for (let r = 0; r <= maxRow; r += 1) {
      const cols: string[] = [];
      const rMap = rowMap.get(r);
      for (let c = 0; c <= maxCol; c += 1) {
        cols.push(rMap?.get(c) ?? '');
      }
      rows.push(cols);
    }
    sheets.push({
      name: sheetNames[idx] || `Sheet${idx + 1}`,
      rows: rows.length > 0 ? rows : [['']],
    });
  }

  return {
    sheets: sheets.length > 0 ? sheets : [{ name: 'Sheet1', rows: [['']] }],
  };
}

// ==========================================
// 2. WORD (.docx)
// ==========================================

function renderMarkdownRunsToWordXml(text: string): string {
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const parts: string[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(`<w:r><w:t xml:space="preserve">${escapeXml(text.slice(last, match.index))}</w:t></w:r>`);
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escapeXml(token.slice(2, -2))}</w:t></w:r>`
      );
    } else if (token.startsWith('*')) {
      parts.push(
        `<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${escapeXml(token.slice(1, -1))}</w:t></w:r>`
      );
    } else {
      parts.push(
        `<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:color w:val="334155"/></w:rPr><w:t xml:space="preserve">${escapeXml(token.slice(1, -1))}</w:t></w:r>`
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) {
    parts.push(`<w:r><w:t xml:space="preserve">${escapeXml(text.slice(last))}</w:t></w:r>`);
  }
  return parts.join('') || '<w:r><w:t></w:t></w:r>';
}

export async function buildDocxBlob(markdown: string, title = 'Document'): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="1E293B"/></w:rPr>
    <w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="0F172A"/></w:rPr>
    <w:pPr><w:spacing w:before="240" w:after="140"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="0F172A"/></w:rPr>
    <w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1E293B"/></w:rPr>
    <w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr>
  </w:style>
</w:styles>`
  );

  const lines = (markdown || title).replace(/\r\n/g, '\n').split('\n');
  const bodyBlocks: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue;

    // Parse Markdown tables
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const rowLine = lines[i].trim();
        const cells = rowLine
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        const isSeparator = cells.every((c) => /^:?-{2,}:?$/.test(c));
        if (!isSeparator) tableRows.push(cells);
        i += 1;
      }
      i -= 1;

      if (tableRows.length > 0) {
        const rowsXml = tableRows
          .map((cells, rIdx) => {
            const cellsXml = cells
              .map(
                (cell) =>
                  `<w:tc><w:tcPr>${rIdx === 0 ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>' : ''}</w:tcPr><w:p><w:r>${rIdx === 0 ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`
              )
              .join('');
            return `<w:tr>${cellsXml}</w:tr>`;
          })
          .join('');
        bodyBlocks.push(
          `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/><w:left w:val="none"/><w:right w:val="none"/><w:insideV w:val="none"/></w:tblBorders></w:tblPr>${rowsXml}</w:tbl>`
        );
      }
      continue;
    }

    if (trimmed.startsWith('### ')) {
      bodyBlocks.push(`<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr>${renderMarkdownRunsToWordXml(trimmed.slice(4))}</w:p>`);
    } else if (trimmed.startsWith('## ')) {
      bodyBlocks.push(`<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>${renderMarkdownRunsToWordXml(trimmed.slice(3))}</w:p>`);
    } else if (trimmed.startsWith('# ')) {
      bodyBlocks.push(`<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${renderMarkdownRunsToWordXml(trimmed.slice(2))}</w:p>`);
    } else if (/^[-*]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[-*]\s+/, '');
      bodyBlocks.push(
        `<w:p><w:pPr><w:ind w:left="420"/></w:pPr><w:r><w:t xml:space="preserve">•  </w:t></w:r>${renderMarkdownRunsToWordXml(content)}</w:p>`
      );
    } else if (/^\d+\.\s+/.test(trimmed)) {
      bodyBlocks.push(
        `<w:p><w:pPr><w:ind w:left="420"/></w:pPr>${renderMarkdownRunsToWordXml(trimmed)}</w:p>`
      );
    } else if (trimmed.startsWith('> ')) {
      bodyBlocks.push(
        `<w:p><w:pPr><w:ind w:left="420"/><w:pBdr><w:left w:val="single" w:sz="12" w:space="12" w:color="94A3B8"/></w:pBdr></w:pPr>${renderMarkdownRunsToWordXml(trimmed.slice(2))}</w:p>`
      );
    } else if (/^---+$/.test(trimmed)) {
      bodyBlocks.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="6" w:color="CBD5E1"/></w:pBdr></w:pPr></w:p>');
    } else {
      bodyBlocks.push(`<w:p>${renderMarkdownRunsToWordXml(trimmed)}</w:p>`);
    }
  }

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyBlocks.join('\n')}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`
  );

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export async function exportDocToDocx(
  markdown: string,
  title = 'Document',
  fileName = 'document.docx'
): Promise<void> {
  const blob = await buildDocxBlob(markdown, title);
  triggerBlobDownload(blob, fileName.endsWith('.docx') ? fileName : `${fileName}.docx`);
}

export async function importDocxBuffer(buffer: ArrayBuffer): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) return '';

  const xml = await docFile.async('string');
  const paragraphs = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
  const mdLines: string[] = [];

  for (const p of paragraphs) {
    const tTags = p.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    const text = tTags
      .map((tag) => unescapeXml(tag.replace(/^<w:t\b[^>]*>/, '').replace(/<\/t>$/, '').replace(/<\/w:t>$/, '')))
      .join('')
      .trim();

    if (!text) continue;
    const styleMatch = /<w:pStyle\s+w:val="([^"]+)"/.exec(p);
    const style = (styleMatch?.[1] || '').toLowerCase();

    if (style.includes('heading1') || style === 'title') mdLines.push(`# ${text}`);
    else if (style.includes('heading2')) mdLines.push(`## ${text}`);
    else if (style.includes('heading3')) mdLines.push(`### ${text}`);
    else if (p.includes('<w:numPr>')) mdLines.push(`- ${text}`);
    else mdLines.push(text);
  }

  return mdLines.join('\n\n');
}

// ==========================================
// 3. POWERPOINT (.pptx)
// ==========================================

interface SlideThemePalette {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
}

export const SLIDE_THEME_PALETTES: Record<CanvasSlideTheme, SlideThemePalette> = {
  minimal: {
    bg: 'FFFFFF',
    surface: 'F8FAFC',
    text: '0F172A',
    muted: '475569',
    accent: '2563EB',
    border: 'E2E8F0',
  },
  midnight: {
    bg: '0F172A',
    surface: '1E293B',
    text: 'F8FAFC',
    muted: '94A3B8',
    accent: '38BDF8',
    border: '334155',
  },
  editorial: {
    bg: 'FAF8F5',
    surface: 'F1ECE4',
    text: '1C1917',
    muted: '57534E',
    accent: 'C2410C',
    border: 'E7E5E4',
  },
  emerald: {
    bg: '064E3B',
    surface: '065F46',
    text: 'ECFDF5',
    muted: 'A7F3D0',
    accent: '34D399',
    border: '047857',
  },
};

const EMU = 914400; // 1 inch in EMUs; 16:9 widescreen is 13.333in x 7.5in
const SLIDE_W = 12192000;
const SLIDE_H = 6858000;

function pptTextBox(
  id: number,
  x: number,
  y: number,
  w: number,
  h: number,
  paragraphs: Array<{ text: string; sizePt: number; color: string; bold?: boolean; italic?: boolean; align?: 'l' | 'ctr' | 'r' }>
): string {
  const pXml = paragraphs
    .map(
      (p) => `<a:p>
        <a:pPr algn="${p.align || 'l'}" marL="0" indent="0"><a:spcAft><a:spcPts val="600"/></a:spcAft></a:pPr>
        <a:r>
          <a:rPr lang="en-US" sz="${Math.round(p.sizePt * 100)}" b="${p.bold ? '1' : '0'}" i="${p.italic ? '1' : '0'}">
            <a:solidFill><a:srgbClr val="${p.color}"/></a:solidFill>
            <a:latin typeface="Calibri"/>
          </a:rPr>
          <a:t>${escapeXml(p.text)}</a:t>
        </a:r>
      </a:p>`
    )
    .join('');

  return `<p:sp>
    <p:nvSpPr><p:cNvPr id="${id}" name="TextBox ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
    <p:spPr>
      <a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(w)}" cy="${Math.round(h)}"/></a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    </p:spPr>
    <p:txBody><a:bodyPr wrap="square" anchor="t"/><a:lstStyle/>${pXml}</p:txBody>
  </p:sp>`;
}

function pptRect(id: number, x: number, y: number, w: number, h: number, fillHex: string, borderHex?: string): string {
  return `<p:sp>
    <p:nvSpPr><p:cNvPr id="${id}" name="Shape ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
    <p:spPr>
      <a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(w)}" cy="${Math.round(h)}"/></a:xfrm>
      <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
      <a:solidFill><a:srgbClr val="${fillHex}"/></a:solidFill>
      ${borderHex ? `<a:ln w="12700"><a:solidFill><a:srgbClr val="${borderHex}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>'}
    </p:spPr>
  </p:sp>`;
}

function renderSlideXml(slide: CanvasSlide, palette: SlideThemePalette, slideNumber: number): string {
  const shapes: string[] = [];
  let shapeId = 2;

  // Top subtle accent bar
  shapes.push(pptRect(shapeId++, 0, 0, SLIDE_W, 72000, palette.accent));

  if (slide.layout === 'title' || slide.layout === 'section') {
    shapes.push(
      pptTextBox(shapeId++, 0.9 * EMU, 2.2 * EMU, 11.5 * EMU, 2.2 * EMU, [
        { text: slide.title, sizePt: 40, color: palette.text, bold: true, align: 'ctr' },
        ...(slide.subtitle ? [{ text: slide.subtitle, sizePt: 20, color: palette.muted, align: 'ctr' as const }] : []),
      ])
    );
  } else if (slide.layout === 'quote') {
    shapes.push(
      pptTextBox(shapeId++, 1.3 * EMU, 1.8 * EMU, 10.7 * EMU, 3.6 * EMU, [
        { text: `"${slide.quote || slide.title}"`, sizePt: 28, color: palette.text, italic: true, align: 'ctr' },
        ...(slide.author ? [{ text: `- ${slide.author}`, sizePt: 16, color: palette.accent, bold: true, align: 'ctr' as const }] : []),
      ])
    );
  } else if (slide.layout === 'two-column') {
    shapes.push(
      pptTextBox(shapeId++, 0.8 * EMU, 0.55 * EMU, 11.7 * EMU, 0.9 * EMU, [
        { text: slide.title, sizePt: 28, color: palette.text, bold: true },
      ])
    );
    shapes.push(pptRect(shapeId++, 0.8 * EMU, 1.7 * EMU, 5.6 * EMU, 4.9 * EMU, palette.surface, palette.border));
    shapes.push(
      pptTextBox(shapeId++, 1.05 * EMU, 1.95 * EMU, 5.1 * EMU, 4.4 * EMU, [
        ...(slide.leftTitle ? [{ text: slide.leftTitle, sizePt: 18, color: palette.accent, bold: true }] : []),
        ...(slide.leftBullets || []).map((b) => ({ text: `•  ${b}`, sizePt: 15, color: palette.text })),
      ])
    );
    shapes.push(pptRect(shapeId++, 6.9 * EMU, 1.7 * EMU, 5.6 * EMU, 4.9 * EMU, palette.surface, palette.border));
    shapes.push(
      pptTextBox(shapeId++, 7.15 * EMU, 1.95 * EMU, 5.1 * EMU, 4.4 * EMU, [
        ...(slide.rightTitle ? [{ text: slide.rightTitle, sizePt: 18, color: palette.accent, bold: true }] : []),
        ...(slide.rightBullets || []).map((b) => ({ text: `•  ${b}`, sizePt: 15, color: palette.text })),
      ])
    );
  } else if (slide.layout === 'metrics') {
    shapes.push(
      pptTextBox(shapeId++, 0.8 * EMU, 0.55 * EMU, 11.7 * EMU, 1.1 * EMU, [
        { text: slide.title, sizePt: 28, color: palette.text, bold: true },
        ...(slide.subtitle ? [{ text: slide.subtitle, sizePt: 14, color: palette.muted }] : []),
      ])
    );
    const metrics = (slide.metrics || []).slice(0, 4);
    const count = Math.max(1, metrics.length);
    const gap = 0.35 * EMU;
    const totalW = 11.7 * EMU;
    const cardW = (totalW - gap * (count - 1)) / count;
    metrics.forEach((m, i) => {
      const cardX = 0.8 * EMU + i * (cardW + gap);
      shapes.push(pptRect(shapeId++, cardX, 2.2 * EMU, cardW, 3.2 * EMU, palette.surface, palette.border));
      shapes.push(
        pptTextBox(shapeId++, cardX + 0.25 * EMU, 2.6 * EMU, cardW - 0.5 * EMU, 2.5 * EMU, [
          { text: m.value, sizePt: 34, color: palette.accent, bold: true },
          { text: m.label, sizePt: 15, color: palette.text, bold: true },
          ...(m.note ? [{ text: m.note, sizePt: 12, color: palette.muted }] : []),
        ])
      );
    });
  } else {
    shapes.push(
      pptTextBox(shapeId++, 0.8 * EMU, 0.55 * EMU, 11.7 * EMU, 1.1 * EMU, [
        { text: slide.title, sizePt: 28, color: palette.text, bold: true },
        ...(slide.subtitle ? [{ text: slide.subtitle, sizePt: 14, color: palette.muted }] : []),
      ])
    );
    const bullets = (slide.bullets || []).map((b) => ({ text: `•  ${b}`, sizePt: 18, color: palette.text }));
    if (bullets.length > 0) {
      shapes.push(pptTextBox(shapeId++, 0.9 * EMU, 1.85 * EMU, 11.4 * EMU, 4.7 * EMU, bullets));
    }
  }

  // Slide number footer
  shapes.push(
    pptTextBox(shapeId++, 11.5 * EMU, 7.05 * EMU, 1.1 * EMU, 0.35 * EMU, [
      { text: String(slideNumber), sizePt: 11, color: palette.muted, align: 'r' },
    ])
  );

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="${palette.bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${shapes.join('\n')}
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

export async function buildPptxBlob(deck: CanvasDeckData): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const slides = deck.slides.length > 0 ? deck.slides : [{ id: 's1', layout: 'title' as const, title: deck.title }];
  const palette = SLIDE_THEME_PALETTES[deck.theme] || SLIDE_THEME_PALETTES.minimal;

  const slideOverrides = slides
    .flatMap((s, idx) => {
      const items = [
        `<Override PartName="/ppt/slides/slide${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
      ];
      if (s.notes?.trim()) {
        items.push(
          `<Override PartName="/ppt/notesSlides/notesSlide${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`
        );
      }
      return items;
    })
    .join('');

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slideOverrides}
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );

  const sldIds = slides.map((_s, idx) => `<p:sldId id="${256 + idx}" r:id="rId${idx + 2}"/>`).join('');
  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${sldIds}</p:sldIdLst>
  <p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`
  );

  const presRels = [
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`,
    ...slides.map(
      (_s, idx) =>
        `<Relationship Id="rId${idx + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${idx + 1}.xml"/>`
    ),
  ].join('');
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${presRels}</Relationships>`
  );

  zip.file(
    'ppt/theme/theme1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="CanvasTheme">
  <a:themeElements>
    <a:clrScheme name="Canvas">
      <a:dk1><a:srgbClr val="0F172A"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1E293B"/></a:dk2><a:lt2><a:srgbClr val="F8FAFC"/></a:lt2>
      <a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="0EA5E9"/></a:accent2>
      <a:accent3><a:srgbClr val="10B981"/></a:accent3><a:accent4><a:srgbClr val="F59E0B"/></a:accent4>
      <a:accent5><a:srgbClr val="8B5CF6"/></a:accent5><a:accent6><a:srgbClr val="EC4899"/></a:accent6>
      <a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Calibri"><a:majorFont><a:latin typeface="Calibri"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
  </a:themeElements>
</a:theme>`
  );

  zip.file(
    'ppt/slideMasters/slideMaster1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`
  );

  zip.file(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`
  );

  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sldLayout>`
  );

  zip.file(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`
  );

  slides.forEach((slide, idx) => {
    const num = idx + 1;
    zip.file(`ppt/slides/slide${num}.xml`, renderSlideXml(slide, palette, num));
    const slideRels = [
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`,
      ...(slide.notes?.trim()
        ? [`<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${num}.xml"/>`]
        : []),
    ].join('');
    zip.file(
      `ppt/slides/_rels/slide${num}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slideRels}</Relationships>`
    );

    if (slide.notes?.trim()) {
      zip.file(
        `ppt/notesSlides/notesSlide${num}.xml`,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
    ${pptTextBox(2, 0.5 * EMU, 0.5 * EMU, 6 * EMU, 6 * EMU, [{ text: slide.notes.trim(), sizePt: 12, color: '0F172A' }])}
  </p:spTree></p:cSld>
</p:notes>`
      );
    }
  });

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}

export async function exportDeckToPptx(
  deck: CanvasDeckData,
  fileName = 'presentation.pptx'
): Promise<void> {
  const blob = await buildPptxBlob(deck);
  triggerBlobDownload(blob, fileName.endsWith('.pptx') ? fileName : `${fileName}.pptx`);
}

export async function importPptxBuffer(buffer: ArrayBuffer): Promise<CanvasDeckData> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);

  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
    .sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));

  const slides: CanvasSlide[] = [];
  for (let i = 0; i < slidePaths.length; i += 1) {
    const xml = await zip.file(slidePaths[i])!.async('string');
    const paras = xml.match(/<a:p\b[\s\S]*?<\/a:p>/g) || [];
    const lines = paras
      .map((p) => {
        const runs = p.match(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g) || [];
        return runs
          .map((t) => unescapeXml(t.replace(/^<a:t\b[^>]*>/, '').replace(/<\/a:t>$/, '')))
          .join('')
          .trim();
      })
      .filter(Boolean);

    slides.push({
      id: `slide-${i + 1}`,
      layout: i === 0 ? 'title' : 'content',
      title: lines[0] || `Slide ${i + 1}`,
      ...(i === 0 && lines[1] ? { subtitle: lines.slice(1).join(' ') } : {}),
      ...(i > 0 && lines.length > 1 ? { bullets: lines.slice(1) } : {}),
    });
  }

  return {
    title: slides[0]?.title || 'Imported Presentation',
    theme: 'minimal',
    slides: slides.length > 0 ? slides : [{ id: 'slide-1', layout: 'title', title: 'Imported Presentation' }],
  };
}

// ==========================================
// 4. PDF (.pdf via jsPDF)
// ==========================================

export async function buildPdfBlob(pdf: CanvasPdfData): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 52;
  const maxW = pageW - margin * 2;
  let y = 58;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 54) {
      doc.addPage();
      y = 56;
    }
  };

  // Document header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(pdf.title || 'Document', maxW) as string[];
  doc.text(titleLines, margin, y);
  y += titleLines.length * 26 + 4;

  if (pdf.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(71, 85, 105);
    const subLines = doc.splitTextToSize(pdf.subtitle, maxW) as string[];
    doc.text(subLines, margin, y);
    y += subLines.length * 16 + 6;
  }

  const meta = [pdf.author, pdf.date].filter(Boolean).join('  •  ');
  if (meta) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(meta, margin, y);
    y += 14;
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y + 4, pageW - margin, y + 4);
  y += 24;

  for (const section of pdf.sections) {
    if (section.pageBreakBefore && y > 90) {
      doc.addPage();
      y = 56;
    }

    if (section.heading) {
      ensureSpace(32);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      const headLines = doc.splitTextToSize(section.heading, maxW) as string[];
      doc.text(headLines, margin, y);
      y += headLines.length * 19 + 4;
    }

    if (section.body) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.8);
      doc.setTextColor(51, 65, 85);
      for (const para of section.body.split(/\n{2,}/)) {
        const lines = doc.splitTextToSize(para.trim(), maxW) as string[];
        ensureSpace(lines.length * 15 + 8);
        doc.text(lines, margin, y);
        y += lines.length * 15 + 8;
      }
    }

    if (section.bullets && section.bullets.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.8);
      doc.setTextColor(51, 65, 85);
      for (const bullet of section.bullets) {
        const lines = doc.splitTextToSize(bullet, maxW - 18) as string[];
        ensureSpace(lines.length * 15 + 4);
        doc.text('•', margin + 4, y);
        doc.text(lines, margin + 18, y);
        y += lines.length * 15 + 4;
      }
      y += 4;
    }

    if (section.callout) {
      const lines = doc.splitTextToSize(section.callout, maxW - 24) as string[];
      const boxH = lines.length * 15 + 18;
      ensureSpace(boxH + 8);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, y - 12, maxW, boxH, 6, 6, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);
      doc.text(lines, margin + 12, y + 4);
      y += boxH + 4;
    }

    if (section.table && (section.table.headers.length > 0 || section.table.rows.length > 0)) {
      const colCount = Math.max(
        section.table.headers.length,
        ...section.table.rows.map((r) => r.length),
        1
      );
      const colW = maxW / colCount;
      const rowH = 22;

      if (section.table.headers.length > 0) {
        ensureSpace(rowH + 4);
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, y - 13, maxW, rowH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        section.table.headers.forEach((h, cIdx) => {
          doc.text(String(h).slice(0, 28), margin + cIdx * colW + 6, y + 2);
        });
        y += rowH;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      for (const row of section.table.rows) {
        ensureSpace(rowH);
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y + 8, pageW - margin, y + 8);
        row.forEach((cell, cIdx) => {
          doc.text(String(cell ?? '').slice(0, 28), margin + cIdx * colW + 6, y + 1);
        });
        y += rowH;
      }
      y += 10;
    }

    y += 10;
  }

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`${p} / ${totalPages}`, pageW - margin, pageH - 26, { align: 'right' });
  }

  return doc.output('blob');
}

export async function exportPdfDocument(
  pdf: CanvasPdfData,
  fileName = 'document.pdf'
): Promise<void> {
  const blob = await buildPdfBlob(pdf);
  triggerBlobDownload(blob, fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

export async function exportDocMarkdownToPdf(
  markdown: string,
  title = 'Document',
  fileName = 'document.pdf'
): Promise<void> {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let docTitle = title;
  const sections: CanvasPdfSection[] = [];
  let current: CanvasPdfSection = { id: 'sec-0', heading: '', body: '', bullets: [] };

  const pushCurrent = () => {
    if (current.heading || current.body?.trim() || (current.bullets && current.bullets.length > 0)) {
      sections.push({
        ...current,
        body: current.body?.trim() || undefined,
        bullets: current.bullets && current.bullets.length > 0 ? current.bullets : undefined,
      });
    }
  };

  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (current.body) current.body += '\n\n';
      return;
    }
    if (trimmed.startsWith('# ') && idx < 4 && !docTitle) {
      docTitle = trimmed.slice(2);
      return;
    }
    if (trimmed.startsWith('## ') || trimmed.startsWith('### ') || trimmed.startsWith('# ')) {
      pushCurrent();
      current = {
        id: `sec-${sections.length + 1}`,
        heading: trimmed.replace(/^#{1,3}\s+/, ''),
        body: '',
        bullets: [],
      };
      return;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      current.bullets = [...(current.bullets || []), trimmed.replace(/^[-*]\s+/, '').replace(/\*\*/g, '')];
      return;
    }
    current.body = `${current.body || ''}${trimmed.replace(/\*\*/g, '')} `;
  });
  pushCurrent();

  await exportPdfDocument(
    {
      title: docTitle || title,
      sections: sections.length > 0 ? sections : [{ id: 'sec-1', heading: 'Notes', body: markdown }],
    },
    fileName
  );
}

export async function exportDeckToPdf(
  deck: CanvasDeckData,
  fileName = 'presentation.pdf'
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [960, 540] });
  const palette = SLIDE_THEME_PALETTES[deck.theme] || SLIDE_THEME_PALETTES.minimal;

  const hexToRgb = (hex: string): [number, number, number] => [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];

  deck.slides.forEach((slide, idx) => {
    if (idx > 0) doc.addPage([960, 540], 'landscape');
    doc.setFillColor(...hexToRgb(palette.bg));
    doc.rect(0, 0, 960, 540, 'F');
    doc.setFillColor(...hexToRgb(palette.accent));
    doc.rect(0, 0, 960, 6, 'F');

    doc.setTextColor(...hexToRgb(palette.text));
    doc.setFont('helvetica', 'bold');

    if (slide.layout === 'title' || slide.layout === 'section') {
      doc.setFontSize(34);
      doc.text(doc.splitTextToSize(slide.title, 780) as string[], 480, 220, { align: 'center' });
      if (slide.subtitle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(17);
        doc.setTextColor(...hexToRgb(palette.muted));
        doc.text(doc.splitTextToSize(slide.subtitle, 740) as string[], 480, 285, { align: 'center' });
      }
    } else {
      doc.setFontSize(26);
      doc.text(slide.title, 56, 72);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(15);
      let y = 135;
      for (const b of slide.bullets || []) {
        const lines = doc.splitTextToSize(`•  ${b}`, 820) as string[];
        doc.text(lines, 62, y);
        y += lines.length * 22 + 10;
      }
      if (slide.metrics && slide.metrics.length > 0) {
        let x = 56;
        const w = (848 - (slide.metrics.length - 1) * 20) / slide.metrics.length;
        for (const m of slide.metrics) {
          doc.setFillColor(...hexToRgb(palette.surface));
          doc.roundedRect(x, 160, w, 180, 10, 10, 'F');
          doc.setTextColor(...hexToRgb(palette.accent));
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(28);
          doc.text(m.value, x + 20, 230);
          doc.setTextColor(...hexToRgb(palette.text));
          doc.setFontSize(14);
          doc.text(m.label, x + 20, 265);
          x += w + 20;
        }
      }
    }
  });

  triggerBlobDownload(doc.output('blob'), fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

// ==========================================
// 5. WORKSPACE ZIP
// ==========================================

export async function exportWorkspaceAsZip(
  files: CanvasFile[],
  title = 'workspace'
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (const file of files) {
    if (file.kind === 'sheet') {
      const { parseWorkbookData } = await import('./types');
      const blob = await buildXlsxBlob(parseWorkbookData(file.content));
      zip.file(file.path.endsWith('.xlsx') ? file.path : `${file.path}.xlsx`, blob);
    } else if (file.kind === 'slides') {
      const { parseDeckData } = await import('./types');
      const blob = await buildPptxBlob(parseDeckData(file.content));
      zip.file(file.path.endsWith('.pptx') ? file.path : `${file.path}.pptx`, blob);
    } else if (file.kind === 'pdf' && !file.binaryDataUrl) {
      const { parsePdfData } = await import('./types');
      const blob = await buildPdfBlob(parsePdfData(file.content));
      zip.file(file.path.endsWith('.pdf') ? file.path : `${file.path}.pdf`, blob);
    } else if (file.binaryDataUrl) {
      const base64 = file.binaryDataUrl.split(',')[1] || '';
      zip.file(file.path, base64, { base64: true });
    } else {
      zip.file(file.path, file.content);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
  triggerBlobDownload(zipBlob, `${slug}.zip`);
}
