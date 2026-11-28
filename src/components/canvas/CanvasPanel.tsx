'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import {
  Check,
  Code2,
  FileDiff,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Presentation,
  X,
} from '@/components/ui/icons';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import { countDiffStats } from '@/lib/canvas/diff';
import type { CanvasFileKind } from '@/lib/canvas/types';
import { CanvasDiffView } from './CanvasDiffView';
import { CanvasFileTree } from './CanvasFileTree';
import { CanvasHeader } from './CanvasHeader';
import { useCanvasWorkspace } from './CanvasWorkspaceContext';
import { CodeCanvasEditor } from './editors/CodeCanvasEditor';
import { DocCanvasEditor } from './editors/DocCanvasEditor';
import { PdfCanvasEditor } from './editors/PdfCanvasEditor';
import { SheetCanvasEditor } from './editors/SheetCanvasEditor';
import { SlidesCanvasEditor } from './editors/SlidesCanvasEditor';

const WIDTH_STORAGE_KEY = 'deepchat-canvas-width-pct';
const DEFAULT_WIDTH_PCT = 52;

function subscribeDesktopQuery(cb: () => void) {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia('(min-width: 768px)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function getIsDesktop() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(min-width: 768px)').matches;
}

function getSavedWidthPct(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH_PCT;
  try {
    const raw = Number(localStorage.getItem(WIDTH_STORAGE_KEY));
    if (Number.isFinite(raw) && raw >= 38 && raw <= 72) return raw;
  } catch {}
  return DEFAULT_WIDTH_PCT;
}

export function CanvasPanel() {
  const {
    isOpen,
    isSaving,
    isAgentStreaming,
    title,
    files,
    activeFilePath,
    activeFile,
    activePendingDiff,
    activeStreaming,
    pendingDiffs,
    pendingDiffCount,
    mode,
    canUndo,
    canRedo,
    setOpen,
    setMode,
    selectFile,
    createFile,
    updateFileContent,
    renameFile,
    deleteFile,
    importDeviceFiles,
    undo,
    redo,
    acceptDiff,
    rejectDiff,
    acceptHunk,
    rejectHunk,
    acceptAllDiffs,
    rejectAllDiffs,
  } = useCanvasWorkspace();

  const isDesktop = useSyncExternalStore(subscribeDesktopQuery, getIsDesktop, () => true);
  const [widthPct, setWidthPct] = useState<number>(getSavedWidthPct);
  const [isResizing, setIsResizing] = useState(false);
  const [treeOverride, setTreeOverride] = useState<boolean | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const asideRef = useRef<HTMLElement>(null);
  const desktopInnerRef = useRef<HTMLDivElement>(null);
  const mobileSheetRef = useRef<HTMLDivElement>(null);
  const treeRailRef = useRef<HTMLDivElement>(null);
  const stageBodyRef = useRef<HTMLDivElement>(null);
  const diffBannerRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const prevModeRef = useRef(mode);

  const isTreeOpen = treeOverride ?? files.length > 1;

  const requestClose = useCallback(() => {
    if (!isOpen || isClosing) return;
    const reduce = prefersReducedMotion();

    if (reduce) {
      setOpen(false);
      return;
    }

    setIsClosing(true);

    if (isDesktop) {
      const asideEl = asideRef.current;
      const innerEl = desktopInnerRef.current;
      if (!asideEl || !innerEl) {
        setIsClosing(false);
        setOpen(false);
        return;
      }
      gsap.killTweensOf([asideEl, innerEl]);
      const tl = gsap.timeline({
        defaults: { force3D: true },
        onComplete: () => {
          setIsClosing(false);
          setOpen(false);
        },
      });
      tl.to(innerEl, { opacity: 0, x: 18, duration: 0.18, ease: 'power2.in' }, 0).to(
        asideEl,
        { width: 0, duration: 0.28, ease: 'power3.inOut' },
        0.02
      );
      return;
    }

    const mobileEl = mobileSheetRef.current;
    if (!mobileEl) {
      setIsClosing(false);
      setOpen(false);
      return;
    }
    gsap.killTweensOf(mobileEl);
    gsap.to(mobileEl, {
      y: '100%',
      duration: 0.25,
      ease: 'power3.in',
      onComplete: () => {
        setIsClosing(false);
        setOpen(false);
      },
    });
  }, [isClosing, isDesktop, isOpen, setOpen]);

  // Entrance GSAP animation on open
  useLayoutEffect(() => {
    if (!isOpen || isClosing) return;
    const reduce = prefersReducedMotion();

    if (isDesktop) {
      const asideEl = asideRef.current;
      const innerEl = desktopInnerRef.current;
      if (!asideEl || !innerEl) return;

      gsap.killTweensOf([asideEl, innerEl]);
      if (reduce) {
        gsap.set(asideEl, { width: `${widthPct}%` });
        gsap.set(innerEl, { opacity: 1, x: 0 });
        return;
      }

      const tl = gsap.timeline({ defaults: { force3D: true } });
      tl.fromTo(
        asideEl,
        { width: '0%' },
        { width: `${widthPct}%`, duration: 0.38, ease: 'expo.out' },
        0
      ).fromTo(
        innerEl,
        { opacity: 0, x: 24 },
        { opacity: 1, x: 0, duration: 0.34, ease: 'power3.out', clearProps: 'transform,opacity' },
        0.04
      );
      return () => {
        tl.kill();
      };
    }

    const mobileEl = mobileSheetRef.current;
    if (!mobileEl) return;
    gsap.killTweensOf(mobileEl);
    if (reduce) {
      gsap.set(mobileEl, { y: 0 });
      return;
    }
    gsap.fromTo(
      mobileEl,
      { y: '100%' },
      { y: '0%', duration: 0.36, ease: 'expo.out', clearProps: 'transform' }
    );
    // widthPct intentionally excluded so drag-resizing doesn't replay entrance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, isOpen]);

  // Subtle GSAP transition when toggling Preview / Edit / Diff
  useLayoutEffect(() => {
    if (!isOpen) return;
    if (prevModeRef.current === mode) return;
    prevModeRef.current = mode;

    const el = stageBodyRef.current;
    if (!el || prefersReducedMotion()) return;
    gsap.fromTo(
      el,
      { opacity: 0.65, y: 5 },
      { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out', clearProps: 'transform,opacity' }
    );
  }, [isOpen, mode]);

  // Subtle GSAP entrance for the pending-diff bar
  useLayoutEffect(() => {
    const el = diffBannerRef.current;
    if (!el || !activePendingDiff || mode === 'diff' || prefersReducedMotion()) return;
    gsap.fromTo(
      el,
      { opacity: 0, y: -6 },
      { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out', clearProps: 'transform,opacity' }
    );
  }, [activePendingDiff, mode]);

  // Animate file rail open/close on desktop
  useLayoutEffect(() => {
    if (!isDesktop || !isOpen) return;
    const railEl = treeRailRef.current;
    if (!railEl) return;
    const reduce = prefersReducedMotion();
    gsap.killTweensOf(railEl);

    if (reduce) {
      gsap.set(railEl, { width: isTreeOpen ? 204 : 0, opacity: isTreeOpen ? 1 : 0 });
      return;
    }

    gsap.to(railEl, {
      width: isTreeOpen ? 204 : 0,
      opacity: isTreeOpen ? 1 : 0,
      duration: isTreeOpen ? 0.28 : 0.22,
      ease: isTreeOpen ? 'expo.out' : 'power2.inOut',
      overwrite: 'auto',
    });
  }, [isDesktop, isOpen, isTreeOpen]);

  // Escape closes Canvas (unless fullscreen presentation or input takes precedence)
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[data-mobile-overlay="true"]') && isDesktop) return;
      requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDesktop, isOpen, requestClose]);

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDesktop) return;
    e.preventDefault();
    const container = asideRef.current?.parentElement;
    if (!container) return;

    setIsResizing(true);
    const onMove = (moveEvent: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const rightSpace = rect.right - moveEvent.clientX;
      const nextPct = Math.max(38, Math.min(72, Math.round((rightSpace / rect.width) * 100)));
      setWidthPct(nextPct);
      if (asideRef.current) {
        asideRef.current.style.width = `${nextPct}%`;
      }
    };
    const onUp = (upEvent: PointerEvent) => {
      setIsResizing(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const rect = container.getBoundingClientRect();
      if (rect.width > 0) {
        const finalPct = Math.max(
          38,
          Math.min(72, Math.round(((rect.right - upEvent.clientX) / rect.width) * 100))
        );
        try {
          localStorage.setItem(WIDTH_STORAGE_KEY, String(finalPct));
        } catch {}
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  if (!isOpen) return null;

  const activeDiffStats = activePendingDiff
    ? countDiffStats(activePendingDiff.baseContent, activePendingDiff.proposedContent)
    : null;

  const renderMainBody = () => {
    if (!activeFile) {
      const starters: Array<{
        kind: CanvasFileKind;
        title: string;
        subtitle: string;
        icon: React.ReactNode;
      }> = [
        {
          kind: 'code',
          title: 'HTML, CSS & JS App',
          subtitle: 'Interactive web page with live preview',
          icon: <Code2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />,
        },
        {
          kind: 'doc',
          title: 'Word Document',
          subtitle: 'Formatted writing, notes & .docx export',
          icon: <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" />,
        },
        {
          kind: 'sheet',
          title: 'Excel Spreadsheet',
          subtitle: 'Formulas, multi-sheet grid & .xlsx export',
          icon: <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
        },
        {
          kind: 'slides',
          title: 'PowerPoint Deck',
          subtitle: 'Structured 16:9 slides & .pptx export',
          icon: <Presentation className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
        },
        {
          kind: 'pdf',
          title: 'PDF Report',
          subtitle: 'Print-ready pages & native .pdf viewer',
          icon: <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />,
        },
      ];

      return (
        <div className="custom-scrollbar flex flex-1 flex-col items-center justify-center overflow-y-auto p-6">
          <div className="w-full max-w-md space-y-5">
            <div className="text-center">
              <h2 className="text-base font-semibold text-[var(--dc-text-strong)]">
                Canvas Workspace
              </h2>
              <p className="mt-1 text-[13px] text-[var(--dc-text-muted)]">
                Create a file below or ask the assistant to build anything live.
              </p>
            </div>

            <div className="grid gap-2">
              {starters.map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  onClick={() => createFile(item.kind)}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3.5 py-3 text-left transition-colors hover:border-[var(--dc-border-strong)] hover:bg-[var(--dc-surface-hover)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--dc-panel-muted)]">
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-[var(--dc-text-strong)]">
                      {item.title}
                    </div>
                    <div className="text-[12px] text-[var(--dc-text-muted)]">{item.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-center">
              <input
                ref={uploadInputRef}
                type="file"
                multiple
                accept=".html,.htm,.css,.js,.mjs,.json,.svg,.md,.txt,.docx,.xlsx,.xls,.csv,.tsv,.pptx,.pdf"
                className="hidden"
                onChange={(e) => {
                  const list = Array.from(e.target.files || []);
                  if (list.length > 0) void importDeviceFiles(list);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-medium text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
              >
                <FolderOpen className="h-4 w-4" />
                <span>Import file from device</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (mode === 'diff' && activePendingDiff) {
      return (
        <CanvasDiffView
          diff={activePendingDiff}
          onAcceptAll={() => acceptDiff(activePendingDiff.path)}
          onRejectAll={() => rejectDiff(activePendingDiff.path)}
          onAcceptHunk={(hunkId) => acceptHunk(activePendingDiff.path, hunkId)}
          onRejectHunk={(hunkId) => rejectHunk(activePendingDiff.path, hunkId)}
          onOpenPreview={() => setMode('preview')}
        />
      );
    }

    const effectiveMode: 'preview' | 'edit' = mode === 'edit' ? 'edit' : 'preview';
    const isFileStreaming = Boolean(activeStreaming && activeStreaming.path === activeFile.path);
    const handleEditChange = (nextContent: string) => {
      updateFileContent(activeFile.path, nextContent, true);
    };

    switch (activeFile.kind) {
      case 'code':
        return (
          <CodeCanvasEditor
            file={activeFile}
            files={files}
            mode={effectiveMode}
            isStreaming={isFileStreaming}
            onChange={handleEditChange}
          />
        );
      case 'doc':
        return (
          <DocCanvasEditor
            file={activeFile}
            mode={effectiveMode}
            onChange={handleEditChange}
          />
        );
      case 'sheet':
        return (
          <SheetCanvasEditor
            file={activeFile}
            mode={effectiveMode}
            isStreaming={isFileStreaming}
            onChange={handleEditChange}
          />
        );
      case 'slides':
        return (
          <SlidesCanvasEditor
            file={activeFile}
            mode={effectiveMode}
            isStreaming={isFileStreaming}
            onChange={handleEditChange}
          />
        );
      case 'pdf':
        return (
          <PdfCanvasEditor
            file={activeFile}
            mode={effectiveMode}
            isStreaming={isFileStreaming}
            onChange={handleEditChange}
          />
        );
    }
  };

  const panelContent = (
    <div className="flex h-full min-h-0 flex-col bg-[var(--dc-canvas)]">
      <CanvasHeader
        title={title}
        files={files}
        activeFile={activeFile}
        activePendingDiff={activePendingDiff}
        pendingDiffCount={pendingDiffCount}
        isAgentStreaming={isAgentStreaming}
        isSaving={isSaving}
        mode={mode}
        isTreeOpen={isTreeOpen}
        canUndo={canUndo}
        canRedo={canRedo}
        onToggleTree={() => setTreeOverride(!isTreeOpen)}
        onModeChange={setMode}
        onRenameActiveFile={renameFile}
        onUndo={undo}
        onRedo={redo}
        onClose={requestClose}
      />

      {activeStreaming && activeStreaming.action === 'patch' && (
        <div className="flex items-center gap-2 border-b border-[var(--dc-border-subtle)] bg-[var(--dc-panel-muted)] px-3.5 py-1.5 text-[12px] text-[var(--dc-text-muted)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          <span className="truncate">
            Applying edit to <strong className="font-semibold text-[var(--dc-text-strong)]">{activeStreaming.path}</strong>...
          </span>
        </div>
      )}

      {activePendingDiff && mode !== 'diff' && !isAgentStreaming && (
        <div
          ref={diffBannerRef}
          className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--dc-border-subtle)] bg-[var(--dc-panel-muted)] px-3.5 py-2"
        >
          <div className="flex min-w-0 items-center gap-2 text-[12px]">
            <FileDiff className="h-3.5 w-3.5 shrink-0 text-[var(--deepchat-accent)]" />
            <span className="truncate font-medium text-[var(--dc-text-strong)]">
              {activePendingDiff.summary || 'Pending agent changes'}
            </span>
            {activeDiffStats && (
              <span className="font-mono text-[11px] tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400">+{activeDiffStats.added}</span>{' '}
                <span className="text-rose-600 dark:text-rose-400">-{activeDiffStats.removed}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMode('diff')}
              className="inline-flex h-7 items-center rounded-md px-2 text-[11.5px] font-medium text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
            >
              View diff
            </button>
            <button
              type="button"
              onClick={() => rejectDiff(activePendingDiff.path)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--dc-border)] bg-[var(--dc-surface)] px-2 text-[11.5px] font-medium text-[var(--dc-text)] hover:bg-[var(--dc-surface-hover)]"
            >
              <X className="h-3 w-3 text-rose-500" />
              <span>Reject</span>
            </button>
            <button
              type="button"
              onClick={() => acceptDiff(activePendingDiff.path)}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-[var(--dc-invert)] px-2.5 text-[11.5px] font-medium text-[var(--dc-text-on-invert)] hover:bg-[var(--dc-invert-hover)]"
            >
              <Check className="h-3 w-3" />
              <span>Accept</span>
            </button>
          </div>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop left file rail */}
        {isDesktop ? (
          <div
            ref={treeRailRef}
            style={{ width: isTreeOpen ? 204 : 0, opacity: isTreeOpen ? 1 : 0 }}
            className="shrink-0 overflow-hidden border-r border-[var(--dc-border-subtle)]"
          >
            <div className="h-full w-[204px]">
              <CanvasFileTree
                files={files}
                activePath={activeFilePath}
                pendingDiffs={pendingDiffs}
                onSelectFile={(path) => selectFile(path)}
                onCreateFile={(kind, path) => {
                  createFile(kind, path);
                }}
                onRenameFile={renameFile}
                onDeleteFile={deleteFile}
                onImportFiles={(list) => void importDeviceFiles(list)}
                onAcceptAllDiffs={acceptAllDiffs}
                onRejectAllDiffs={rejectAllDiffs}
              />
            </div>
          </div>
        ) : (
          isTreeOpen && (
            <div className="absolute inset-0 z-30 flex">
              <div className="h-full w-64 max-w-[80vw] border-r border-[var(--dc-border)] shadow-xl">
                <CanvasFileTree
                  files={files}
                  activePath={activeFilePath}
                  pendingDiffs={pendingDiffs}
                  onSelectFile={(path) => {
                    selectFile(path);
                    setTreeOverride(false);
                  }}
                  onCreateFile={(kind, path) => {
                    createFile(kind, path);
                    setTreeOverride(false);
                  }}
                  onRenameFile={renameFile}
                  onDeleteFile={deleteFile}
                  onImportFiles={(list) => {
                    void importDeviceFiles(list);
                    setTreeOverride(false);
                  }}
                  onAcceptAllDiffs={acceptAllDiffs}
                  onRejectAllDiffs={rejectAllDiffs}
                />
              </div>
              <button
                type="button"
                aria-label="Close file drawer"
                onClick={() => setTreeOverride(false)}
                className="flex-1 bg-black/25"
              />
            </div>
          )
        )}

        <div ref={stageBodyRef} className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {renderMainBody()}
        </div>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <aside
        ref={asideRef}
        aria-label="Canvas workspace"
        style={{ width: `${widthPct}%` }}
        className="dc-canvas-panel relative flex h-full shrink-0 overflow-hidden"
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize Canvas panel"
          data-dragging={isResizing ? 'true' : 'false'}
          onPointerDown={handleResizePointerDown}
          className="dc-canvas-resizer"
        />
        <div
          ref={desktopInnerRef}
          className={`min-w-0 flex-1 overflow-hidden ${isResizing ? 'pointer-events-none select-none' : ''}`}
        >
          {panelContent}
        </div>
      </aside>
    );
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={mobileSheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="Canvas workspace"
      data-mobile-overlay="true"
      className="fixed inset-0 z-[80] flex flex-col bg-[var(--dc-canvas)] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] md:hidden"
    >
      {panelContent}
    </div>,
    document.body
  );
}
