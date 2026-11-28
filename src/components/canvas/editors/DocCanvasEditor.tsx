'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { FileDown } from '@/components/ui/icons';
import { exportDocMarkdownToPdf, exportDocToDocx } from '@/lib/canvas/exporters';
import { safeSetHTML } from '@/lib/canvas/sanitize';
import type { CanvasFile, CanvasMode } from '@/lib/canvas/types';

const DOC_TOOLBAR_ACTIONS: Array<{
  label: string;
  before: string;
  after: string;
  placeholder: string;
  bold?: boolean;
  italic?: boolean;
}> = [
  { label: 'H1', before: '# ', after: '', placeholder: 'Heading' },
  { label: 'H2', before: '## ', after: '', placeholder: 'Section' },
  { label: 'B', before: '**', after: '**', placeholder: 'bold', bold: true },
  { label: 'I', before: '*', after: '*', placeholder: 'italic', italic: true },
  { label: 'List', before: '\n- ', after: '', placeholder: 'List item' },
  { label: 'Quote', before: '\n> ', after: '', placeholder: 'Quote' },
  {
    label: 'Table',
    before: '\n| Column A | Column B |\n| --- | --- |\n| Value 1 | Value 2 |\n',
    after: '',
    placeholder: '',
  },
];

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInlineMarkdown(raw: string): string {
  const escaped = escapeHtml(raw);
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToPreviewHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(escapeHtml(lines[i]));
        i += 1;
      }
      html.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i]
          .trim()
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i += 1;
      }
      i -= 1;
      if (rows.length > 0) {
        const [head, ...body] = rows;
        const thead = `<thead><tr>${head.map((c) => `<th>${formatInlineMarkdown(c)}</th>`).join('')}</tr></thead>`;
        const tbody = `<tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td>${formatInlineMarkdown(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody>`;
        html.push(`<table>${thead}${tbody}</table>`);
      }
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      html.push(`<h4>${formatInlineMarkdown(trimmed.slice(5))}</h4>`);
    } else if (trimmed.startsWith('### ')) {
      html.push(`<h3>${formatInlineMarkdown(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith('## ')) {
      html.push(`<h2>${formatInlineMarkdown(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith('# ')) {
      html.push(`<h1>${formatInlineMarkdown(trimmed.slice(2))}</h1>`);
    } else if (/^---+$/.test(trimmed)) {
      html.push('<hr/>');
    } else if (trimmed.startsWith('> ')) {
      html.push(`<blockquote><p>${formatInlineMarkdown(trimmed.slice(2))}</p></blockquote>`);
    } else if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(`<li>${formatInlineMarkdown(lines[i].trim().replace(/^[-*]\s+/, ''))}</li>`);
        i += 1;
      }
      i -= 1;
      html.push(`<ul>${items.join('')}</ul>`);
    } else if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${formatInlineMarkdown(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>`);
        i += 1;
      }
      i -= 1;
      html.push(`<ol>${items.join('')}</ol>`);
    } else {
      html.push(`<p>${formatInlineMarkdown(trimmed)}</p>`);
    }
  }

  return html.join('\n') || '<p></p>';
}

export function DocCanvasEditor({
  file,
  mode,
  onChange,
}: {
  file: CanvasFile;
  mode: Exclude<CanvasMode, 'diff'>;
  onChange: (nextContent: string) => void;
}) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const previewHtml = useMemo(() => markdownToPreviewHtml(file.content), [file.content]);

  useEffect(() => {
    if (mode !== 'preview') return;
    const el = previewContainerRef.current;
    if (!el) return;
    void safeSetHTML(el, previewHtml);
  }, [mode, previewHtml]);

  const baseName = file.path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'document';

  const insertSnippet = (before: string, after = '', placeholder = 'text') => {
    const ta = editorRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = file.content.slice(start, end) || placeholder;
    const next = `${file.content.slice(0, start)}${before}${selected}${after}${file.content.slice(end)}`;
    onChange(next);
    window.requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + selected.length;
    });
  };

  if (mode === 'preview') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--dc-panel-muted)]">
        <div className="flex items-center justify-between border-b border-[var(--dc-border-subtle)] bg-[var(--dc-panel)] px-4 py-1.5">
          <span className="text-[12px] text-[var(--dc-text-muted)]">
            {file.content.split(/\s+/).filter(Boolean).length} words
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void exportDocToDocx(file.content, baseName, `${baseName}.docx`)}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[var(--dc-border)] bg-[var(--dc-surface)] px-2.5 text-[12px] font-medium text-[var(--dc-text-strong)] hover:bg-[var(--dc-surface-hover)]"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>.docx</span>
            </button>
            <button
              type="button"
              onClick={() => void exportDocMarkdownToPdf(file.content, baseName, `${baseName}.pdf`)}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[var(--dc-border)] bg-[var(--dc-surface)] px-2.5 text-[12px] font-medium text-[var(--dc-text-strong)] hover:bg-[var(--dc-surface-hover)]"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>.pdf</span>
            </button>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-3 sm:p-6">
          <article className="dc-canvas-paper mx-auto min-h-[540px] max-w-[740px] rounded-2xl px-6 py-8 sm:px-12 sm:py-11">
            <div
              ref={previewContainerRef}
              className="prose prose-slate max-w-none dark:prose-invert prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-p:leading-relaxed prose-table:border-collapse prose-th:border prose-th:border-[var(--dc-border)] prose-th:bg-[var(--dc-panel-muted)] prose-th:px-3 prose-th:py-2 prose-th:text-left prose-td:border prose-td:border-[var(--dc-border-subtle)] prose-td:px-3 prose-td:py-2"
            />
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--dc-canvas)]">
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--dc-border-subtle)] bg-[var(--dc-panel)] px-3 py-1.5">
        {DOC_TOOLBAR_ACTIONS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => insertSnippet(item.before, item.after, item.placeholder)}
            className={`inline-flex h-7 items-center rounded-md px-2.5 text-[12px] text-[var(--dc-text-body)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)] ${
              item.bold ? 'font-bold' : item.italic ? 'italic font-medium' : 'font-medium'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-6 sm:px-10">
        <textarea
          ref={editorRef}
          value={file.content}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Start writing your document..."
          aria-label={`Edit ${file.path}`}
          className="mx-auto block min-h-[520px] w-full max-w-[720px] resize-none bg-transparent text-[15px] leading-[1.75] text-[var(--dc-text-strong)] outline-none placeholder:text-[var(--dc-text-placeholder)]"
        />
      </div>
    </div>
  );
}
