'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FileDown, Plus, Printer, Trash2 } from '@/components/ui/icons';
import { buildPdfBlob, exportPdfDocument } from '@/lib/canvas/exporters';
import { parseStreamingPdf } from '@/lib/canvas/stream-parser';
import {
  isBinaryOnlyPdfFile,
  parsePdfData,
  type CanvasFile,
  type CanvasMode,
  type CanvasPdfData,
  type CanvasPdfSection,
} from '@/lib/canvas/types';

export function PdfCanvasEditor({
  file,
  mode,
  isStreaming,
  onChange,
}: {
  file: CanvasFile;
  mode: Exclude<CanvasMode, 'diff'>;
  isStreaming: boolean;
  onChange: (nextContent: string) => void;
}) {
  const isBinary = isBinaryOnlyPdfFile(file);
  const [previewMode, setPreviewMode] = useState<'layout' | 'native'>('layout');
  const [nativeUrl, setNativeUrl] = useState<string>('');

  const pdfData: CanvasPdfData = useMemo(() => {
    if (isStreaming) {
      return parseStreamingPdf(file.content) || parsePdfData(file.content);
    }
    return parsePdfData(file.content);
  }, [file.content, isStreaming]);

  useEffect(() => {
    if (isBinary || mode !== 'preview' || previewMode !== 'native') return;
    let active = true;
    let createdUrl = '';

    void buildPdfBlob(pdfData).then((blob) => {
      if (!active) return;
      createdUrl = URL.createObjectURL(blob);
      setNativeUrl(createdUrl);
    });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [isBinary, mode, pdfData, previewMode]);

  const baseName = file.path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'document';

  if (isBinary) {
    const src = file.publicUrl || file.binaryDataUrl || '';
    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--dc-panel-muted)]">
        <div className="flex items-center justify-between border-b border-[var(--dc-border-subtle)] bg-[var(--dc-panel)] px-3.5 py-1.5">
          <span className="truncate text-[12px] text-[var(--dc-text-muted)]">
            {file.path}
          </span>
          {src && (
            <a
              href={src}
              download={`${baseName}.pdf`}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[var(--dc-border)] bg-[var(--dc-surface)] px-2.5 text-[12px] font-medium text-[var(--dc-text-strong)] hover:bg-[var(--dc-surface-hover)]"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Download PDF</span>
            </a>
          )}
        </div>
        <div className="flex-1 p-2 sm:p-4">
          {src ? (
            <iframe
              src={src}
              title={file.path}
              className="h-full min-h-[420px] w-full rounded-xl border border-[var(--dc-border)] bg-white"
            />
          ) : (
            <div className="grid h-full place-items-center text-sm text-[var(--dc-text-muted)]">
              PDF source unavailable
            </div>
          )}
        </div>
      </div>
    );
  }

  const commitPdf = (next: CanvasPdfData) => {
    onChange(JSON.stringify(next, null, 2));
  };

  const updateSection = (idx: number, patch: Partial<CanvasPdfSection>) => {
    commitPdf({
      ...pdfData,
      sections: pdfData.sections.map((s, sIdx) => (sIdx === idx ? { ...s, ...patch } : s)),
    });
  };

  const addSection = () => {
    commitPdf({
      ...pdfData,
      sections: [
        ...pdfData.sections,
        {
          id: `sec-${Date.now()}`,
          heading: `${pdfData.sections.length + 1}. New Section`,
          body: 'Add section details here.',
        },
      ],
    });
  };

  const deleteSection = (idx: number) => {
    if (pdfData.sections.length <= 1) return;
    commitPdf({
      ...pdfData,
      sections: pdfData.sections.filter((_, sIdx) => sIdx !== idx),
    });
  };

  if (mode === 'preview') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--dc-panel-muted)]">
        <div className="flex items-center justify-between border-b border-[var(--dc-border-subtle)] bg-[var(--dc-panel)] px-3.5 py-1.5">
          <div className="flex items-center gap-1 rounded-lg bg-[var(--dc-panel-muted)] p-0.5">
            <button
              type="button"
              onClick={() => setPreviewMode('layout')}
              className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                previewMode === 'layout'
                  ? 'bg-[var(--dc-surface)] text-[var(--dc-text-strong)] shadow-2xs'
                  : 'text-[var(--dc-text-muted)]'
              }`}
            >
              Pages
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('native')}
              className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                previewMode === 'native'
                  ? 'bg-[var(--dc-surface)] text-[var(--dc-text-strong)] shadow-2xs'
                  : 'text-[var(--dc-text-muted)]'
              }`}
            >
              Native PDF
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => window.print()}
              className="hidden h-7 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)] sm:inline-flex"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={() => void exportPdfDocument(pdfData, `${baseName}.pdf`)}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[var(--dc-border)] bg-[var(--dc-surface)] px-2.5 text-[12px] font-medium text-[var(--dc-text-strong)] hover:bg-[var(--dc-surface-hover)]"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>.pdf</span>
            </button>
          </div>
        </div>

        {previewMode === 'native' ? (
          <div className="flex-1 p-2 sm:p-4">
            {nativeUrl ? (
              <iframe
                src={nativeUrl}
                title={`PDF preview ${file.path}`}
                className="h-full min-h-[420px] w-full rounded-xl border border-[var(--dc-border)] bg-white"
              />
            ) : (
              <div className="grid h-full place-items-center text-[13px] text-[var(--dc-text-muted)]">
                Rendering PDF...
              </div>
            )}
          </div>
        ) : (
          <div className="custom-scrollbar flex-1 overflow-y-auto p-3 sm:p-6">
            <div className="mx-auto max-w-[720px] rounded-2xl border border-[#e2e8f0] bg-white px-7 py-9 text-[#0f172a] shadow-sm sm:px-12 sm:py-12">
              <header className="border-b border-slate-200 pb-5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {pdfData.title}
                </h1>
                {pdfData.subtitle && (
                  <p className="mt-1.5 text-sm text-slate-600">{pdfData.subtitle}</p>
                )}
                {(pdfData.author || pdfData.date) && (
                  <p className="mt-2 text-xs text-slate-500">
                    {[pdfData.author, pdfData.date].filter(Boolean).join(' · ')}
                  </p>
                )}
              </header>

              <div className="mt-6 space-y-6">
                {pdfData.sections.map((section) => (
                  <section key={section.id} className="space-y-2.5">
                    {section.heading && (
                      <h2 className="text-base font-bold text-slate-900">{section.heading}</h2>
                    )}
                    {section.body && (
                      <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-slate-700">
                        {section.body}
                      </p>
                    )}
                    {section.bullets && section.bullets.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-slate-700">
                        {section.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
                    )}
                    {section.callout && (
                      <div className="rounded-xl bg-slate-100 px-4 py-3 text-[13px] leading-relaxed text-slate-800">
                        {section.callout}
                      </div>
                    )}
                    {section.table && (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full border-collapse text-left text-[12.5px]">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              {section.table.headers.map((h, hIdx) => (
                                <th key={hIdx} className="px-3 py-2 font-semibold text-slate-900">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {section.table.rows.map((row, rIdx) => (
                              <tr key={rIdx} className="border-b border-slate-100 last:border-b-0">
                                {row.map((cell, cIdx) => (
                                  <td key={cIdx} className="px-3 py-2 text-slate-700">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="custom-scrollbar h-full overflow-y-auto bg-[var(--dc-canvas)] p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="space-y-3 rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11.5px] font-semibold text-[var(--dc-text-muted)]">
                Document title
              </span>
              <input
                type="text"
                value={pdfData.title}
                onChange={(e) => commitPdf({ ...pdfData, title: e.target.value })}
                className="w-full rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-3 py-2 text-[13.5px] font-semibold text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11.5px] font-semibold text-[var(--dc-text-muted)]">
                Subtitle
              </span>
              <input
                type="text"
                value={pdfData.subtitle || ''}
                onChange={(e) => commitPdf({ ...pdfData, subtitle: e.target.value })}
                className="w-full rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-3 py-2 text-[13px] outline-none focus:border-[var(--deepchat-accent)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-[var(--dc-text-muted)]">
                Author
              </span>
              <input
                type="text"
                value={pdfData.author || ''}
                onChange={(e) => commitPdf({ ...pdfData, author: e.target.value })}
                className="w-full rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-3 py-1.5 text-[12.5px] outline-none focus:border-[var(--deepchat-accent)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-[var(--dc-text-muted)]">
                Date
              </span>
              <input
                type="text"
                value={pdfData.date || ''}
                onChange={(e) => commitPdf({ ...pdfData, date: e.target.value })}
                className="w-full rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-3 py-1.5 text-[12.5px] outline-none focus:border-[var(--deepchat-accent)]"
              />
            </label>
          </div>
        </div>

        {pdfData.sections.map((section, idx) => (
          <div
            key={section.id}
            className="space-y-3 rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <input
                type="text"
                value={section.heading}
                onChange={(e) => updateSection(idx, { heading: e.target.value })}
                placeholder="Section heading"
                className="min-w-0 flex-1 rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-3 py-1.5 text-[13px] font-semibold text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
              />
              {pdfData.sections.length > 1 && (
                <button
                  type="button"
                  onClick={() => deleteSection(idx)}
                  aria-label="Remove section"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--dc-text-muted)] hover:bg-rose-500/12 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <textarea
              rows={3}
              value={section.body || ''}
              onChange={(e) => updateSection(idx, { body: e.target.value })}
              placeholder="Paragraph text..."
              className="w-full rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-[var(--deepchat-accent)]"
            />

            <textarea
              rows={2}
              value={(section.bullets || []).join('\n')}
              onChange={(e) =>
                updateSection(idx, {
                  bullets: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="Bullet points (one per line)"
              className="w-full rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-3 py-2 text-[12.5px] outline-none focus:border-[var(--deepchat-accent)]"
            />

            <input
              type="text"
              value={section.callout || ''}
              onChange={(e) => updateSection(idx, { callout: e.target.value })}
              placeholder="Optional callout note..."
              className="w-full rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-3 py-1.5 text-[12.5px] outline-none focus:border-[var(--deepchat-accent)]"
            />
          </div>
        ))}

        <button
          type="button"
          onClick={addSection}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--dc-border-strong)] py-2.5 text-[12.5px] font-medium text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
        >
          <Plus className="h-4 w-4" />
          <span>Add section</span>
        </button>
      </div>
    </div>
  );
}
