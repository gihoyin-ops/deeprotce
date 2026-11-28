'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import {
  Check,
  Code2,
  Copy,
  Download,
  FileDiff,
  FileSpreadsheet,
  FileText,
  PanelLeft,
  Presentation,
  Redo2,
  Undo2,
  X,
} from '@/components/ui/icons';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import {
  exportDeckToPdf,
  exportDeckToPptx,
  exportDocMarkdownToPdf,
  exportDocToDocx,
  exportPdfDocument,
  exportWorkbookToCsv,
  exportWorkbookToXlsx,
  exportWorkspaceAsZip,
  triggerBlobDownload,
} from '@/lib/canvas/exporters';
import {
  isBinaryOnlyPdfFile,
  parseDeckData,
  parsePdfData,
  parseWorkbookData,
  type CanvasFile,
  type CanvasFileKind,
  type CanvasMode,
  type CanvasPendingDiff,
} from '@/lib/canvas/types';

function KindIcon({ kind }: { kind: CanvasFileKind }) {
  switch (kind) {
    case 'sheet':
      return <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    case 'slides':
      return <Presentation className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    case 'doc':
      return <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" />;
    case 'pdf':
      return <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />;
    default:
      return <Code2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
  }
}

export function CanvasHeader({
  title,
  files,
  activeFile,
  activePendingDiff,
  pendingDiffCount,
  isAgentStreaming,
  isSaving,
  mode,
  isTreeOpen,
  canUndo,
  canRedo,
  onToggleTree,
  onModeChange,
  onRenameActiveFile,
  onUndo,
  onRedo,
  onClose,
}: {
  title: string;
  files: CanvasFile[];
  activeFile: CanvasFile | null;
  activePendingDiff: CanvasPendingDiff | null;
  pendingDiffCount: number;
  isAgentStreaming: boolean;
  isSaving: boolean;
  mode: CanvasMode;
  isTreeOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onToggleTree: () => void;
  onModeChange: (mode: CanvasMode) => void;
  onRenameActiveFile: (oldPath: string, newPath: string) => boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const exportRef = useRef<HTMLDivElement>(null);
  const tablistRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  const isBinaryPdf = activeFile ? isBinaryOnlyPdfFile(activeFile) : false;

  const tabs: Array<{ id: CanvasMode; label: string; icon?: React.ReactNode }> = activeFile
    ? isBinaryPdf
      ? [{ id: 'preview', label: 'Preview' }]
      : [
          { id: 'preview', label: 'Preview' },
          { id: 'edit', label: 'Edit' },
          ...(activePendingDiff ? [{ id: 'diff' as const, label: 'Diff', icon: <FileDiff className="h-3.5 w-3.5" /> }] : []),
        ]
    : [];

  // Gliding GSAP pill indicator under the active mode tab
  useLayoutEffect(() => {
    const listEl = tablistRef.current;
    const indEl = indicatorRef.current;
    if (!listEl || !indEl) return;
    const selectedBtn = listEl.querySelector<HTMLButtonElement>(`[data-mode="${mode}"]`);
    if (!selectedBtn) {
      gsap.set(indEl, { opacity: 0 });
      return;
    }

    const left = selectedBtn.offsetLeft;
    const width = selectedBtn.offsetWidth;
    if (prefersReducedMotion()) {
      gsap.set(indEl, { x: left, width, opacity: 1 });
      return;
    }

    gsap.to(indEl, {
      x: left,
      width,
      opacity: 1,
      duration: 0.26,
      ease: 'expo.out',
      overwrite: 'auto',
    });
  }, [mode, tabs.length]);

  useEffect(() => {
    if (!exportOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [exportOpen]);

  const handleCopy = async () => {
    if (!activeFile) return;
    await navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleExportAction = async (format: string) => {
    setExportOpen(false);
    if (format === 'zip') {
      await exportWorkspaceAsZip(files, title);
      return;
    }
    if (!activeFile) return;
    const baseName = activeFile.path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'export';

    if (format === 'raw') {
      triggerBlobDownload(
        new Blob([activeFile.content], { type: `${activeFile.mimeType};charset=utf-8` }),
        activeFile.path.split('/').pop() || 'file.txt'
      );
      return;
    }

    if (activeFile.kind === 'sheet') {
      const wb = parseWorkbookData(activeFile.content);
      if (format === 'csv') exportWorkbookToCsv(wb, 0, `${baseName}.csv`);
      else await exportWorkbookToXlsx(wb, `${baseName}.xlsx`);
      return;
    }

    if (activeFile.kind === 'doc') {
      if (format === 'pdf') await exportDocMarkdownToPdf(activeFile.content, baseName, `${baseName}.pdf`);
      else await exportDocToDocx(activeFile.content, baseName, `${baseName}.docx`);
      return;
    }

    if (activeFile.kind === 'slides') {
      const deck = parseDeckData(activeFile.content);
      if (format === 'pdf') await exportDeckToPdf(deck, `${baseName}.pdf`);
      else await exportDeckToPptx(deck, `${baseName}.pptx`);
      return;
    }

    if (activeFile.kind === 'pdf') {
      const url = activeFile.publicUrl || activeFile.binaryDataUrl;
      if (isBinaryPdf && url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}.pdf`;
        a.click();
      } else {
        await exportPdfDocument(parsePdfData(activeFile.content), `${baseName}.pdf`);
      }
    }
  };

  const commitName = () => {
    if (activeFile && nameDraft.trim()) {
      onRenameActiveFile(activeFile.path, nameDraft.trim());
    }
    setEditingName(false);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (tabs.length < 2) return;
    const curIdx = tabs.findIndex((t) => t.id === mode);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onModeChange(tabs[(curIdx + 1) % tabs.length].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onModeChange(tabs[(curIdx - 1 + tabs.length) % tabs.length].id);
    }
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[var(--dc-border-subtle)] bg-[var(--dc-panel)] px-2.5 sm:px-3.5">
      {/* Left: Workspace drawer toggle + active file name */}
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleTree}
          aria-expanded={isTreeOpen}
          title={isTreeOpen ? 'Hide files' : 'Show files'}
          aria-label={isTreeOpen ? 'Hide workspace files' : 'Show workspace files'}
          className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
            isTreeOpen
              ? 'bg-[var(--dc-surface-hover)] text-[var(--dc-text-strong)]'
              : 'text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]'
          }`}
        >
          <PanelLeft className="h-4 w-4" />
          {pendingDiffCount > 0 && !isTreeOpen && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
          )}
        </button>

        {activeFile ? (
          <div className="flex min-w-0 items-center gap-2">
            <KindIcon kind={activeFile.kind} />
            {editingName ? (
              <input
                type="text"
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitName();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                className="w-36 rounded-md bg-[var(--dc-surface-hover)] px-2 py-0.5 text-[13px] font-semibold text-[var(--dc-text-strong)] outline-none ring-1 ring-[var(--deepchat-accent)] sm:w-48"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setNameDraft(activeFile.path);
                  setEditingName(true);
                }}
                title="Click to rename file"
                className="min-w-0 truncate rounded-md px-1.5 py-0.5 text-[13px] font-semibold text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-surface-hover)]"
              >
                {activeFile.path}
              </button>
            )}
            {isAgentStreaming ? (
              <span className="hidden items-center gap-1.5 text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400 sm:inline-flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            ) : isSaving ? (
              <span className="hidden text-[11px] text-[var(--dc-text-faint)] sm:inline">Saving</span>
            ) : null}
          </div>
        ) : (
          <span className="truncate text-[13px] font-semibold text-[var(--dc-text-strong)]">
            Canvas
          </span>
        )}
      </div>

      {/* Center: Mode switcher (Preview | Edit | Diff) */}
      {tabs.length > 0 && (
        <div
          ref={tablistRef}
          role="tablist"
          aria-label="Canvas view mode"
          onKeyDown={handleTabKeyDown}
          className="relative flex items-center rounded-xl bg-[var(--dc-panel-muted)] p-0.5 ring-1 ring-[var(--dc-border-subtle)]"
        >
          <span
            ref={indicatorRef}
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0.5 left-0 top-0.5 rounded-[9px] bg-[var(--dc-surface)] shadow-2xs ring-1 ring-[var(--dc-border-subtle)]"
            style={{ opacity: 0 }}
          />
          {tabs.map((tab) => {
            const selected = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                data-mode={tab.id}
                aria-selected={selected}
                onClick={() => onModeChange(tab.id)}
                className={`relative z-10 inline-flex h-7 items-center gap-1.5 rounded-[9px] px-2.5 text-[12px] font-medium transition-colors sm:px-3 ${
                  selected
                    ? 'text-[var(--dc-text-strong)]'
                    : 'text-[var(--dc-text-muted)] hover:text-[var(--dc-text-strong)]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Right: Undo, Redo, Copy, Export, Close */}
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        {activeFile && !isBinaryPdf && (
          <>
            <button
              type="button"
              disabled={!canUndo}
              onClick={onUndo}
              title="Undo"
              aria-label="Undo"
              className="hidden h-8 w-8 items-center justify-center rounded-lg text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)] disabled:opacity-30 sm:inline-flex"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={onRedo}
              title="Redo"
              aria-label="Redo"
              className="hidden h-8 w-8 items-center justify-center rounded-lg text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)] disabled:opacity-30 sm:inline-flex"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              title={copied ? 'Copied' : 'Copy content'}
              aria-label="Copy content"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </>
        )}

        {(activeFile || files.length > 0) && (
          <div ref={exportRef} className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              title="Export"
              aria-label="Export"
              aria-expanded={exportOpen}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
            >
              <Download className="h-4 w-4" />
              <span className="hidden md:inline">Export</span>
            </button>

            {exportOpen && (
              <div className="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-1 shadow-lg">
                {activeFile?.kind === 'sheet' && (
                  <>
                    <ExportOption label="Download Excel (.xlsx)" onClick={() => void handleExportAction('xlsx')} />
                    <ExportOption label="Download CSV (.csv)" onClick={() => void handleExportAction('csv')} />
                  </>
                )}
                {activeFile?.kind === 'doc' && (
                  <>
                    <ExportOption label="Download Word (.docx)" onClick={() => void handleExportAction('docx')} />
                    <ExportOption label="Download PDF (.pdf)" onClick={() => void handleExportAction('pdf')} />
                    <ExportOption label="Download Markdown" onClick={() => void handleExportAction('raw')} />
                  </>
                )}
                {activeFile?.kind === 'slides' && (
                  <>
                    <ExportOption label="Download PowerPoint (.pptx)" onClick={() => void handleExportAction('pptx')} />
                    <ExportOption label="Download Slides PDF" onClick={() => void handleExportAction('pdf')} />
                  </>
                )}
                {activeFile?.kind === 'pdf' && (
                  <ExportOption label="Download PDF (.pdf)" onClick={() => void handleExportAction('pdf')} />
                )}
                {activeFile?.kind === 'code' && (
                  <ExportOption label={`Download ${activeFile.path}`} onClick={() => void handleExportAction('raw')} />
                )}
                {files.length > 0 && (
                  <ExportOption label="Download Workspace (.zip)" onClick={() => void handleExportAction('zip')} />
                )}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          title="Close Canvas"
          aria-label="Close Canvas"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function ExportOption({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-surface-hover)]"
    >
      <span className="truncate">{label}</span>
    </button>
  );
}
