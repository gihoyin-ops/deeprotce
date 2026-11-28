'use client';

import React, { useRef, useState } from 'react';
import {
  Check,
  Code2,
  Edit3,
  FilePlus,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Presentation,
  Trash2,
  X,
} from '@/components/ui/icons';
import { countDiffStats } from '@/lib/canvas/diff';
import type { CanvasFile, CanvasFileKind, CanvasPendingDiff } from '@/lib/canvas/types';

function FileKindGlyph({ kind }: { kind: CanvasFileKind }) {
  switch (kind) {
    case 'sheet':
      return <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />;
    case 'slides':
      return <Presentation className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />;
    case 'doc':
      return <FileText className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />;
    case 'pdf':
      return <FileText className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />;
    default:
      return <Code2 className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />;
  }
}

export function CanvasFileTree({
  files,
  activePath,
  pendingDiffs,
  onSelectFile,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  onImportFiles,
  onAcceptAllDiffs,
  onRejectAllDiffs,
}: {
  files: CanvasFile[];
  activePath: string | null;
  pendingDiffs: Record<string, CanvasPendingDiff>;
  onSelectFile: (path: string) => void;
  onCreateFile: (kind: CanvasFileKind, customPath?: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => boolean;
  onDeleteFile: (path: string) => void;
  onImportFiles: (files: File[]) => void;
  onAcceptAllDiffs: () => void;
  onRejectAllDiffs: () => void;
}) {
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const pendingCount = Object.keys(pendingDiffs).length;

  const commitRename = () => {
    if (renamingPath && renameDraft.trim()) {
      onRenameFile(renamingPath, renameDraft.trim());
    }
    setRenamingPath(null);
    setRenameDraft('');
  };

  const createOptions: Array<{ kind: CanvasFileKind; label: string; path?: string }> = [
    { kind: 'code', label: 'HTML App (index.html)', path: 'index.html' },
    { kind: 'code', label: 'Stylesheet (style.css)', path: 'style.css' },
    { kind: 'code', label: 'JavaScript (app.js)', path: 'app.js' },
    { kind: 'doc', label: 'Document (.docx)' },
    { kind: 'sheet', label: 'Spreadsheet (.xlsx)' },
    { kind: 'slides', label: 'Presentation (.pptx)' },
    { kind: 'pdf', label: 'PDF Document (.pdf)' },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--dc-panel-muted)]">
      <div className="flex items-center justify-between border-b border-[var(--dc-border-subtle)] px-3 py-2.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--dc-text-muted)]">
          Files
        </span>
        <div className="relative flex items-center gap-1">
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            accept=".html,.htm,.css,.js,.mjs,.json,.svg,.md,.txt,.docx,.xlsx,.xls,.csv,.tsv,.pptx,.pdf"
            className="hidden"
            onChange={(e) => {
              const list = Array.from(e.target.files || []);
              if (list.length > 0) onImportFiles(list);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            title="Import file from device"
            aria-label="Import file from device"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setNewMenuOpen((o) => !o)}
            title="New file"
            aria-label="New file"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </button>

          {newMenuOpen && (
            <div className="absolute right-0 top-full z-40 mt-1.5 w-52 rounded-xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-1 shadow-lg">
              {createOptions.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    onCreateFile(opt.kind, opt.path);
                    setNewMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-surface-hover)]"
                >
                  <FileKindGlyph kind={opt.kind} />
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="custom-scrollbar flex-1 space-y-0.5 overflow-y-auto p-1.5">
        {files.length === 0 ? (
          <p className="px-2 py-4 text-center text-[12px] text-[var(--dc-text-faint)]">
            No files yet
          </p>
        ) : (
          files.map((file) => {
            const isActive = file.path === activePath;
            const pending = pendingDiffs[file.path];
            const stats = pending
              ? countDiffStats(pending.baseContent, pending.proposedContent)
              : null;

            if (renamingPath === file.path) {
              return (
                <div key={file.id} className="flex items-center gap-1 rounded-lg bg-[var(--dc-surface)] px-2 py-1 ring-1 ring-[var(--deepchat-accent)]">
                  <input
                    type="text"
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') {
                        setRenamingPath(null);
                        setRenameDraft('');
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent text-[12.5px] font-medium text-[var(--dc-text-strong)] outline-none"
                  />
                </div>
              );
            }

            return (
              <div
                key={file.id}
                className={`group flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 transition-colors ${
                  isActive
                    ? 'bg-[var(--dc-surface)] text-[var(--dc-text-strong)] shadow-2xs ring-1 ring-[var(--dc-border-subtle)]'
                    : 'text-[var(--dc-text-body)] hover:bg-[var(--dc-surface-hover)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectFile(file.path)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <FileKindGlyph kind={file.kind} />
                  <span className="truncate text-[12.5px] font-medium">{file.path}</span>
                </button>

                <div className="flex shrink-0 items-center gap-1">
                  {stats && (
                    <span className="font-mono text-[10.5px] tabular-nums">
                      {stats.added > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400">+{stats.added}</span>
                      )}
                      {stats.removed > 0 && (
                        <span className="ml-0.5 text-rose-600 dark:text-rose-400">-{stats.removed}</span>
                      )}
                    </span>
                  )}

                  <div className="hidden items-center gap-0.5 group-hover:flex group-focus-within:flex">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingPath(file.path);
                        setRenameDraft(file.path);
                      }}
                      title="Rename"
                      aria-label={`Rename ${file.path}`}
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--dc-text-faint)] hover:bg-[var(--dc-fill)] hover:text-[var(--dc-text-strong)]"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFile(file.path);
                      }}
                      title="Delete"
                      aria-label={`Delete ${file.path}`}
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--dc-text-faint)] hover:bg-rose-500/12 hover:text-rose-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {pendingCount > 1 && (
        <div className="flex items-center gap-1.5 border-t border-[var(--dc-border-subtle)] p-2">
          <button
            type="button"
            onClick={onRejectAllDiffs}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-[var(--dc-border)] bg-[var(--dc-surface)] py-1.5 text-[11.5px] font-medium text-[var(--dc-text)] hover:bg-[var(--dc-surface-hover)]"
          >
            <X className="h-3 w-3" />
            <span>Reject all</span>
          </button>
          <button
            type="button"
            onClick={onAcceptAllDiffs}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--dc-invert)] py-1.5 text-[11.5px] font-medium text-[var(--dc-text-on-invert)] hover:bg-[var(--dc-invert-hover)]"
          >
            <Check className="h-3 w-3" />
            <span>Accept all</span>
          </button>
        </div>
      )}
    </div>
  );
}
